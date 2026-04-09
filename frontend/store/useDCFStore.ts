import { create } from 'zustand';
import { DCFAssumptions, DCFResult, PANWModel, FinancialSnapshot } from '../types/dcf';
import { calculateDCF } from '../utils/dcfEngine';

interface DCFStore {
  // PANW model
  panwModel: PANWModel | null;
  panwLoading: boolean;
  panwError: string | null;
  setPanwModel: (model: PANWModel) => void;
  setPanwLoading: (v: boolean) => void;
  setPanwError: (e: string | null) => void;

  // Generic DCF tool
  ticker: string;
  snapshot: FinancialSnapshot | null;
  assumptions: DCFAssumptions | null;
  result: DCFResult | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  setTicker: (t: string) => void;
  setSnapshot: (s: FinancialSnapshot) => void;
  setAssumptions: (a: DCFAssumptions) => void;
  updateAssumption: <K extends keyof DCFAssumptions>(key: K, value: DCFAssumptions[K]) => void;
  updateGrowthRate: (index: number, value: number) => void;
  recalculate: () => void;
  setSnapshotLoading: (v: boolean) => void;
  setSnapshotError: (e: string | null) => void;
  reset: () => void;
}

export const useDCFStore = create<DCFStore>((set, get) => ({
  panwModel: null,
  panwLoading: false,
  panwError: null,
  setPanwModel: (model) => set({ panwModel: model }),
  setPanwLoading: (v) => set({ panwLoading: v }),
  setPanwError: (e) => set({ panwError: e }),

  ticker: '',
  snapshot: null,
  assumptions: null,
  result: null,
  snapshotLoading: false,
  snapshotError: null,

  setTicker: (t) => set({ ticker: t.toUpperCase() }),
  setSnapshot: (s) => set({ snapshot: s }),

  setAssumptions: (a) => {
    set({ assumptions: a, result: calculateDCF(a) });
  },

  updateAssumption: (key, value) => {
    const prev = get().assumptions;
    if (!prev) return;
    const updated = { ...prev, [key]: value };
    set({ assumptions: updated, result: calculateDCF(updated) });
  },

  updateGrowthRate: (index, value) => {
    const prev = get().assumptions;
    if (!prev) return;
    const rates = [...prev.revGrowthRates];
    rates[index] = value;
    const updated = { ...prev, revGrowthRates: rates };
    set({ assumptions: updated, result: calculateDCF(updated) });
  },

  recalculate: () => {
    const a = get().assumptions;
    if (a) set({ result: calculateDCF(a) });
  },

  setSnapshotLoading: (v) => set({ snapshotLoading: v }),
  setSnapshotError: (e) => set({ snapshotError: e }),

  reset: () => set({ ticker: '', snapshot: null, assumptions: null, result: null, snapshotError: null }),
}));
