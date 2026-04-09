import { DCFAssumptions, DCFResult, YearProjection } from '../types/dcf';

export function calculateDCF(assumptions: DCFAssumptions): DCFResult {
  const {
    baseRevenue, revGrowthRates, ebitMargin, taxRate, grossMargin,
    daPercent, capexPercent, nwcPercent, wacc, terminalGrowthRate,
    exitMultiple, cash, debt, sharesOutstanding,
  } = assumptions;

  const years = revGrowthRates.length;
  let prevRev = baseRevenue;
  let prevNwc = baseRevenue * nwcPercent;
  let pvSum = 0;
  const projections: YearProjection[] = [];

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
      year: i + 1, revenue: rev, grossProfit, grossMargin,
      ebit, ebitMargin, nopat, da, capex, nwc, dNwc,
      fcff, fcfMargin: fcff / rev, discountFactor, pvFcff,
    });

    prevRev = rev;
    prevNwc = nwc;
  }

  const lastFCFF = projections[years - 1].fcff;
  const lastEBITDA = projections[years - 1].ebit + projections[years - 1].da;

  const ggmTV = lastFCFF * (1 + terminalGrowthRate) / (wacc - terminalGrowthRate);
  const pvGGM = ggmTV / Math.pow(1 + wacc, years);
  const exitTV = lastEBITDA * exitMultiple;
  const pvExit = exitTV / Math.pow(1 + wacc, years);
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
    tvAsPercentEV: { ggm: pvGGM / evGGM, exit: pvExit / evExit },
  };
}

export function calculateSensitivityGrid(
  baseAssumptions: DCFAssumptions,
  waccOffsets: number[],
  tgrValues: number[],
  currentPrice: number
): { wacc: number; values: { tgr: number; price: number; delta: number }[] }[] {
  return waccOffsets.map(offset => ({
    wacc: baseAssumptions.wacc + offset,
    values: tgrValues.map(tgr => {
      const result = calculateDCF({ ...baseAssumptions, wacc: baseAssumptions.wacc + offset, terminalGrowthRate: tgr });
      const price = result.intrinsicPerShare.blended;
      return { tgr, price, delta: (price - currentPrice) / currentPrice };
    }),
  }));
}

export function getSensitivityColor(delta: number): string {
  if (delta > 0.20) return '#137333';
  if (delta > 0.10) return '#0B5345';
  if (delta > -0.10) return '#7D5A00';
  if (delta > -0.20) return '#C0392B';
  return '#7B241C';
}

export function getSensitivityBg(delta: number): string {
  if (delta > 0.20) return '#B7E1CD';
  if (delta > 0.10) return '#D4EDDA';
  if (delta > -0.10) return '#FCE8B2';
  if (delta > -0.20) return '#F4C7C3';
  return '#E8A09A';
}

export function fmt$(val: number, decimals = 0): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtPct(val: number, decimals = 1): string {
  return `${(val * 100).toFixed(decimals)}%`;
}

export function fmtM(val: number): string {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${val.toFixed(0)}M`;
}
