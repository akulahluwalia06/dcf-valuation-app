/**
 * Unified financial data service
 *
 * Routing logic:
 *  - Canadian tickers (suffix .TO, .V, .TSX, .CN, .NEO) → Yahoo Finance
 *  - US tickers → Polygon.io
 *  - Fallback: if Polygon returns no price/revenue, retry via Yahoo Finance
 */

const axios   = require('axios');
const FinancialData = require('../models/FinancialData');

// ── helpers ──────────────────────────────────────────────────────────────────
function n(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && 'raw' in v) return Number(v.raw) || 0;
  return Number(v) || 0;
}

async function getCached(ticker, type, fetchFn, ttlHours = 24) {
  const existing = await FinancialData.findOne({ ticker, type });
  if (existing) return existing.data;
  const fresh = await fetchFn();
  await FinancialData.findOneAndUpdate(
    { ticker, type },
    { data: fresh, fetchedAt: new Date(), expiresAt: new Date(Date.now() + ttlHours * 3600000) },
    { upsert: true, new: true }
  );
  return fresh;
}

// Detect non-US tickers that Polygon doesn't cover on the free tier
const CANADIAN_RE = /\.(TO|V|TSX|CN|NEO|VN)$/i;
function isNonUS(ticker) {
  return CANADIAN_RE.test(ticker) || ticker.includes(':');
}

// ── Polygon (US) ─────────────────────────────────────────────────────────────
const POLY_BASE = 'https://api.polygon.io';

async function polyGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const { data } = await axios.get(`${POLY_BASE}${path}${sep}apiKey=${process.env.POLYGON_API_KEY}`, { timeout: 15000 });
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

  const currentPrice       = n(prevClose.c);
  const marketCap          = n(details.market_cap);
  const sharesOutstanding  = n(details.weighted_shares_outstanding) || (marketCap && currentPrice ? marketCap / currentPrice : 1);

  const latestFin = fins[0] || {};
  const ic = latestFin.financials?.income_statement    || {};
  const bs = latestFin.financials?.balance_sheet       || {};
  const cf = latestFin.financials?.cash_flow_statement || {};

  const revenue     = n(ic.revenues?.value)      || n(ic.net_revenues?.value);
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

// ── Yahoo Finance (international / Canadian fallback) ─────────────────────────
// yahoo-finance2 v2 — handles crumb/cookie automatically
const yf = require('yahoo-finance2').default;
yf.suppressNotices(['yahooSurvey']);

async function snapshotFromYahoo(ticker) {
  const summary = await yf.quoteSummary(ticker, {
    modules: ['price', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
  });

  const price   = summary.price    || {};
  const stats   = summary.defaultKeyStatistics || {};
  const finData = summary.financialData || {};
  const profile = summary.assetProfile  || {};

  const currentPrice      = n(price.regularMarketPrice);
  const marketCap         = n(price.marketCap) || n(stats.marketCap);
  const sharesOutstanding = n(stats.sharesOutstanding) || (marketCap && currentPrice ? marketCap / currentPrice : 1);

  const revenue     = n(finData.totalRevenue);
  const grossProfit = n(finData.grossProfits);
  const ebitda      = n(finData.ebitda);
  const ebitM       = n(finData.operatingMargins);
  const ebit        = revenue * ebitM;
  const da          = ebitda > ebit ? ebitda - ebit : 0;
  const fcf         = n(finData.freeCashflow);
  const operatingCF = n(finData.operatingCashflow);
  const capex       = operatingCF > fcf && fcf > 0 ? operatingCF - fcf : 0;
  const cash        = n(finData.totalCash);
  const totalDebt   = n(finData.totalDebt);
  const grossM      = n(finData.grossMargins);

  return {
    ticker,
    companyName:      price.longName || price.shortName || ticker,
    currentPrice,
    marketCap,
    exchange:         price.exchangeName || price.fullExchangeName || '',
    sector:           profile.sector   || '',
    industry:         profile.industry || '',
    description:      (profile.longBusinessSummary || '').slice(0, 500),
    latestFiscalYear: String(new Date().getFullYear() - 1),
    historicalRevenues: [],
    snapshot: {
      revenue,
      grossProfit:  grossProfit || revenue * grossM,
      grossMargin:  grossM,
      ebit,
      ebitMargin:   ebitM,
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

// ── Public API ───────────────────────────────────────────────────────────────
async function getFinancialSnapshot(rawTicker) {
  const ticker = rawTicker.toUpperCase();

  return getCached(ticker, 'snapshot_v2', async () => {
    // Route Canadian / international tickers straight to Yahoo
    if (isNonUS(ticker)) {
      return snapshotFromYahoo(ticker);
    }

    // Try Polygon first for US tickers
    const snap = await snapshotFromPolygon(ticker);

    // If Polygon returned no useful data, fall back to Yahoo
    if (!snap.currentPrice && !snap.snapshot.revenue) {
      return snapshotFromYahoo(ticker);
    }

    return snap;
  });
}

async function getQuote(rawTicker) {
  const ticker = rawTicker.toUpperCase();
  return getCached(ticker, 'quote_v2', async () => {
    if (isNonUS(ticker)) {
      const q = await yf.quote(ticker);
      return q || {};
    }
    const { data } = await axios.get(
      `${POLY_BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`,
      { timeout: 10000 }
    );
    return (data.results || [])[0] || {};
  }, 5 / 60);
}

module.exports = { getFinancialSnapshot, getQuote };
