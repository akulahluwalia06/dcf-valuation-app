import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useDCFStore } from '../../store/useDCFStore';
import { financialApi } from '../../services/api';
import { calculateDCF, calculateSensitivityGrid, fmt$, fmtPct, fmtM, getSensitivityBg, getSensitivityColor } from '../../utils/dcfEngine';
import { DCFAssumptions, FinancialSnapshot } from '../../types/dcf';
import Slider from '../../components/ui/Slider';
import BarChart from '../../components/charts/BarChart';

const FISCAL_YEARS = ['Yr 1', 'Yr 2', 'Yr 3', 'Yr 4', 'Yr 5', 'Yr 6', 'Yr 7'];
const WACC_OFFSETS = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02];
const TGR_VALUES   = [0.01, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
const isWide = Platform.OS === 'web';

export default function DCFToolScreen() {
  const { ticker, snapshot, snapshotLoading, snapshotError,
    setTicker, setSnapshot, setSnapshotLoading, setSnapshotError, reset } = useDCFStore();

  const [inputTicker, setInputTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'sensitivity'>('inputs');

  // Live slider assumptions
  const [phase1Growth, setPhase1Growth] = useState(0.12);
  const [phase2Growth, setPhase2Growth] = useState(0.08);
  const [tgr, setTgr]       = useState(0.03);
  const [wacc, setWacc]     = useState(0.10);
  const [ebitM, setEbitM]   = useState(0.20);
  const [exitMult, setExitMult] = useState(20);
  const [cash, setCash]     = useState(0);
  const [debt, setDebt]     = useState(0);
  const [shares, setShares] = useState(1);
  const [baseRev, setBaseRev] = useState(0);

  // Fixed ranges — set once when snapshot loads, never change while sliding
  const [revRange, setRevRange]       = useState({ min: 1, max: 1000, step: 10 });
  const [cashRange, setCashRange]     = useState({ min: 0, max: 1000, step: 10 });
  const [debtRange, setDebtRange]     = useState({ min: 0, max: 1000, step: 10 });
  const [sharesRange, setSharesRange] = useState({ min: 1, max: 100, step: 1 });

  function applySnapshot(snap: FinancialSnapshot) {
    const s = snap.snapshot;
    const rev   = s.revenue / 1e6;
    const cash0 = s.cash / 1e6;
    const debt0 = s.totalDebt / 1e6;
    const sh0   = s.sharesOutstanding / 1e6;
    setBaseRev(rev);
    setEbitM(Math.max(s.ebitMargin, 0.05));
    setCash(cash0);
    setDebt(debt0);
    setShares(sh0);
    setPhase1Growth(0.12);
    setPhase2Growth(0.08);
    setTgr(0.03);
    setWacc(0.10);
    setExitMult(20);
    setRevRange({   min: Math.max(rev * 0.3, 1), max: Math.max(rev * 3, 100), step: Math.max(rev * 0.01, 1) });
    setCashRange({  min: 0, max: Math.max(cash0 * 3, rev * 0.5, 1000), step: Math.max(rev * 0.005, 10) });
    setDebtRange({  min: 0, max: Math.max(debt0 * 3, rev * 0.5, 1000), step: Math.max(rev * 0.005, 10) });
    setSharesRange({ min: Math.max(sh0 * 0.5, 1), max: Math.max(sh0 * 2, 100), step: Math.max(sh0 * 0.01, 1) });
  }

  // Sync sliders when snapshot loads
  useEffect(() => {
    if (!snapshot) return;
    applySnapshot(snapshot);
  }, [snapshot]);

  const [resetting, setResetting] = useState(false);
  async function handleReset() {
    if (!ticker) return;
    setResetting(true);
    try {
      // Clear cache by forcing a fresh fetch — bust MongoDB TTL via reload
      const snap: FinancialSnapshot = await financialApi.getSnapshot(ticker);
      setSnapshot(snap);
      applySnapshot(snap);
    } catch (e: any) {
      setSnapshotError(e.message);
    } finally {
      setResetting(false);
    }
  }

  const assumptions: DCFAssumptions = useMemo(() => ({
    baseRevenue: baseRev,
    revGrowthRates: [phase1Growth, phase1Growth, phase1Growth, phase2Growth, phase2Growth, phase2Growth, phase2Growth],
    ebitMargin: ebitM,
    taxRate: 0.21,
    grossMargin: snapshot?.snapshot.grossMargin || 0.60,
    daPercent: snapshot?.snapshot.daPercent || 0.04,
    capexPercent: snapshot?.snapshot.capexPercent || 0.03,
    nwcPercent: -0.05,
    wacc,
    terminalGrowthRate: tgr,
    exitMultiple: exitMult,
    cash,
    debt,
    sharesOutstanding: shares,
  }), [phase1Growth, phase2Growth, tgr, wacc, ebitM, exitMult, cash, debt, shares, baseRev, snapshot]);

  const result = useMemo(() => {
    if (!baseRev || !shares) return null;
    return calculateDCF(assumptions);
  }, [assumptions, baseRev, shares]);

  const sensGrid = useMemo(() => {
    if (!result) return [];
    return calculateSensitivityGrid(assumptions, WACC_OFFSETS, TGR_VALUES, snapshot?.currentPrice || 0);
  }, [assumptions, result, snapshot]);

  async function handleSearch() {
    const t = inputTicker.trim().toUpperCase();
    if (!t) return;
    reset();
    setTicker(t);
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const snap: FinancialSnapshot = await financialApi.getSnapshot(t);
      setSnapshot(snap);
      setActiveTab('inputs');
    } catch (e: any) {
      setSnapshotError(e.message);
    } finally {
      setSnapshotLoading(false);
    }
  }

  const currentPrice = snapshot?.currentPrice || 0;
  const upside = result && currentPrice ? (result.intrinsicPerShare.blended - currentPrice) / currentPrice : null;
  const isUp = upside !== null && upside >= 0;

  const fcfBars = result?.projections.map((p, i) => ({
    label: `Y${i + 1}`,
    value: p.fcff,
    color: i < 3 ? '#E07000' : '#FF8C00',
  })) || [];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/')} activeOpacity={0.7}>
          <Text style={s.headerTitle}>DCF<Text style={{ color: '#FF8C00' }}>.</Text>TOOL</Text>
        </TouchableOpacity>
        <Text style={s.headerSub}>SEARCH ANY TICKER  ·  AUTO-POPULATE FROM LIVE FINANCIALS  ·  INSTANT RECALCULATION</Text>
      </View>

      {/* Search bar */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={inputTicker}
          onChangeText={(t: string) => setInputTicker(t.toUpperCase())}
          placeholder="AAPL  SHOP.TO  NVDA  RY.TO  TSLA  META..."
          placeholderTextColor="#7a4a00"
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={snapshotLoading}>
          {snapshotLoading
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={s.searchBtnText}>LOAD</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Quick picks */}
      {!snapshot && !snapshotLoading && (
        <View style={s.quickRow}>
          {['AAPL', 'MSFT', 'NVDA', 'SHOP.TO', 'META', 'RY.TO', 'AMZN'].map(t => (
            <TouchableOpacity key={t} style={s.quickChip} onPress={() => { setInputTicker(t); }}>
              <Text style={s.quickText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {snapshotError && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>⚠  {snapshotError}</Text>
        </View>
      )}

      {/* Company strip */}
      {snapshot && (
        <View style={s.companyStrip}>
          <View style={s.companyTickerBox}>
            <Text style={s.companyTicker}>{snapshot.ticker}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.companyName}>{snapshot.companyName}</Text>
            <Text style={s.companySub}>{snapshot.exchange}  ·  {snapshot.sector}</Text>
          </View>
          {currentPrice > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.priceLabel}>CURRENT</Text>
              <Text style={s.priceVal}>{fmt$(currentPrice, 2)}</Text>
            </View>
          )}
          {result && upside !== null && (
            <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
              <Text style={s.priceLabel}>INTRINSIC</Text>
              <Text style={[s.priceVal, { color: isUp ? '#FF8C00' : '#FF3B3B' }]}>
                {fmt$(result.intrinsicPerShare.blended, 2)}
              </Text>
            </View>
          )}
          <TouchableOpacity style={s.resetBtn} onPress={handleReset} disabled={resetting}>
            {resetting
              ? <ActivityIndicator size="small" color="#FF8C00" />
              : <Text style={s.resetBtnText}>↺ RESET</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Sub-tabs */}
      {snapshot && result && (
        <View style={s.subTabBar}>
          {(['inputs', 'results', 'sensitivity'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[s.subTab, activeTab === tab && s.subTabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.subTabText, activeTab === tab && s.subTabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state */}
      {!snapshot && !snapshotLoading && (
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>ENTER A TICKER TO BEGIN</Text>
          <Text style={s.emptySub}>Live financial data auto-fills all assumptions.{'\n'}Adjust sliders — DCF recalculates instantly.</Text>
        </View>
      )}

      {snapshotLoading && (
        <View style={s.emptyState}>
          <ActivityIndicator size="large" color="#FF8C00" />
          <Text style={[s.emptySub, { marginTop: 16 }]}>LOADING FINANCIAL DATA...</Text>
        </View>
      )}

      {/* Main content */}
      {snapshot && result && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {activeTab === 'inputs' && (
            <View style={isWide ? s.twoCol : {}}>
              {/* LEFT — sliders */}
              <View style={isWide ? s.leftPanel : {}}>
                <Panel title="BASE METRICS">
                  <Slider label={`BASE REVENUE ($M)  —  FY${snapshot.latestFiscalYear}`}
                    value={baseRev} min={revRange.min} max={revRange.max} step={revRange.step}
                    onChange={setBaseRev} formatValue={v => `$${v.toFixed(0)}M`}
                    parseValue={s => parseFloat(s.replace(/[^0-9.]/g, ''))} />
                  <Slider label="CASH & EQUIVALENTS ($M)"
                    value={cash} min={cashRange.min} max={cashRange.max} step={cashRange.step}
                    onChange={setCash} formatValue={v => `$${v.toFixed(0)}M`}
                    parseValue={s => parseFloat(s.replace(/[^0-9.]/g, ''))} />
                  <Slider label="TOTAL DEBT ($M)"
                    value={debt} min={debtRange.min} max={debtRange.max} step={debtRange.step}
                    onChange={setDebt} formatValue={v => `$${v.toFixed(0)}M`}
                    parseValue={s => parseFloat(s.replace(/[^0-9.]/g, ''))} />
                  <Slider label="DILUTED SHARES (M)"
                    value={shares} min={sharesRange.min} max={sharesRange.max} step={sharesRange.step}
                    onChange={setShares} formatValue={v => `${v.toFixed(0)}M`}
                    parseValue={s => parseFloat(s.replace(/[^0-9.]/g, ''))} />
                </Panel>

                <Panel title="GROWTH ASSUMPTIONS">
                  <Slider label="PHASE 1 GROWTH (YR 1–3)"
                    value={phase1Growth} min={0.02} max={0.50} step={0.005}
                    onChange={setPhase1Growth} formatValue={v => `${(v * 100).toFixed(1)}%`}
                    parseValue={s => parseFloat(s.replace('%','')) / 100} />
                  <Slider label="PHASE 2 GROWTH (YR 4–7)"
                    value={phase2Growth} min={0.01} max={0.30} step={0.005}
                    onChange={setPhase2Growth} formatValue={v => `${(v * 100).toFixed(1)}%`}
                    parseValue={s => parseFloat(s.replace('%','')) / 100} />
                  <Slider label="TERMINAL GROWTH RATE"
                    value={tgr} min={0.01} max={0.06} step={0.005}
                    onChange={setTgr} formatValue={v => `${(v * 100).toFixed(1)}%`}
                    parseValue={s => parseFloat(s.replace('%','')) / 100} />
                </Panel>

                <Panel title="DISCOUNT RATE & MARGINS">
                  <Slider label="WACC"
                    value={wacc} min={0.06} max={0.20} step={0.005}
                    onChange={setWacc} formatValue={v => `${(v * 100).toFixed(1)}%`}
                    parseValue={s => parseFloat(s.replace('%','')) / 100} />
                  <Slider label="EBIT MARGIN"
                    value={ebitM} min={0.02} max={0.60} step={0.01}
                    onChange={setEbitM} formatValue={v => `${(v * 100).toFixed(0)}%`}
                    parseValue={s => parseFloat(s.replace('%','')) / 100} />
                  <Slider label="EXIT EV/EBITDA MULTIPLE"
                    value={exitMult} min={5} max={60} step={1}
                    onChange={setExitMult} formatValue={v => `${v}x`}
                    parseValue={s => parseFloat(s.replace('x',''))} />
                </Panel>
              </View>

              {/* RIGHT — live output */}
              <View style={isWide ? s.rightPanel : { marginTop: 16 }}>
                {/* Intrinsic card */}
                <View style={[s.intrinsicCard, { borderColor: isUp ? '#FF8C00' : '#FF3B3B' }]}>
                  <Text style={s.intrinsicLabel}>INTRINSIC VALUE PER SHARE</Text>
                  <Text style={[s.intrinsicVal, { color: isUp ? '#FF8C00' : '#FF3B3B' }]}>
                    {fmt$(result.intrinsicPerShare.blended, 2)}
                  </Text>
                  <View style={s.methodRow}>
                    <View style={s.methodItem}>
                      <Text style={s.methodLabel}>GGM</Text>
                      <Text style={s.methodVal}>{fmt$(result.intrinsicPerShare.ggm, 2)}</Text>
                    </View>
                    <View style={s.methodItem}>
                      <Text style={s.methodLabel}>EXIT MULT.</Text>
                      <Text style={s.methodVal}>{fmt$(result.intrinsicPerShare.exit, 2)}</Text>
                    </View>
                    <View style={s.methodItem}>
                      <Text style={s.methodLabel}>BLENDED</Text>
                      <Text style={[s.methodVal, { color: isUp ? '#FF8C00' : '#FF3B3B' }]}>
                        {fmt$(result.intrinsicPerShare.blended, 2)}
                      </Text>
                    </View>
                  </View>
                  {currentPrice > 0 && upside !== null && (
                    <View style={[s.upsideBadge, { borderColor: isUp ? '#FF8C00' : '#FF3B3B', backgroundColor: isUp ? '#FF8C0011' : '#FF3B3B11' }]}>
                      <Text style={[s.upsideText, { color: isUp ? '#FF8C00' : '#FF3B3B' }]}>
                        {isUp ? '▲' : '▼'} {fmtPct(Math.abs(upside))} vs {fmt$(currentPrice, 2)}  ·  {isUp ? 'UPSIDE' : 'DOWNSIDE'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* KPI grid */}
                <View style={s.kpiGrid}>
                  <KPI label="PV OF FCFS (7YR)"    val={fmtM(result.pvFCFFs)} />
                  <KPI label="PV TERMINAL VALUE"    val={fmtM(result.terminalValues.pvBlended)} />
                  <KPI label="ENTERPRISE VALUE"     val={fmtM(result.enterpriseValue.blended)} />
                  <KPI label="EQUITY VALUE"         val={fmtM(result.equityValue.blended)} accent />
                </View>

                {/* TV bar */}
                <Panel title="TERMINAL VALUE AS % OF EV">
                  <View style={s.tvBar}>
                    <View style={[s.tvFill, { flex: Math.max(1 - result.tvAsPercentEV.ggm, 0.01), backgroundColor: '#E07000' }]} />
                    <View style={[s.tvFill, { flex: Math.max(result.tvAsPercentEV.ggm, 0.01), backgroundColor: '#FF8C00' }]} />
                  </View>
                  <View style={s.tvLabels}>
                    <Text style={s.tvLabel}>FCFs ({fmtPct(1 - result.tvAsPercentEV.ggm, 0)})</Text>
                    <Text style={s.tvLabel}>Terminal ({fmtPct(result.tvAsPercentEV.ggm, 0)})</Text>
                  </View>
                </Panel>

                {/* FCF chart */}
                <Panel title="PROJECTED FREE CASH FLOWS">
                  <BarChart bars={fcfBars} height={100} />
                </Panel>

                {/* Year table */}
                <Panel title="YEAR-BY-YEAR SUMMARY">
                  <View style={s.tableHeader}>
                    {['Year', 'Revenue', 'FCF ($M)', 'PV ($M)'].map(h => (
                      <Text key={h} style={s.th}>{h}</Text>
                    ))}
                  </View>
                  {result.projections.map((p, i) => (
                    <View key={i} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? '#050505' : '#0d0d0d' }]}>
                      <Text style={s.td}>Yr {i + 1}</Text>
                      <Text style={s.td}>{fmtM(p.revenue)}</Text>
                      <Text style={[s.td, { color: '#FF8C00' }]}>{fmtM(p.fcff)}</Text>
                      <Text style={s.td}>{fmtM(p.pvFcff)}</Text>
                    </View>
                  ))}
                </Panel>
              </View>
            </View>
          )}

          {activeTab === 'results' && (
            <Panel title="FULL RESULTS">
              {[
                { label: 'Intrinsic — GGM', val: fmt$(result.intrinsicPerShare.ggm, 2) },
                { label: 'Intrinsic — Exit Multiple', val: fmt$(result.intrinsicPerShare.exit, 2) },
                { label: 'Intrinsic — Blended', val: fmt$(result.intrinsicPerShare.blended, 2), accent: true },
                ...(currentPrice ? [{ label: 'Implied Upside / (Downside)', val: fmtPct(upside!), accent: false }] : []),
                { label: 'PV of FCFFs', val: fmtM(result.pvFCFFs) },
                { label: 'PV Terminal Value (GGM)', val: fmtM(result.terminalValues.pvGGM) },
                { label: 'PV Terminal Value (Exit)', val: fmtM(result.terminalValues.pvExit) },
                { label: 'Enterprise Value (Blended)', val: fmtM(result.enterpriseValue.blended), bold: true },
                { label: '+ Cash', val: fmtM(cash) },
                { label: '− Debt', val: fmtM(debt) },
                { label: 'Equity Value (Blended)', val: fmtM(result.equityValue.blended), bold: true },
                { label: 'TV as % of EV (GGM)', val: fmtPct(result.tvAsPercentEV.ggm) },
                { label: 'TV as % of EV (Exit)', val: fmtPct(result.tvAsPercentEV.exit) },
              ].map((row: any, i) => (
                <View key={i} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#050505' : '#0d0d0d' }]}>
                  <Text style={[s.simpleLabel, row.bold && { color: '#CCC' }, row.accent && { color: '#FF8C00' }]}>{row.label}</Text>
                  <Text style={[s.simpleVal, row.bold && { fontWeight: '700' }, row.accent && { color: '#FF8C00', fontSize: 20 }]}>{row.val}</Text>
                </View>
              ))}
            </Panel>
          )}

          {activeTab === 'sensitivity' && (
            <Panel title="SENSITIVITY  —  WACC × TERMINAL GROWTH RATE">
              <Text style={{ color: '#CBD5E1', fontSize: 17, marginBottom: 12, fontFamily: 'monospace' }}>
                Green = upside  ·  Yellow = neutral  ·  Red = downside  {currentPrice ? `vs ${fmt$(currentPrice, 2)}` : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[tr.row, { backgroundColor: '#1a0800' }]}>
                    <Text style={[tr.sensCell, { color: '#FF8C00', fontWeight: '700', width: 80 }]}>WACC\TGR</Text>
                    {TGR_VALUES.map(t => <Text key={t} style={[tr.sensCell, { color: '#FF8C00' }]}>{fmtPct(t)}</Text>)}
                  </View>
                  {sensGrid.map((row: any, wi: number) => (
                    <View key={wi} style={tr.row}>
                      <Text style={[tr.sensCell, { color: '#FF8C00', fontWeight: '700', width: 80, backgroundColor: '#1a0800' }]}>{fmtPct(row.wacc)}</Text>
                      {row.values.map((cell: any, ti: number) => (
                        <View key={ti} style={[tr.sensCell, { backgroundColor: getSensitivityBg(cell.delta), justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: getSensitivityColor(cell.delta), fontSize: 17, fontWeight: '700' }}>{fmt$(cell.price, 0)}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </Panel>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={p.panel}>
      <View style={p.titleRow}>
        <View style={p.dot} />
        <Text style={p.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function KPI({ label, val, accent }: { label: string; val: string; accent?: boolean }) {
  return (
    <View style={[k.card, accent && { borderColor: '#FF8C0044' }]}>
      <Text style={k.label}>{label}</Text>
      <Text style={[k.val, accent && { color: '#FF8C00' }]}>{val}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#FF8C0022', zIndex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace' },
  headerSub: { color: '#aa7a3a', fontSize: 16, letterSpacing: 1, marginTop: 4, fontFamily: 'monospace' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#000', zIndex: 1, borderBottomWidth: 1, borderBottomColor: '#FF8C0011' },
  searchInput: { flex: 1, backgroundColor: '#050505', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#FF8C00', fontSize: 22, borderWidth: 1, borderColor: '#FF8C0033', fontFamily: 'monospace', letterSpacing: 2 },
  searchBtn: { backgroundColor: '#FF8C00', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  searchBtnText: { color: '#000', fontWeight: '800', fontSize: 16, letterSpacing: 1.5, fontFamily: 'monospace' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, zIndex: 1 },
  quickChip: { backgroundColor: '#050505', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FF8C0033' },
  quickText: { color: '#E07000', fontWeight: '700', fontSize: 22, fontFamily: 'monospace' },
  errorBox: { backgroundColor: '#1a0000', margin: 12, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#FF3B3B44', zIndex: 1 },
  errorText: { color: '#FF3B3B', fontSize: 16, fontFamily: 'monospace' },
  companyStrip: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: '#FF8C0022', zIndex: 1, gap: 12 },
  companyTickerBox: { backgroundColor: '#1a0800', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FF8C0033' },
  companyTicker: { color: '#FF8C00', fontWeight: '800', fontSize: 17, fontFamily: 'monospace' },
  resetBtn: { marginLeft: 8, borderWidth: 1, borderColor: '#FF8C0044', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  resetBtnText: { color: '#FF8C00', fontSize: 17, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  companyName: { color: '#CBD5E1', fontSize: 16, fontWeight: '600' },
  companySub: { color: '#CBD5E1', fontSize: 17, marginTop: 2 },
  priceLabel: { color: '#CBD5E1', fontSize: 22, letterSpacing: 1.5, fontFamily: 'monospace' },
  priceVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
  subTabBar: { flexDirection: 'row', backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#FF8C0022', zIndex: 1 },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: '#FF8C00' },
  subTabText: { color: '#aa7a3a', fontSize: 22, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
  subTabTextActive: { color: '#FF8C00' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 1 },
  emptyTitle: { color: '#FF8C00', fontSize: 16, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 12 },
  emptySub: { color: '#aa7a3a', fontSize: 22, textAlign: 'center', lineHeight: 20, fontFamily: 'monospace' },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  twoCol: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  leftPanel: { flex: 1, gap: 16, maxWidth: 420 },
  rightPanel: { flex: 1.4, gap: 16 },
  intrinsicCard: { backgroundColor: '#050505', borderWidth: 1.5, borderRadius: 12, padding: 20, marginBottom: 0 },
  intrinsicLabel: { color: '#CBD5E1', fontSize: 16, letterSpacing: 2, fontFamily: 'monospace', marginBottom: 6 },
  intrinsicVal: { fontSize: 48, fontWeight: '800', fontFamily: 'monospace', lineHeight: 56 },
  methodRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#0d0d0d' },
  methodItem: { alignItems: 'center' },
  methodLabel: { color: '#CBD5E1', fontSize: 22, letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 4 },
  methodVal: { color: '#CBD5E1', fontSize: 17, fontWeight: '700', fontFamily: 'monospace' },
  upsideBadge: { marginTop: 14, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  upsideText: { fontSize: 22, fontWeight: '700', fontFamily: 'monospace' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tvBar: { height: 14, flexDirection: 'row', borderRadius: 4, overflow: 'hidden', backgroundColor: '#111' },
  tvFill: { height: '100%' },
  tvLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tvLabel: { color: '#CBD5E1', fontSize: 16, fontFamily: 'monospace' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a0800', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4, marginBottom: 2 },
  th: { flex: 1, color: '#FF8C00', fontSize: 16, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10 },
  td: { flex: 1, color: '#CBD5E1', fontSize: 22, fontFamily: 'monospace' },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  simpleLabel: { color: '#CBD5E1', fontSize: 16, flex: 1 },
  simpleVal: { color: '#CBD5E1', fontSize: 16, fontWeight: '600', fontFamily: 'monospace' },
});

const p = StyleSheet.create({
  panel: { backgroundColor: '#050505', borderWidth: 1, borderColor: '#FF8C0015', borderRadius: 12, padding: 16, marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF8C00', marginRight: 8 },
  title: { color: '#FF8C00', fontSize: 16, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
});

const k = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', backgroundColor: '#080808', borderWidth: 1, borderColor: '#FF8C0033', borderRadius: 10, padding: 12 },
  label: { color: '#CBD5E1', fontSize: 22, letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4 },
  val: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
});

const tr = StyleSheet.create({
  row: { flexDirection: 'row' },
  sensCell: { width: 72, height: 40, paddingHorizontal: 4, fontSize: 22, textAlign: 'center' },
});
