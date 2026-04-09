const axios = require('axios');
const FinancialData = require('../models/FinancialData');

// FMP Stable API (newer, more consistent field names than v3)
const BASE_URL = 'https://financialmodelingprep.com/stable';

function fmpGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  return axios.get(`${BASE_URL}${path}${sep}apikey=${process.env.FMP_API_KEY}`, {
    timeout: 12000,
  });
}

async function getCached(ticker, type, fetchFn) {
  const existing = await FinancialData.findOne({ ticker, type });
  if (existing) return existing.data;

  const fresh = await fetchFn();
  await FinancialData.findOneAndUpdate(
    { ticker, type },
    { data: fresh, fetchedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    { upsert: true, new: true }
  );
  return fresh;
}

async function getProfile(ticker) {
  return getCached(ticker, 'profile', async () => {
    // stable API returns array for profile
    const { data } = await fmpGet(`/profile?symbol=${ticker}`);
    return Array.isArray(data) ? data[0] : data || {};
  });
}

async function getQuote(ticker) {
  // Quotes are short-lived — always fetch fresh
  const { data } = await fmpGet(`/quote?symbol=${ticker}`);
  return Array.isArray(data) ? data[0] : data || {};
}

async function getIncomeStatements(ticker, limit = 5) {
  return getCached(ticker, 'income', async () => {
    const { data } = await fmpGet(`/income-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

async function getBalanceSheets(ticker, limit = 5) {
  return getCached(ticker, 'balance', async () => {
    const { data } = await fmpGet(`/balance-sheet-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

async function getCashFlowStatements(ticker, limit = 5) {
  return getCached(ticker, 'cashflow', async () => {
    const { data } = await fmpGet(`/cash-flow-statement?symbol=${ticker}&limit=${limit}`);
    return Array.isArray(data) ? data : [];
  });
}

async function getSharesFloat(ticker) {
  try {
    const { data } = await fmpGet(`/shares-float?symbol=${ticker}`);
    return Array.isArray(data) ? data[0] : data || {};
  } catch {
    return {};
  }
}

// Build a normalized financial snapshot for DCF pre-population
async function getFinancialSnapshot(ticker) {
  const [profile, quote, income, cashflow, balance, sharesData] = await Promise.all([
    getProfile(ticker),
    getQuote(ticker),
    getIncomeStatements(ticker, 5),
    getCashFlowStatements(ticker, 5),
    getBalanceSheets(ticker, 1),
    getSharesFloat(ticker),
  ]);

  const latest    = income[0]   || {};
  const latestCF  = cashflow[0] || {};
  const latestBal = balance[0]  || {};

  // Income statement fields (stable API)
  const revenue    = latest.revenue          || 0;
  const ebit       = latest.operatingIncome  || latest.ebit || 0;
  const grossProfit = latest.grossProfit     || 0;

  // Cash flow fields (stable API)
  const da    = latestCF.depreciationAndAmortization || 0;
  const capex = Math.abs(latestCF.capitalExpenditure || latestCF.investmentsInPropertyPlantAndEquipment || 0);
  const fcf   = latestCF.freeCashFlow || 0;

  // Balance sheet fields (stable API)
  const cash      = latestBal.cashAndCashEquivalents || latestBal.cashAndShortTermInvestments || 0;
  const totalDebt = latestBal.totalDebt || (latestBal.shortTermDebt || 0) + (latestBal.longTermDebt || 0);

  // Shares outstanding — profile has it, fallback to sharesFloat
  const sharesOutstanding =
    profile.sharesOutstanding ||
    quote.sharesOutstanding   ||
    sharesData.outstandingShares ||
    sharesData.floatShares    ||
    1;

  // Historical revenues (most recent first → reverse to chronological)
  const historicalRevenues = income.slice(0, 5).map(y => ({
    period:      y.fiscalYear || y.date?.substring(0, 4),
    revenue:     y.revenue,
    grossProfit: y.grossProfit,
    ebit:        y.operatingIncome || y.ebit,
    netIncome:   y.netIncome       || y.bottomLineNetIncome,
  })).reverse();

  return {
    ticker:           ticker.toUpperCase(),
    companyName:      profile.companyName || ticker,
    currentPrice:     quote.price         || profile.price || 0,
    marketCap:        quote.marketCap     || profile.marketCap || 0,
    exchange:         profile.exchange    || profile.exchangeFullName || '',
    sector:           profile.sector      || '',
    industry:         profile.industry    || '',
    description:      profile.description || '',
    latestFiscalYear: latest.fiscalYear   || latest.date?.substring(0, 4) || '',
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
  getProfile, getQuote, getIncomeStatements, getBalanceSheets,
  getCashFlowStatements, getSharesFloat, getFinancialSnapshot,
};
