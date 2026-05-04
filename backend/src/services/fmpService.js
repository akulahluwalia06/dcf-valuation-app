const axios = require('axios');
const FinancialData = require('../models/FinancialData');

const BASE_URL = 'https://financialmodelingprep.com/stable';

async function fmpGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${sep}apikey=${process.env.FMP_API_KEY}`;
  const { data } = await axios.get(url, { timeout: 12000 });

  // FMP returns a string message when rate limited
  if (typeof data === 'string' && data.includes('limit')) {
    throw new Error('FMP_RATE_LIMIT');
  }
  return data;
}

async function getCached(ticker, type, fetchFn, ttlHours = 24) {
  const existing = await FinancialData.findOne({ ticker, type });
  if (existing) return existing.data;

  const fresh = await fetchFn();
  await FinancialData.findOneAndUpdate(
    { ticker, type },
    {
      data: fresh,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
    { upsert: true, new: true }
  );
  return fresh;
}

// Single call: profile has price, marketCap, beta, sector etc.
async function getProfile(ticker) {
  return getCached(ticker, 'profile', async () => {
    const data = await fmpGet(`/profile?symbol=${ticker}`);
    return Array.isArray(data) ? data[0] : data || {};
  });
}

// Live quote — short TTL (5 min)
async function getQuote(ticker) {
  return getCached(ticker, 'quote', async () => {
    const data = await fmpGet(`/quote?symbol=${ticker}`);
    return Array.isArray(data) ? data[0] : data || {};
  }, 5 / 60); // 5 minute TTL
}

async function getIncomeStatements(ticker, limit = 5) {
  return getCached(ticker, 'income', async () => {
    const data = await fmpGet(`/income-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

async function getBalanceSheets(ticker, limit = 1) {
  return getCached(ticker, 'balance', async () => {
    const data = await fmpGet(`/balance-sheet-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

async function getCashFlowStatements(ticker, limit = 5) {
  return getCached(ticker, 'cashflow', async () => {
    const data = await fmpGet(`/cash-flow-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

// Build normalized snapshot — 3 parallel calls (profile + income + cashflow + balance)
async function getFinancialSnapshot(ticker) {
  // Fetch in parallel — profile covers price so no separate quote needed
  const [profile, income, cashflow, balance] = await Promise.all([
    getProfile(ticker),
    getIncomeStatements(ticker, 5),
    getCashFlowStatements(ticker, 5),
    getBalanceSheets(ticker, 1),
  ]);

  const latest    = income[0]   || {};
  const latestCF  = cashflow[0] || {};
  const latestBal = balance[0]  || {};

  const revenue     = latest.revenue           || 0;
  const ebit        = latest.operatingIncome   || latest.ebit || 0;
  const grossProfit = latest.grossProfit       || 0;
  const da          = latestCF.depreciationAndAmortization || 0;
  const capex       = Math.abs(latestCF.capitalExpenditure || latestCF.investmentsInPropertyPlantAndEquipment || 0);
  const fcf         = latestCF.freeCashFlow    || 0;
  const cash        = latestBal.cashAndCashEquivalents || latestBal.cashAndShortTermInvestments || 0;
  const totalDebt   = latestBal.totalDebt      || (latestBal.shortTermDebt || 0) + (latestBal.longTermDebt || 0);

  // Derive shares from marketCap / price when not explicitly available
  const price       = profile.price || 0;
  const marketCap   = profile.marketCap || 0;
  const sharesOutstanding = marketCap && price ? marketCap / price : 1;

  const historicalRevenues = income.slice(0, 5).map(y => ({
    period:      y.fiscalYear || y.date?.substring(0, 4),
    revenue:     y.revenue,
    grossProfit: y.grossProfit,
    ebit:        y.operatingIncome || y.ebit,
    netIncome:   y.netIncome || y.bottomLineNetIncome,
  })).reverse();

  return {
    ticker:           ticker.toUpperCase(),
    companyName:      profile.companyName || ticker,
    currentPrice:     price,
    marketCap,
    exchange:         profile.exchange || profile.exchangeFullName || '',
    sector:           profile.sector   || '',
    industry:         profile.industry || '',
    description:      profile.description || '',
    latestFiscalYear: latest.fiscalYear || latest.date?.substring(0, 4) || '',
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

module.exports = {
  getProfile, getQuote, getIncomeStatements,
  getBalanceSheets, getCashFlowStatements, getFinancialSnapshot,
};
