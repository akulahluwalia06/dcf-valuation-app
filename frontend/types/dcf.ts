export interface DCFAssumptions {
  baseRevenue: number;
  revGrowthRates: number[];      // 7 values
  ebitMargin: number;
  taxRate: number;
  grossMargin: number;
  daPercent: number;
  capexPercent: number;
  nwcPercent: number;
  wacc: number;
  terminalGrowthRate: number;
  exitMultiple: number;
  cash: number;
  debt: number;
  sharesOutstanding: number;
}

export interface YearProjection {
  year: number;
  revenue: number;
  grossProfit: number;
  grossMargin: number;
  ebit: number;
  ebitMargin: number;
  nopat: number;
  da: number;
  capex: number;
  nwc: number;
  dNwc: number;
  fcff: number;
  fcfMargin: number;
  discountFactor: number;
  pvFcff: number;
}

export interface DCFResult {
  projections: YearProjection[];
  pvFCFFs: number;
  terminalValues: {
    ggmTV: number;
    pvGGM: number;
    exitTV: number;
    pvExit: number;
    pvBlended: number;
  };
  enterpriseValue: { ggm: number; exit: number; blended: number };
  equityValue: { ggm: number; exit: number; blended: number };
  intrinsicPerShare: { ggm: number; exit: number; blended: number };
  tvAsPercentEV: { ggm: number; exit: number };
}

export interface HistoricalYear {
  year: string;
  revenue: number;
  grossProfit: number;
  grossMargin: number;
  ebit: number;
  ebitMargin: number;
  da: number;
  capex: number;
  fcf: number;
  fcfMargin: number;
}

export interface ScenarioInput {
  name: string;
  probability: number;
  revGrowthRates: number[];
  ebitMargin: number;
  taxRate: number;
  wacc: number;
  terminalGrowthRate: number;
  exitMultiple: number;
  narrative: string;
}

export interface ScenarioResult extends ScenarioInput {
  result: DCFResult;
}

export interface SensitivityRow {
  wacc: number;
  values: number[];
}

export interface PANWModel {
  ticker: string;
  companyName: string;
  currentPrice: number;
  modelDate: string;
  assumptions: DCFAssumptions;
  historical: HistoricalYear[];
  dcf: DCFResult;
  scenarios: ScenarioResult[];
  sensitivity: {
    grid: SensitivityRow[];
    tgrValues: number[];
    waccOffsets: number[];
  };
}

export interface FinancialSnapshot {
  ticker: string;
  companyName: string;
  currentPrice: number;
  marketCap: number;
  exchange: string;
  sector: string;
  industry: string;
  description: string;
  latestFiscalYear: string;
  historicalRevenues: Array<{
    period: string;
    revenue: number;
    grossProfit: number;
    ebit: number;
    netIncome: number;
  }>;
  snapshot: {
    revenue: number;
    grossProfit: number;
    grossMargin: number;
    ebit: number;
    ebitMargin: number;
    da: number;
    daPercent: number;
    capex: number;
    capexPercent: number;
    fcf: number;
    fcfMargin: number;
    cash: number;
    totalDebt: number;
    sharesOutstanding: number;
  };
}
