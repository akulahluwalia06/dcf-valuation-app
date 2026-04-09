const axios = require('axios');
const FinancialData = require('../models/FinancialData');

const BASE_URL = 'https://financialmodelingprep.com/api/v3';

function fmpGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  return axios.get(`${BASE_URL}${path}${sep}apikey=${process.env.FMP_API_KEY}`, {
    timeout: 10000,
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
    const { data } = await fmpGet(`/profile/${ticker}`);
    return data[0] || {};
  });
}

async function getQuote(ticker) {
  // Quotes are short-lived — always fetch fresh
  const { data } = await fmpGet(`/quote/${ticker}`);
  return data[0] || {};
}

async function getIncomeStatements(ticker, limit = 5) {
  return getCached(ticker, 'income', async () => {
    const { data } = await fmpGet(`/income-statement/${ticker}?limit=${limit}`);
    return data;
  });
}

async function getBalanceSheets(ticker, limit = 5) {
  return getCached(ticker, 'balance', async () => {
    const { data } = await fmpGet(`/balance-sheet-statement/${ticker}?limit=${limit}`);
    return data;
  });
}

async function getCashFlowStatements(ticker, limit = 5) {
  return getCached(ticker, 'cashflow', async () => {
    const { data } = await fmpGet(`/cash-flow-statement/${ticker}?limit=${limit}`);
    return data;
  });
}

async function getKeyMetrics(ticker, limit = 5) {
  return getCached(ticker, 'ratios', async () => {
    const { data } = await fmpGet(`/key-metrics/${ticker}?limit=${limit}`);
    return data;
  });
}

// Build a normalized financial snapshot for DCF pre-population
async function getFinancialSnapshot(ticker) {
  const [profile, quote, income, cashflow, balance] = await Promise.all([
    getProfile(ticker),
    getQuote(ticker),
    getIncomeStatements(ticker, 5),
    getCashFlowStatements(ticker, 5),
    getBalanceSheets(ticker, 1),
  ]);

  const latest = income[0] || {};
  const latestCF = cashflow[0] || {};
  const latestBal = balance[0] || {};

  const revenue = latest.revenue || 0;
  const ebit = latest.operatingIncome || 0;
  const grossProfit = latest.grossProfit || 0;
  const da = latestCF.depreciationAndAmortization || 0;
  const capex = Math.abs(latestCF.capitalExpenditure || 0);
  const fcf = latestCF.freeCashFlow || 0;
  const cash = latestBal.cashAndCashEquivalents || 0;
  const totalDebt = (latestBal.shortTermDebt || 0) + (latestBal.longTermDebt || 0);
  const sharesOutstanding = quote.sharesOutstanding || profile.sharesOutstanding || 1;

  // Historical revenues for YoY growth
  const historicalRevenues = income.slice(0, 5).map(y => ({
    period: y.calendarYear || y.date?.substring(0, 4),
    revenue: y.revenue,
    grossProfit: y.grossProfit,
    ebit: y.operatingIncome,
    netIncome: y.netIncome,
  })).reverse();

  return {
    ticker: ticker.toUpperCase(),
    companyName: profile.companyName || ticker,
    currentPrice: quote.price || 0,
    marketCap: quote.marketCap || 0,
    exchange: profile.exchangeShortName,
    sector: profile.sector,
    industry: profile.industry,
    description: profile.description,
    latestFiscalYear: latest.calendarYear || '',
    historicalRevenues,
    snapshot: {
      revenue,
      grossProfit,
      grossMargin: revenue ? grossProfit / revenue : 0,
      ebit,
      ebitMargin: revenue ? ebit / revenue : 0,
      da,
      daPercent: revenue ? da / revenue : 0,
      capex,
      capexPercent: revenue ? capex / revenue : 0,
      fcf,
      fcfMargin: revenue ? fcf / revenue : 0,
      cash,
      totalDebt,
      sharesOutstanding,
    },
  };
}

module.exports = { getProfile, getQuote, getIncomeStatements, getBalanceSheets, getCashFlowStatements, getKeyMetrics, getFinancialSnapshot };
