/**
 * Unified financial data service
 *
 * Strategy:
 *  All tickers → FMP for complete financials (income + cashflow + balance sheet)
 *  US tickers  → supplement with Polygon live price (more real-time than FMP)
 *  Canadian/non-US → use FMP base symbol (strips .TO etc.), FMP has price too
 */

const axios = require('axios');

const POLY_BASE = 'https://api.polygon.io';
const FMP_BASE  = 'https://financialmodelingprep.com/stable';
const FMP_KEY   = process.env.FMP_API_KEY;
const POLY_KEY  = process.env.POLYGON_API_KEY;

// Canadian / non-US exchange suffixes
const NON_US_RE = /\.(TO|V|TSX|CN|NEO|VN|L|AX|PA|DE|HK|T|KS|SS|SZ|SA|MX|NZ|JO|IR|LS|ST|HE|CO|OL|AS|BR|SG)$/i;

function isNonUS(ticker) { return NON_US_RE.test(ticker); }
function baseSymbol(ticker) { return ticker.replace(NON_US_RE, ''); }
function n(v) { return (typeof v === 'number' && isFinite(v) ? v : 0); }

// ── FMP helpers ──────────────────────────────────────────────
async function fmpGet(path) {
  if (!FMP_KEY) throw new Error('FMP_API_KEY not configured on server');
  const sep = path.includes('?') ? '&' : '?';
  const res = await axios.get(`${FMP_BASE}${path}${sep}apikey=${FMP_KEY}`, { timeout: 15000, validateStatus: s => s < 500 });
  if (res.status === 402) { const e = new Error('FMP_PREMIUM_REQUIRED'); e.status = 402; throw e; }
  const data = res.data;
  if (typeof data === 'string' && data.includes('limit')) throw new Error('FMP_RATE_LIMIT');
  if (typeof data === 'object' && data['Error Message']) throw new Error('FMP_AUTH_ERROR: ' + data['Error Message']);
  return data;
}

// ── Polygon price fetch (US only, best-effort) ───────────────
async function polyPrice(ticker) {
  if (!POLY_KEY) return null;
  try {
    const { data } = await axios.get(`${POLY_BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLY_KEY}`, { timeout: 8000 });
    const r = (data.results || [])[0];
    return r ? { price: n(r.c), volume: n(r.v) } : null;
  } catch { return null; }
}

// ── Full snapshot from FMP ───────────────────────────────────
async function snapshotFromFMP(symbol, originalTicker) {
  // Try annual statements first; fall back to TTM-only for non-US primary listings
  const profileP  = fmpGet(`/profile?symbol=${symbol}`);
  const annualP   = Promise.all([
    fmpGet(`/income-statement?symbol=${symbol}&limit=4`),
    fmpGet(`/cash-flow-statement?symbol=${symbol}&limit=4`),
    fmpGet(`/balance-sheet-statement?symbol=${symbol}&limit=1`),
  ]).catch(e => e.status === 402 ? null : Promise.reject(e));

  const [profiles, annualResult] = await Promise.all([profileP, annualP]);

  let income = [], cashflow = [], balance = {};

  if (annualResult) {
    // Annual data available
    income   = Array.isArray(annualResult[0]) ? annualResult[0] : [];
    cashflow = Array.isArray(annualResult[1]) ? annualResult[1] : [];
    balance  = (Array.isArray(annualResult[2]) ? annualResult[2][0] : annualResult[2]) || {};
  } else {
    // Annual locked (402) — fetch TTM single-year snapshots
    const [ttmI, ttmCF, ttmBS] = await Promise.all([
      fmpGet(`/income-statement-ttm?symbol=${symbol}`).catch(() => []),
      fmpGet(`/cash-flow-statement-ttm?symbol=${symbol}`).catch(() => []),
      fmpGet(`/balance-sheet-statement-ttm?symbol=${symbol}`).catch(() => []),
    ]);
    income   = Array.isArray(ttmI)  ? ttmI  : [ttmI  || {}];
    cashflow = Array.isArray(ttmCF) ? ttmCF : [ttmCF || {}];
    balance  = (Array.isArray(ttmBS) ? ttmBS[0] : ttmBS) || {};
  }

  const profile  = (Array.isArray(profiles) ? profiles[0] : profiles) || {};

  const latest   = income[0]   || {};
  const latestCF = cashflow[0] || {};

  const currentPrice      = n(profile.price);
  const marketCap         = n(profile.marketCap);
  const sharesOutstanding = marketCap && currentPrice
    ? marketCap / currentPrice
    : n(profile.sharesOutstanding) || 1;

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

// ── Public API ───────────────────────────────────────────────
async function getFinancialSnapshot(rawTicker) {
  const ticker = rawTicker.toUpperCase();
  const symbol = isNonUS(ticker) ? baseSymbol(ticker) : ticker;

  // FMP gives complete financials for all tickers
  const snap = await snapshotFromFMP(symbol, ticker);

  // For US tickers, supplement with Polygon real-time price if available
  if (!isNonUS(ticker)) {
    const live = await polyPrice(ticker);
    if (live && live.price) {
      snap.currentPrice = live.price;
      // Recompute marketCap with live price
      snap.marketCap = live.price * snap.snapshot.sharesOutstanding;
    }
  }

  return snap;
}

async function getQuote(rawTicker) {
  const ticker = rawTicker.toUpperCase();
  const symbol = isNonUS(ticker) ? baseSymbol(ticker) : ticker;

  if (!isNonUS(ticker)) {
    // Polygon for US live quote
    const live = await polyPrice(ticker);
    if (live) return live;
  }

  // FMP quote fallback
  const data = await fmpGet(`/quote?symbol=${symbol}`);
  return Array.isArray(data) ? data[0] : data || {};
}

// ── Consensus analyst estimates ──────────────────────────────
async function getConsensus(rawTicker) {
  const ticker  = rawTicker.toUpperCase();
  const symbol  = isNonUS(ticker) ? baseSymbol(ticker) : ticker;

  const data = await fmpGet(`/analyst-estimates?symbol=${symbol}&period=annual&limit=5`);
  if (!Array.isArray(data) || data.length === 0) return { estimates: [], source: 'FMP' };

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const estimates = sorted.map((r, i) => {
    const prev = i > 0 ? sorted[i - 1].revenueAvg : null;
    return {
      year:          r.date.substring(0, 4),
      revenueAvg:    r.revenueAvg    || 0,
      revenueLow:    r.revenueLow    || 0,
      revenueHigh:   r.revenueHigh   || 0,
      ebitAvg:       r.ebitAvg       || 0,
      ebitdaAvg:     r.ebitdaAvg     || 0,
      netIncomeAvg:  r.netIncomeAvg  || 0,
      epsAvg:        r.epsAvg        || 0,
      epsLow:        r.epsLow        || 0,
      epsHigh:       r.epsHigh       || 0,
      ebitMargin:    r.revenueAvg ? (r.ebitAvg || 0) / r.revenueAvg : 0,
      revenueGrowth: prev ? (r.revenueAvg - prev) / prev : null,
      numAnalysts:   r.numAnalystsRevenue || r.numAnalystsEps || 0,
    };
  });

  return { estimates, symbol, source: 'FMP / Wall Street Consensus' };
}

module.exports = { getFinancialSnapshot, getQuote, getConsensus };
