/**
 * Core DCF calculation engine — runs on the backend.
 * Frontend mirrors this logic in frontend/utils/dcfEngine.ts for live updates.
 */

function calculateDCF(assumptions) {
  const {
    baseRevenue,
    revGrowthRates,   // array of 7 growth rates
    ebitMargin,
    taxRate,
    grossMargin,
    daPercent,
    capexPercent,
    nwcPercent,
    wacc,
    terminalGrowthRate,
    exitMultiple,
    cash,
    debt,
    sharesOutstanding,
  } = assumptions;

  const years = revGrowthRates.length;
  let prevRev = baseRevenue;
  let prevNwc = baseRevenue * nwcPercent;
  let pvSum = 0;

  const projections = [];

  for (let i = 0; i < years; i++) {
    const rev = prevRev * (1 + revGrowthRates[i]);
    const grossProfit = rev * grossMargin;
    const ebit = rev * ebitMargin;
    const nopat = ebit * (1 - taxRate);
    const da = rev * daPercent;
    const capex = rev * capexPercent;
    const nwc = rev * nwcPercent;
    const dNwc = nwc - prevNwc;
    const fcff = nopat + da - capex - dNwc;
    const discountFactor = 1 / Math.pow(1 + wacc, i + 1);
    const pvFcff = fcff * discountFactor;
    pvSum += pvFcff;

    projections.push({
      year: i + 1,
      revenue: rev,
      grossProfit,
      grossMargin: grossMargin,
      ebit,
      ebitMargin,
      nopat,
      da,
      capex,
      nwc,
      dNwc,
      fcff,
      fcfMargin: fcff / rev,
      discountFactor,
      pvFcff,
    });

    prevRev = rev;
    prevNwc = nwc;
  }

  const lastFCFF = projections[years - 1].fcff;
  const lastEBITDA = projections[years - 1].ebit + projections[years - 1].da;

  // GGM Terminal Value
  const ggmTV = lastFCFF * (1 + terminalGrowthRate) / (wacc - terminalGrowthRate);
  const pvGGM = ggmTV / Math.pow(1 + wacc, years);

  // Exit Multiple Terminal Value
  const exitTV = lastEBITDA * exitMultiple;
  const pvExit = exitTV / Math.pow(1 + wacc, years);

  // Blended 50/50
  const pvBlended = (pvGGM + pvExit) / 2;

  const evGGM = pvSum + pvGGM;
  const evExit = pvSum + pvExit;
  const evBlended = pvSum + pvBlended;

  const equityGGM = evGGM + cash - debt;
  const equityExit = evExit + cash - debt;
  const equityBlended = evBlended + cash - debt;

  return {
    projections,
    pvFCFFs: pvSum,
    terminalValues: { ggmTV, pvGGM, exitTV, pvExit, pvBlended },
    enterpriseValue: { ggm: evGGM, exit: evExit, blended: evBlended },
    equityValue: { ggm: equityGGM, exit: equityExit, blended: equityBlended },
    intrinsicPerShare: {
      ggm: equityGGM / sharesOutstanding,
      exit: equityExit / sharesOutstanding,
      blended: equityBlended / sharesOutstanding,
    },
    tvAsPercentEV: {
      ggm: pvGGM / evGGM,
      exit: pvExit / evExit,
    },
  };
}

function calculateSensitivity(baseAssumptions, waccOffsets, tgrValues) {
  return waccOffsets.map(wOffset => ({
    wacc: baseAssumptions.wacc + wOffset,
    values: tgrValues.map(tgr => {
      const result = calculateDCF({ ...baseAssumptions, wacc: baseAssumptions.wacc + wOffset, terminalGrowthRate: tgr });
      return result.intrinsicPerShare.blended;
    }),
  }));
}

function calculateScenarios(baseRevenue, scenarios, cash, debt, sharesOutstanding) {
  return scenarios.map(s => {
    const result = calculateDCF({
      baseRevenue,
      revGrowthRates: s.revGrowthRates,
      ebitMargin: s.ebitMargin,
      taxRate: s.taxRate,
      grossMargin: s.grossMargin || 0.74,
      daPercent: s.daPercent || 0.038,
      capexPercent: s.capexPercent || 0.025,
      nwcPercent: s.nwcPercent || -0.18,
      wacc: s.wacc,
      terminalGrowthRate: s.terminalGrowthRate,
      exitMultiple: s.exitMultiple || 30,
      cash,
      debt,
      sharesOutstanding,
    });
    return { ...s, result };
  });
}

module.exports = { calculateDCF, calculateSensitivity, calculateScenarios };
