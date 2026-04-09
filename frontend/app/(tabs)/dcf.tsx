import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useDCFStore } from '../../store/useDCFStore';
import { financialApi } from '../../services/api';
import { fmt$, fmtPct, fmtM, calculateSensitivityGrid, getSensitivityBg, getSensitivityColor } from '../../utils/dcfEngine';
import { DCFAssumptions, FinancialSnapshot } from '../../types/dcf';

const FISCAL_YEARS = ['Yr 1', 'Yr 2', 'Yr 3', 'Yr 4', 'Yr 5', 'Yr 6', 'Yr 7'];

const DEFAULT_ASSUMPTIONS: Omit<DCFAssumptions, 'baseRevenue' | 'cash' | 'debt' | 'sharesOutstanding'> = {
  revGrowthRates: [0.15, 0.13, 0.11, 0.10, 0.09, 0.08, 0.07],
  ebitMargin: 0.20,
  taxRate: 0.21,
  grossMargin: 0.65,
  daPercent: 0.04,
  capexPercent: 0.03,
  nwcPercent: -0.05,
  wacc: 0.10,
  terminalGrowthRate: 0.03,
  exitMultiple: 20,
};

export default function DCFToolScreen() {
  const { ticker, snapshot, assumptions, result, snapshotLoading, snapshotError,
    setTicker, setSnapshot, setAssumptions, updateAssumption, updateGrowthRate,
    setSnapshotLoading, setSnapshotError, reset } = useDCFStore();

  const [inputTicker, setInputTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'sensitivity'>('inputs');

  async function handleSearch() {
    if (!inputTicker.trim()) return;
    const t = inputTicker.trim().toUpperCase();
    reset();
    setTicker(t);
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const snap: FinancialSnapshot = await financialApi.getSnapshot(t);
      setSnapshot(snap);
      // Pre-populate assumptions from live data
      const auto: DCFAssumptions = {
        baseRevenue: snap.snapshot.revenue / 1e6, // convert to $M if needed
        revGrowthRates: DEFAULT_ASSUMPTIONS.revGrowthRates,
        ebitMargin: Math.max(snap.snapshot.ebitMargin, 0.05),
        taxRate: DEFAULT_ASSUMPTIONS.taxRate,
        grossMargin: snap.snapshot.grossMargin || DEFAULT_ASSUMPTIONS.grossMargin,
        daPercent: snap.snapshot.daPercent || DEFAULT_ASSUMPTIONS.daPercent,
        capexPercent: snap.snapshot.capexPercent || DEFAULT_ASSUMPTIONS.capexPercent,
        nwcPercent: DEFAULT_ASSUMPTIONS.nwcPercent,
        wacc: DEFAULT_ASSUMPTIONS.wacc,
        terminalGrowthRate: DEFAULT_ASSUMPTIONS.terminalGrowthRate,
        exitMultiple: DEFAULT_ASSUMPTIONS.exitMultiple,
        cash: snap.snapshot.cash / 1e6,
        debt: snap.snapshot.totalDebt / 1e6,
        sharesOutstanding: snap.snapshot.sharesOutstanding / 1e6,
      };
      setAssumptions(auto);
      setActiveTab('inputs');
    } catch (e: any) {
      setSnapshotError(e.message);
    } finally {
      setSnapshotLoading(false);
    }
  }

  const WACC_OFFSETS = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02];
  const TGR_VALUES   = [0.01, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
  const sensGrid = assumptions && result
    ? calculateSensitivityGrid(assumptions, WACC_OFFSETS, TGR_VALUES, snapshot?.currentPrice || 0)
    : [];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>DCF Tool</Text>
        <Text style={s.headerSub}>Auto-populate from live financial data · CFA FCFF methodology</Text>
      </View>

      {/* Ticker search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={inputTicker}
          onChangeText={t => setInputTicker(t.toUpperCase())}
          placeholder="Enter ticker (e.g. AAPL, MSFT, NVDA)"
          placeholderTextColor="#475569"
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={snapshotLoading}>
          {snapshotLoading
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={s.searchBtnText}>Load</Text>
          }
        </TouchableOpacity>
      </View>

      {snapshotError && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{snapshotError}</Text>
        </View>
      )}

      {/* Company info strip */}
      {snapshot && (
        <View style={s.companyStrip}>
          <View style={{ flex: 1 }}>
            <Text style={s.companyName}>{snapshot.companyName}</Text>
            <Text style={s.companySub}>{snapshot.exchange}  ·  {snapshot.sector}</Text>
          </View>
          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Price</Text>
            <Text style={s.priceVal}>{fmt$(snapshot.currentPrice, 2)}</Text>
          </View>
          {result && (
            <View style={[s.priceBox, { marginLeft: 16 }]}>
              <Text style={s.priceLabel}>Intrinsic</Text>
              <Text style={[s.priceVal, { color: result.intrinsicPerShare.blended >= snapshot.currentPrice ? '#10B981' : '#C0392B' }]}>
                {fmt$(result.intrinsicPerShare.blended, 2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {!snapshot && !snapshotLoading && (
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>Search any ticker to begin</Text>
          <Text style={s.emptySub}>Live financial data auto-fills assumptions. Adjust any input and the DCF recalculates instantly.</Text>
          {['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'].map(t => (
            <TouchableOpacity key={t} style={s.suggestionChip} onPress={() => { setInputTicker(t); }}>
              <Text style={s.suggestionText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {assumptions && result && (
        <>
          {/* Sub-tabs */}
          <View style={s.subTabBar}>
            {(['inputs', 'results', 'sensitivity'] as const).map(tab => (
              <TouchableOpacity key={tab} style={[s.subTab, activeTab === tab && s.subTabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[s.subTabText, activeTab === tab && s.subTabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={s.tabContent} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {activeTab === 'inputs' && <InputsTab assumptions={assumptions} updateAssumption={updateAssumption} updateGrowthRate={updateGrowthRate} snapshot={snapshot} />}
            {activeTab === 'results' && <ResultsTab result={result} assumptions={assumptions} currentPrice={snapshot?.currentPrice} />}
            {activeTab === 'sensitivity' && <SensTab grid={sensGrid} tgrValues={TGR_VALUES} currentPrice={snapshot?.currentPrice || 0} />}
          </ScrollView>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function InputsTab({ assumptions, updateAssumption, updateGrowthRate, snapshot }: any) {
  function NumInput({ label, value, field, isPercent, note }: { label: string; value: number; field: keyof DCFAssumptions; isPercent?: boolean; note?: string }) {
    const [local, setLocal] = useState(isPercent ? (value * 100).toFixed(2) : value.toString());
    return (
      <View style={si.row}>
        <View style={{ flex: 1 }}>
          <Text style={si.label}>{label}</Text>
          {note && <Text style={si.note}>{note}</Text>}
        </View>
        <TextInput
          style={si.input}
          value={local}
          onChangeText={setLocal}
          onBlur={() => {
            const parsed = parseFloat(local);
            if (!isNaN(parsed)) updateAssumption(field, isPercent ? parsed / 100 : parsed);
          }}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        {isPercent && <Text style={si.unit}>%</Text>}
      </View>
    );
  }

  return (
    <View>
      <SectionHeader title="REVENUE BUILD" />
      <NumInput label="Base Revenue ($M)" value={assumptions.baseRevenue} field="baseRevenue" note="Most recent fiscal year" />
      <Text style={si.subHeader}>Revenue Growth Rate — 7-Year Projection</Text>
      {FISCAL_YEARS.map((yr, i) => {
        const [local, setLocal] = useState((assumptions.revGrowthRates[i] * 100).toFixed(1));
        return (
          <View key={yr} style={si.row}>
            <Text style={[si.label, { flex: 1 }]}>{yr} Growth</Text>
            <TextInput
              style={si.input}
              value={local}
              onChangeText={setLocal}
              onBlur={() => { const p = parseFloat(local); if (!isNaN(p)) updateGrowthRate(i, p / 100); }}
              keyboardType="decimal-pad"
            />
            <Text style={si.unit}>%</Text>
          </View>
        );
      })}

      <SectionHeader title="INCOME STATEMENT" style={{ marginTop: 16 }} />
      <NumInput label="EBIT Margin" value={assumptions.ebitMargin} field="ebitMargin" isPercent note="Non-GAAP adj. operating margin" />
      <NumInput label="Tax Rate" value={assumptions.taxRate} field="taxRate" isPercent />
      <NumInput label="Gross Margin" value={assumptions.grossMargin} field="grossMargin" isPercent />

      <SectionHeader title="CASH FLOW ADJUSTMENTS" style={{ marginTop: 16 }} />
      <NumInput label="D&A (% of Revenue)" value={assumptions.daPercent} field="daPercent" isPercent />
      <NumInput label="CapEx (% of Revenue)" value={assumptions.capexPercent} field="capexPercent" isPercent />
      <NumInput label="NWC (% of Revenue)" value={assumptions.nwcPercent} field="nwcPercent" isPercent note="Negative = deferred revenue advantage" />

      <SectionHeader title="DISCOUNT RATE & TERMINAL" style={{ marginTop: 16 }} />
      <NumInput label="WACC" value={assumptions.wacc} field="wacc" isPercent />
      <NumInput label="Terminal Growth Rate" value={assumptions.terminalGrowthRate} field="terminalGrowthRate" isPercent />
      <NumInput label="Exit EV/EBITDA Multiple" value={assumptions.exitMultiple} field="exitMultiple" />

      <SectionHeader title="BRIDGE INPUTS" style={{ marginTop: 16 }} />
      <NumInput label="Cash & Equivalents ($M)" value={assumptions.cash} field="cash" />
      <NumInput label="Total Debt ($M)" value={assumptions.debt} field="debt" />
      <NumInput label="Diluted Shares (M)" value={assumptions.sharesOutstanding} field="sharesOutstanding" />
    </View>
  );
}

function ResultsTab({ result, assumptions, currentPrice }: any) {
  const upside = currentPrice ? (result.intrinsicPerShare.blended - currentPrice) / currentPrice : null;
  return (
    <View>
      {/* Key outputs */}
      <SectionHeader title="INTRINSIC VALUE" />
      {[
        { label: 'Gordon Growth Model', val: fmt$(result.intrinsicPerShare.ggm, 2) },
        { label: 'EV/EBITDA Exit Multiple', val: fmt$(result.intrinsicPerShare.exit, 2) },
        { label: 'Blended 50/50 (Base)', val: fmt$(result.intrinsicPerShare.blended, 2), highlight: true },
        ...(currentPrice ? [{ label: 'Implied Upside / (Downside)', val: fmtPct(upside!), color: upside! >= 0 ? '#10B981' : '#C0392B' }] : []),
      ].map((row: any, i) => (
        <View key={i} style={[s.simpleRow, { backgroundColor: row.highlight ? '#0EA5E911' : i % 2 === 0 ? '#0F1923' : '#162232' }]}>
          <Text style={[s.simpleLabel, row.highlight && { color: '#0EA5E9' }]}>{row.label}</Text>
          <Text style={[s.simpleVal, row.color && { color: row.color }, row.highlight && { color: '#0EA5E9', fontWeight: '800', fontSize: 18 }]}>{row.val}</Text>
        </View>
      ))}

      <SectionHeader title="ENTERPRISE VALUE BRIDGE" style={{ marginTop: 16 }} />
      {[
        { label: 'PV of FCFFs (7 years)', val: fmtM(result.pvFCFFs) },
        { label: 'PV Terminal Value (GGM)', val: fmtM(result.terminalValues.pvGGM) },
        { label: 'PV Terminal Value (Exit)', val: fmtM(result.terminalValues.pvExit) },
        { label: 'Enterprise Value (Blended)', val: fmtM(result.enterpriseValue.blended), bold: true },
        { label: '(+) Cash', val: fmtM(assumptions.cash) },
        { label: '(−) Debt', val: fmtM(assumptions.debt) },
        { label: 'Equity Value (Blended)', val: fmtM(result.equityValue.blended), bold: true },
        { label: 'TV as % of EV (GGM)', val: fmtPct(result.tvAsPercentEV.ggm) },
        { label: 'TV as % of EV (Exit)', val: fmtPct(result.tvAsPercentEV.exit) },
      ].map((row: any, i) => (
        <View key={i} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#0F1923' : '#162232' }]}>
          <Text style={[s.simpleLabel, row.bold && { color: '#E2E8F0', fontWeight: '600' }]}>{row.label}</Text>
          <Text style={[s.simpleVal, row.bold && { fontWeight: '700' }]}>{row.val}</Text>
        </View>
      ))}

      <SectionHeader title="YEAR-BY-YEAR PROJECTIONS" style={{ marginTop: 16 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[tr.row, { backgroundColor: '#1E3A5F' }]}>
            <Text style={[tr.cell, tr.label, { color: '#94A3B8' }]}>Metric</Text>
            {FISCAL_YEARS.map(y => <Text key={y} style={[tr.cell, { color: '#FFF', fontWeight: '700', textAlign: 'center' }]}>{y}</Text>)}
          </View>
          {[
            { label: 'Revenue ($M)', key: 'revenue', fmt: (v: number) => (v).toFixed(0) },
            { label: 'EBIT ($M)', key: 'ebit', fmt: (v: number) => v.toFixed(0) },
            { label: 'FCFF ($M)', key: 'fcff', fmt: (v: number) => v.toFixed(0), bold: true },
            { label: 'FCF Margin', key: 'fcfMargin', fmt: fmtPct },
            { label: 'PV FCFF ($M)', key: 'pvFcff', fmt: (v: number) => v.toFixed(0), bold: true },
          ].map((row, ri) => (
            <View key={row.label} style={[tr.row, { backgroundColor: ri % 2 === 0 ? '#0F1923' : '#162232' }]}>
              <Text style={[tr.cell, tr.label, row.bold && { color: '#0EA5E9' }]}>{row.label}</Text>
              {result.projections.map((p: any, i: number) => (
                <Text key={i} style={[tr.cell, row.bold && { color: '#0EA5E9', fontWeight: '700' }]}>{row.fmt(p[row.key])}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SensTab({ grid, tgrValues, currentPrice }: { grid: any[]; tgrValues: number[]; currentPrice: number }) {
  if (!grid.length) return <Text style={{ color: '#64748B', padding: 16 }}>Load a ticker to see sensitivity analysis.</Text>;
  return (
    <View>
      <SectionHeader title="WACC × TERMINAL GROWTH RATE  (Blended / Share)" />
      <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 10 }}>
        Green &gt; +20%  ·  Yellow ±10%  ·  Red &lt; −10%  {currentPrice ? `vs $${currentPrice.toFixed(0)}` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[tr.row, { backgroundColor: '#1E3A5F' }]}>
            <Text style={[tr.sensCell, { color: '#94A3B8', fontWeight: '700', width: 80 }]}>WACC\TGR</Text>
            {tgrValues.map(t => <Text key={t} style={[tr.sensCell, { color: '#94A3B8', fontWeight: '600' }]}>{fmtPct(t)}</Text>)}
          </View>
          {grid.map((row, wi) => (
            <View key={wi} style={tr.row}>
              <Text style={[tr.sensCell, { color: '#0EA5E9', fontWeight: '700', width: 80, backgroundColor: '#162232' }]}>{fmtPct(row.wacc)}</Text>
              {row.values.map((cell: any, ti: number) => (
                <View key={ti} style={[tr.sensCell, { backgroundColor: getSensitivityBg(cell.delta), justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: getSensitivityColor(cell.delta), fontSize: 11, fontWeight: '600' }}>{fmt$(cell.price, 0)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, style }: { title: string; style?: any }) {
  return (
    <View style={[{ backgroundColor: '#1E3A5F', padding: 10, borderRadius: 8, marginBottom: 8 }, style]}>
      <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{title}</Text>
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  label: { color: '#94A3B8', fontSize: 13 },
  note: { color: '#475569', fontSize: 10, marginTop: 2 },
  subHeader: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#E8F0FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 90, textAlign: 'right', color: '#1155CC', fontWeight: '700', fontSize: 13 },
  unit: { color: '#64748B', fontSize: 12, marginLeft: 4, width: 16 },
});

const tr = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { width: 90, paddingHorizontal: 8, paddingVertical: 8, color: '#E2E8F0', fontSize: 12, textAlign: 'right' },
  label: { width: 160, textAlign: 'left', color: '#94A3B8', fontWeight: '500' },
  sensCell: { width: 72, height: 40, paddingHorizontal: 4, paddingVertical: 6, fontSize: 12, textAlign: 'center' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1B2A' },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: '#0F1923', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#64748B', fontSize: 11, marginTop: 3 },
  searchRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#0F1923' },
  searchInput: { flex: 1, backgroundColor: '#162232', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#1B2A3B' },
  searchBtn: { backgroundColor: '#0EA5E9', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  searchBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  errorBox: { backgroundColor: '#C0392B22', margin: 12, borderRadius: 10, padding: 12 },
  errorText: { color: '#C0392B', fontSize: 13 },
  companyStrip: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#162232', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  companyName: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  companySub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceLabel: { color: '#64748B', fontSize: 10 },
  priceVal: { color: '#0EA5E9', fontSize: 18, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', padding: 32, paddingTop: 48 },
  emptyTitle: { color: '#E2E8F0', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  suggestionChip: { backgroundColor: '#162232', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1B2A3B' },
  suggestionText: { color: '#0EA5E9', fontWeight: '700' },
  subTabBar: { flexDirection: 'row', backgroundColor: '#0F1923', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: '#0EA5E9' },
  subTabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  subTabTextActive: { color: '#0EA5E9' },
  tabContent: { flex: 1 },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  simpleLabel: { color: '#94A3B8', fontSize: 13, flex: 1 },
  simpleVal: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
});
