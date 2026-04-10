/**
 * Unified financial data service
 *
 * Routing:
 *  US tickers              → Polygon.io (price + financials)
 *  Canadian tickers (.TO etc) → FMP using the base symbol (most dual-list in US)
 *  Fallback                → FMP for any US ticker Polygon can't fill
 */

const axios = require('axios');

const POLY_BASE = 'https://api.polygon.io';
const FMP_BASE  = 'https://financialmodelingprep.com/stable';
const FMP_KEY   = process.env.FMP_API_KEY   || process.env.POLYGON_API_KEY; // reuse env slot
const POLY_KEY  = process.env.POLYGON_API_KEY;

// Canadian / non-US exchange suffixes
const NON_US_RE = /\.(TO|V|TSX|CN|NEO|VN|L|AX|PA|DE|HK|T|KS|SS|SZ|SA|MX|NZ|JO|IR|LS|ST|HE|CO|OL|AS|BR|SG)$/i;

function isNonUS(ticker) { return NON_US_RE.test(ticker); }

// Strip exchange suffix to get the base symbol (SHOP.TO → SHOP)
function baseSymbol(ticker) { return ticker.replace(NON_US_RE, ''); }

function n(v) { return (typeof v === 'number' ? v : 0); }

// ── FMP helpers ──────────────────────────────────────────────
async function fmpGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const { data } = await axios.get(`${FMP_BASE}${path}${sep}apikey=${FMP_KEY}`, { timeout: 15000 });
  if (typeof data === 'string' && data.includes('limit')) throw new Error('FMP_RATE_LIMIT');
  if (typeof data === 'string' && data.includes('Premium')) throw new Error('FMP_PREMIUM_REQUIRED');
  return data;
}

async function snapshotFromFMP(symbol, originalTicker) {
  const [profiles, incomes, cashflows, balances] = await Promise.all([
    fmpGet(`/profile?symbol=${symbol}`),
    fmpGet(`/income-statement?symbol=${symbol}&limit=4`),
    fmpGet(`/cash-flow-statement?symbol=${symbol}&limit=4`),
    fmpGet(`/balance-sheet-statement?symbol=${symbol}&limit=1`),
  ]);

  const profile  = (Array.isArray(profiles)  ? profiles[0]  : profiles)  || {};
  const income   = (Array.isArray(incomes)   ? incomes      : []);
  const cashflow = (Array.isArray(cashflows) ? cashflows    : []);
  const balance  = (Array.isArray(balances)  ? balances[0]  : balances)  || {};

  const latest   = income[0]   || {};
  const latestCF = cashflow[0] || {};

  const currentPrice      = n(profile.price);
  const marketCap         = n(profile.marketCap);
  const sharesOutstanding = marketCap && currentPrice ? marketCap / currentPrice : n(profile.sharesOutstanding) || 1;

  const revenue     = n(latest.revenue);
  const grossProfit = n(latest.grossProfit);
  const ebit        = n(latest.operatingIncome) || n(latest.ebit);
  const da          = n(latestCF.depreciationAndAmortization);
  const capex       = Math.abs(n(latestCF.capitalExpenditure) || n(latestCF.investmentsInPropertyPlantAndEquipment));
  const fcf         = n(latestCF.freeCashFlow);
  const cash        = n(balance.cashAndCashEquivalents) || n(balance.cashAndShortTermInvestments);
  const totalDebt   = n(balance.totalDebt) || n(balance.shortTermDebt) + n(balance.longTermDebt);

  const historicalRevenues = income.slice(0, 4).map(y => ({
    period:      y.fiscalYear || y.date?.substring(0, 4) || '',
    revenue:     n(y.revenue),
    grossProfit: n(y.grossProfit),
    ebit:        n(y.operatingIncome) || n(y.ebit),
    netIncome:   n(y.netIncome),
  })).reverse();

  return {
    ticker:            originalTicker,
    companyName:       profile.companyName || originalTicker,
    currentPrice,
    marketCap,
    exchange:          profile.exchange || profile.exchangeFullName || '',
    sector:            profile.sector   || '',
    industry:          profile.industry || '',
    description:       (profile.description || '').slice(0, 500),
    latestFiscalYear:  latest.fiscalYear || latest.date?.substring(0, 4) || '',
    historicalRevenues,
    snapshot: {
      revenue, grossProfit,
      grossMargin:  revenue ? grossProfit / revenue : 0,
      ebit,
      ebitMargin:   revenue ? ebit / revenue : 0,
      da,
      daPercent:    revenue ? da / revenue : 0,
      capex,
      capexPercent: revenue ? capex / revenue : 0,
      fcf,
      fcfMargin:    revenue ? fcf / revenue : 0,
      cash, totalDebt, sharesOutstanding,
    },
  };
}

// ── Polygon helpers ──────────────────────────────────────────
async function polyGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const { data } = await axios.get(`${POLY_BASE}${path}${sep}apiKey=${POLY_KEY}`, { timeout: 15000 });
  if (data.status === 'ERROR') throw new Error(data.error || 'Polygon error');
  return data;
}

async function snapshotFromPolygon(ticker) {
  const [detailsData, priceData, financialsData] = await Promise.all([
    polyGet(`/v3/reference/tickers/${ticker}`).catch(() => ({ results: {} })),
    polyGet(`/v2/aggs/ticker/${ticker}/prev?adjusted=true`).catch(() => ({ results: [] })),
    polyGet(`/vX/reference/financials?ticker=${ticker}&timeframe=annual&limit=4&order=desc`).catch(() => ({ results: [] })),
  ]);

  const details   = detailsData.results   || {};
  const prevClose = (priceData.results    || [])[0] || {};
  const fins      = financialsData.results || [];

  const currentPrice      = n(prevClose.c);
  const marketCap         = n(details.market_cap);
  const sharesOutstanding = n(details.weighted_shares_outstanding) || (marketCap && currentPrice ? marketCap / currentPrice : 1);

  const latestFin = fins[0] || {};
  const ic = latestFin.financials?.income_statement    || {};
  const bs = latestFin.financials?.balance_sheet       || {};
  const cf = latestFin.financials?.cash_flow_statement || {};

  const revenue     = n(ic.revenues?.value) || n(ic.net_revenues?.value);
  const grossProfit = n(ic.gross_profit?.value);
  const ebit        = n(ic.operating_income_loss?.value);
  const da          = n(cf.depreciation_depletion_and_amortization?.value);
  const capex       = Math.abs(n(cf.capital_expenditure?.value) || n(cf.payments_for_property_plant_and_equipment?.value));
  const operatingCF = n(cf.net_cash_flow_from_operating_activities?.value);
  const fcf         = (operatingCF && capex) ? operatingCF - capex : n(cf.free_cash_flow?.value);
  const cash        = n(bs.cash_and_cash_equivalents?.value) || n(bs.cash_and_short_term_investments?.value);
  const totalDebt   = n(bs.long_term_debt?.value) + n(bs.current_portion_of_long_term_debt?.value);

  const historicalRevenues = fins.map(f => {
    const ic2 = f.financials?.income_statement || {};
    return {
      period:      f.fiscal_year || f.end_date?.substring(0, 4) || '',
      revenue:     n(ic2.revenues?.value) || n(ic2.net_revenues?.value),
      grossProfit: n(ic2.gross_profit?.value),
      ebit:        n(ic2.operating_income_loss?.value),
      netIncome:   n(ic2.net_income_loss?.value),
    };
  }).reverse();

  return {
    ticker,
    companyName:      details.name || ticker,
    currentPrice,
    marketCap,
    exchange:         details.primary_exchange || 'US',
    sector:           details.sic_description  || '',
    industry:         details.sic_description  || '',
    description:      (details.description || '').slice(0, 500),
    latestFiscalYear: latestFin.fiscal_year    || '',
    historicalRevenues,
    snapshot: {
      revenue, grossProfit,
      grossMargin:  revenue ? grossProfit / revenue : 0,
      ebit,
      ebitMargin:   revenue ? ebit / revenue : 0,
      da,
      daPercent:    revenue ? da / revenue : 0,
      capex,
      capexPercent: revenue ? capex / revenue : 0,
      fcf,
      fcfMargin:    revenue ? fcf / revenue : 0,
      cash, totalDebt, sharesOutstanding,
    },
  };
}

// ── Public API ───────────────────────────────────────────────
async function getFinancialSnapshot(rawTicker) {
  const ticker = rawTicker.toUpperCase();

  if (isNonUS(ticker)) {
    // Use base symbol to find US-listed financials via FMP
    const base = baseSymbol(ticker);
    return snapshotFromFMP(base, ticker);
  }

  // Try Polygon for US tickers
  const snap = await snapshotFromPolygon(ticker);

  // If Polygon has no data fall back to FMP
  if (!snap.currentPrice && !snap.snapshot.revenue) {
    return snapshotFromFMP(ticker, ticker);
  }

  return snap;
}

async function getQuote(rawTicker) {
  const ticker = rawTicker.toUpperCase();
  const symbol = isNonUS(ticker) ? baseSymbol(ticker) : ticker;

  if (isNonUS(ticker)) {
    const data = await fmpGet(`/quote?symbol=${symbol}`);
    return Array.isArray(data) ? data[0] : data || {};
  }

  const { data } = await axios.get(
    `${POLY_BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLY_KEY}`,
    { timeout: 10000 }
  );
  return (data.results || [])[0] || {};
}

// ── Consensus analyst estimates ──────────────────────────────
async function getConsensus(rawTicker) {
  const ticker  = rawTicker.toUpperCase();
  const symbol  = isNonUS(ticker) ? baseSymbol(ticker) : ticker;

  const data = await fmpGet(`/analyst-estimates?symbol=${symbol}&period=annual&limit=5`);
  if (!Array.isArray(data) || data.length === 0) return { estimates: [], source: 'FMP' };

  // Sort ascending by date
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Derive implied YoY revenue growth from the estimates
  const estimates = sorted.map((r, i) => {
    const prev = i > 0 ? sorted[i - 1].revenueAvg : null;
    return {
      year:             r.date.substring(0, 4),
      revenueAvg:       r.revenueAvg       || 0,
      revenueLow:       r.revenueLow       || 0,
      revenueHigh:      r.revenueHigh      || 0,
      ebitAvg:          r.ebitAvg          || 0,
      ebitdaAvg:        r.ebitdaAvg        || 0,
      netIncomeAvg:     r.netIncomeAvg     || 0,
      epsAvg:           r.epsAvg           || 0,
      epsLow:           r.epsLow           || 0,
      epsHigh:          r.epsHigh          || 0,
      ebitMargin:       r.revenueAvg ? (r.ebitAvg || 0) / r.revenueAvg : 0,
      revenueGrowth:    prev ? (r.revenueAvg - prev) / prev : null,
      numAnalysts:      r.numAnalystsRevenue || r.numAnalystsEps || 0,
    };
  });

  return { estimates, symbol, source: 'FMP / Wall Street Consensus' };
}

module.exports = { getFinancialSnapshot, getQuote, getConsensus };
