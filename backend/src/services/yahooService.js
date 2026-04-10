const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const FinancialData = require('../models/FinancialData');

async function getCached(ticker, type, fetchFn, ttlHours = 24) {
  const existing = await FinancialData.findOne({ ticker, type });
  if (existing) return existing.data;

  const fresh = await fetchFn();
  await FinancialData.findOneAndUpdate(
    { ticker, type },
    { data: fresh, fetchedAt: new Date(), expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000) },
    { upsert: true, new: true }
  );
  return fresh;
}

// n() safely extracts a number from a value that may be {raw:n} or a plain number
function n(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && 'raw' in v) return v.raw || 0;
  return Number(v) || 0;
}

async function getQuote(ticker) {
  return getCached(ticker, 'yf_quote', async () => {
    const q = await yahooFinance.quote(ticker);
    return q || {};
  }, 5 / 60);
}

async function getFinancialSnapshot(ticker) {
  const summary = await yahooFinance.quoteSummary(ticker, {
    modules: ['price', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
  }).catch(err => { throw new Error(err.message || 'YAHOO_ERROR'); });

  const price    = summary.price    || {};
  const stats    = summary.defaultKeyStatistics || {};
  const finData  = summary.financialData || {};
  const profile  = summary.assetProfile || {};

  const currentPrice      = n(price.regularMarketPrice);
  const marketCap         = n(price.marketCap) || n(stats.marketCap);
  const sharesOutstanding = n(stats.sharesOutstanding) || (marketCap && currentPrice ? marketCap / currentPrice : 1);

  // financialData has TTM figures — no raw wrapper in v3
  const revenue     = n(finData.totalRevenue);
  const grossProfit = n(finData.grossProfits);
  const ebit        = n(finData.ebitda) * n(finData.operatingMargins) / (n(finData.ebitdaMargins) || 1); // approx
  const ebitda      = n(finData.ebitda);
  const da          = ebitda - ebit; // D&A ≈ EBITDA - EBIT
  const capex       = 0; // not directly available from financialData
  const fcf         = n(finData.freeCashflow);
  const cash        = n(finData.totalCash);
  const totalDebt   = n(finData.totalDebt);
  const operatingCF = n(finData.operatingCashflow);

  // Use gross/operating/profit margins to derive gross profit if not set
  const grossM  = n(finData.grossMargins);
  const ebitM   = n(finData.operatingMargins);
  const derivedGross = revenue * grossM;
  const derivedEbit  = revenue * ebitM;

  return {
    ticker:           ticker.toUpperCase(),
    companyName:      price.longName || price.shortName || ticker,
    currentPrice,
    marketCap,
    exchange:         price.exchangeName || '',
    sector:           profile.sector     || '',
    industry:         profile.industry   || '',
    description:      (profile.longBusinessSummary || '').slice(0, 500),
    latestFiscalYear: String(new Date().getFullYear() - 1),
    historicalRevenues: [], // no history from quoteSummary in v3 without fundamentalsTimeSeries
    snapshot: {
      revenue,
      grossProfit: derivedGross || grossProfit,
      grossMargin: grossM,
      ebit: derivedEbit,
      ebitMargin: ebitM,
      da: Math.max(0, ebitda - derivedEbit),
      daPercent: revenue ? Math.max(0, ebitda - derivedEbit) / revenue : 0,
      capex: Math.max(0, operatingCF - fcf), // capex ≈ operatingCF - FCF
      capexPercent: revenue ? Math.max(0, operatingCF - fcf) / revenue : 0,
      fcf,
      fcfMargin: revenue ? fcf / revenue : 0,
      cash,
      totalDebt,
      sharesOutstanding,
    },
  };
}

module.exports = { getQuote, getFinancialSnapshot };
