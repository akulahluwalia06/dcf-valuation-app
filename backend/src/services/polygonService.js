const axios = require('axios');
const FinancialData = require('../models/FinancialData');

const BASE = 'https://api.polygon.io';
const KEY  = process.env.POLYGON_API_KEY;

async function pget(path) {
  const sep = path.includes('?') ? '&' : '?';
  const { data } = await axios.get(`${BASE}${path}${sep}apiKey=${KEY}`, { timeout: 15000 });
  if (data.status === 'ERROR') throw new Error(data.error || 'Polygon error');
  return data;
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

function n(v) { return (typeof v === 'number' ? v : 0); }

async function getFinancialSnapshot(ticker) {
  const t = ticker.toUpperCase();

  const [detailsData, priceData, financialsData] = await Promise.all([
    // Company details
    pget(`/v3/reference/tickers/${t}`).catch(() => ({ results: {} })),
    // Previous day close (free tier)
    pget(`/v2/aggs/ticker/${t}/prev?adjusted=true`).catch(() => ({ results: [] })),
    // Financial statements — annual, last 4 periods
    pget(`/vX/reference/financials?ticker=${t}&timeframe=annual&limit=4&order=desc`).catch(() => ({ results: [] })),
  ]);

  const details   = detailsData.results   || {};
  const prevClose = (priceData.results    || [])[0] || {};
  const fins      = financialsData.results || [];

  const currentPrice = n(prevClose.c);
  const marketCap    = n(details.market_cap);
  const sharesOutstanding = n(details.weighted_shares_outstanding) || (marketCap && currentPrice ? marketCap / currentPrice : 1);

  // Pull from most recent annual filing
  const latestFin  = fins[0]    || {};
  const ic         = latestFin.financials?.income_statement || {};
  const bs         = latestFin.financials?.balance_sheet    || {};
  const cf         = latestFin.financials?.cash_flow_statement || {};

  const revenue     = n(ic.revenues?.value)               || n(ic.net_revenues?.value);
  const grossProfit = n(ic.gross_profit?.value);
  const ebit        = n(ic.operating_income_loss?.value)  || n(ic.income_loss_from_continuing_operations_before_tax?.value);
  const ebitda      = n(ic.ebitda?.value)                 || ebit + n(cf.depreciation_depletion_and_amortization?.value);
  const da          = n(cf.depreciation_depletion_and_amortization?.value);
  const capex       = Math.abs(n(cf.capital_expenditure?.value) || n(cf.payments_for_property_plant_and_equipment?.value));
  const operatingCF = n(cf.net_cash_flow_from_operating_activities?.value);
  const fcf         = operatingCF - capex || n(cf.free_cash_flow?.value);
  const cash        = n(bs.cash_and_cash_equivalents?.value) || n(bs.cash_and_short_term_investments?.value);
  const totalDebt   = n(bs.long_term_debt?.value) + n(bs.current_portion_of_long_term_debt?.value) || n(bs.total_liabilities?.value);

  // Historical revenues (up to 4 years)
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
    ticker:            t,
    companyName:       details.name || t,
    currentPrice,
    marketCap,
    exchange:          details.primary_exchange || '',
    sector:            details.sic_description  || '',
    industry:          details.sic_description  || '',
    description:       (details.description || '').slice(0, 500),
    latestFiscalYear:  latestFin.fiscal_year    || '',
    historicalRevenues,
    snapshot: {
      revenue,
      grossProfit,
      grossMargin:   revenue ? grossProfit / revenue : 0,
      ebit,
      ebitMargin:    revenue ? ebit / revenue : 0,
      da,
      daPercent:     revenue ? da / revenue : 0,
      capex,
      capexPercent:  revenue ? capex / revenue : 0,
      fcf,
      fcfMargin:     revenue ? fcf / revenue : 0,
      cash,
      totalDebt,
      sharesOutstanding,
    },
  };
}

async function getQuote(ticker) {
  return getCached(ticker.toUpperCase(), 'poly_quote', async () => {
    const data = await pget(`/v2/aggs/ticker/${ticker.toUpperCase()}/prev?adjusted=true`);
    return (data.results || [])[0] || {};
  }, 5 / 60);
}

module.exports = { getFinancialSnapshot, getQuote };
