const express = require('express');
const router = express.Router();
const { getQuote } = require('../services/fmpService');
const { calculateDCF, calculateSensitivity, calculateScenarios } = require('../services/dcfService');

// PANW base assumptions — FY2025 10-K / Q1 FY2026 earnings
const PANW_BASE = {
  ticker: 'PANW',
  baseRevenue: 9222,
  revGrowthRates: [0.16, 0.14, 0.12, 0.10, 0.09, 0.08, 0.07],
  ebitMargin: 0.28,
  taxRate: 0.20,
  grossMargin: 0.745,
  daPercent: 0.038,
  capexPercent: 0.025,
  nwcPercent: -0.18,
  wacc: 0.095,
  terminalGrowthRate: 0.035,
  exitMultiple: 30,
  cash: 3100,
  debt: 0,
  sharesOutstanding: 697,
};

const PANW_HISTORICAL = [
  { year: 'FY2021', revenue: 3399, grossProfit: 2454, grossMargin: 0.722, ebit: -267, ebitMargin: -0.079, da: 180, capex: 112, fcf: 735, fcfMargin: 0.216 },
  { year: 'FY2022', revenue: 5502, grossProfit: 3947, grossMargin: 0.717, ebit: -380, ebitMargin: -0.069, da: 229, capex: 141, fcf: 1792, fcfMargin: 0.326 },
  { year: 'FY2023', revenue: 6893, grossProfit: 5059, grossMargin: 0.734, ebit: -264, ebitMargin: -0.038, da: 274, capex: 167, fcf: 2631, fcfMargin: 0.382 },
  { year: 'FY2024', revenue: 8028, grossProfit: 5876, grossMargin: 0.732, ebit: 686,  ebitMargin: 0.085,  da: 310, capex: 195, fcf: 3101, fcfMargin: 0.386 },
  { year: 'FY2025', revenue: 9222, grossProfit: 6768, grossMargin: 0.734, ebit: 1245, ebitMargin: 0.135,  da: 345, capex: 230, fcf: 3494, fcfMargin: 0.379 },
];

const PANW_SCENARIOS = [
  {
    name: 'Bull Case', probability: 0.30,
    revGrowthRates: [0.20, 0.18, 0.16, 0.14, 0.13, 0.12, 0.11],
    ebitMargin: 0.32, taxRate: 0.20, wacc: 0.09,
    terminalGrowthRate: 0.04, exitMultiple: 35,
    narrative: 'Platform consolidation accelerates. AI security boom. NGS ARR surpasses $12B.',
  },
  {
    name: 'Base Case', probability: 0.50,
    revGrowthRates: [0.16, 0.14, 0.12, 0.10, 0.09, 0.08, 0.07],
    ebitMargin: 0.28, taxRate: 0.20, wacc: 0.095,
    terminalGrowthRate: 0.035, exitMultiple: 30,
    narrative: 'Management guidance + street consensus. Gradual margin expansion.',
  },
  {
    name: 'Bear Case', probability: 0.20,
    revGrowthRates: [0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04],
    ebitMargin: 0.24, taxRate: 0.22, wacc: 0.105,
    terminalGrowthRate: 0.025, exitMultiple: 25,
    narrative: 'Macro IT cuts. Competitors take share. Margin compression.',
  },
];

// GET /api/panw/model
// Returns full PANW DCF with live price
router.get('/model', async (req, res) => {
  try {
    const [quote, dcfResult, scenarios] = await Promise.all([
      getQuote('PANW').catch(() => ({ price: null })),
      Promise.resolve(calculateDCF(PANW_BASE)),
      Promise.resolve(calculateScenarios(
        PANW_BASE.baseRevenue,
        PANW_SCENARIOS.map(s => ({ ...s, grossMargin: 0.745, daPercent: 0.038, capexPercent: 0.025, nwcPercent: -0.18 })),
        PANW_BASE.cash, PANW_BASE.debt, PANW_BASE.sharesOutstanding
      )),
    ]);

    const currentPrice = quote.price || 190;

    // Sensitivity grid
    const waccOffsets = [-0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015];
    const tgrValues   = [0.020, 0.025, 0.030, 0.035, 0.040, 0.045, 0.050];
    const sensitivityGrid = calculateSensitivity(PANW_BASE, waccOffsets, tgrValues);

    res.json({
      ticker: 'PANW',
      companyName: 'Palo Alto Networks, Inc.',
      currentPrice,
      modelDate: 'Feb 17, 2026',
      assumptions: PANW_BASE,
      historical: PANW_HISTORICAL,
      dcf: dcfResult,
      scenarios,
      sensitivity: { grid: sensitivityGrid, tgrValues, waccOffsets },
    });
  } catch (err) {
    console.error('PANW model error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/panw/assumptions
router.get('/assumptions', (req, res) => res.json(PANW_BASE));

module.exports = router;
