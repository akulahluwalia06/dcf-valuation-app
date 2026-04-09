import axios from 'axios';
import { DCFAssumptions, PANWModel, FinancialSnapshot } from '../types/dcf';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercept errors globally
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

export const panwApi = {
  getModel: (): Promise<PANWModel> =>
    api.get('/api/panw/model').then(r => r.data),
  getAssumptions: () =>
    api.get('/api/panw/assumptions').then(r => r.data),
};

export const financialApi = {
  getSnapshot: (ticker: string): Promise<FinancialSnapshot> =>
    api.get(`/api/financial/${ticker}/snapshot`).then(r => r.data),
  getQuote: (ticker: string) =>
    api.get(`/api/financial/${ticker}/quote`).then(r => r.data),
};

export const dcfApi = {
  calculate: (assumptions: DCFAssumptions) =>
    api.post('/api/dcf/calculate', { assumptions }).then(r => r.data),
  sensitivity: (assumptions: DCFAssumptions, waccOffsets: number[], tgrValues: number[]) =>
    api.post('/api/dcf/sensitivity', { assumptions, waccOffsets, tgrValues }).then(r => r.data),
  scenarios: (baseRevenue: number, scenarios: any[], cash: number, debt: number, sharesOutstanding: number) =>
    api.post('/api/dcf/scenarios', { baseRevenue, scenarios, cash, debt, sharesOutstanding }).then(r => r.data),
  save: (payload: any) =>
    api.post('/api/dcf/save', payload).then(r => r.data),
  getRecent: () =>
    api.get('/api/dcf/recent').then(r => r.data),
};
