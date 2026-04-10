import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { useDCFStore } from '../../store/useDCFStore';
import { panwApi } from '../../services/api';
import { calculateDCF, fmt$, fmtPct, fmtM, calculateSensitivityGrid, getSensitivityBg, getSensitivityColor } from '../../utils/dcfEngine';
import { DCFAssumptions } from '../../types/dcf';
import Slider from '../../components/ui/Slider';
import BarChart from '../../components/charts/BarChart';
import AnimatedBackground from '../../components/ui/AnimatedBackground';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isWide = isWeb;

// ── Base PANW assumptions ──────────────────────────────────
const BASE: DCFAssumptions = {
  baseRevenue: 9222,
  revGrowthRates: [0.16, 0.16, 0.16, 0.10, 0.10, 0.10, 0.10],
  ebitMargin: 0.28,
  taxRate: 0.20,
  grossMargin: 0.745,
  daPercent: 0.038,
  capexPercent: 0.025,
  nwcPercent: -0.18,
  wacc: 0.095,
  terminalGrowthRate: 0.035,
  exitMultiple: 30,
  cash: 3100,
  debt: 0,
  sharesOutstanding: 697,
};

const TABS = ['Model', 'DCF Engine', 'WACC', 'Sensitivity', 'Scenarios', 'Bridge'];
const CURRENT_PRICE = 190;

export default function PANWScreen() {
  const { panwModel, panwLoading, panwError, setPanwModel, setPanwLoading, setPanwError } = useDCFStore();
  const [activeTab, setActiveTab] = useState(0);

  // Local live assumptions (sliders)
  const [phase1Growth, setPhase1Growth] = useState(0.16);
  const [phase2Growth, setPhase2Growth] = useState(0.10);
  const [tgr, setTgr]         = useState(0.035);
  const [wacc, setWacc]       = useState(0.095);
  const [ebitM, setEbitM]     = useState(0.28);
  const [exitMult, setExitMult] = useState(30);
  const [cash, setCash]       = useState(3100);
  const [shares, setShares]   = useState(697);

  // Build live assumptions from sliders
  const liveAssumptions: DCFAssumptions = useMemo(() => ({
    ...BASE,
    revGrowthRates: [phase1Growth, phase1Growth, phase1Growth, phase2Growth, phase2Growth, phase2Growth, phase2Growth],
    ebitMargin: ebitM,
    wacc,
    terminalGrowthRate: tgr,
    exitMultiple: exitMult,
    cash,
    sharesOutstanding: shares,
  }), [phase1Growth, phase2Growth, tgr, wacc, ebitM, exitMult, cash, shares]);

  const result = useMemo(() => calculateDCF(liveAssumptions), [liveAssumptions]);

  async function load() {
    setPanwLoading(true);
    setPanwError(null);
    try {
      const model = await panwApi.getModel();
      setPanwModel(model);
    } catch (e: any) {
      setPanwError(e.message);
    } finally {
      setPanwLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const upside = (result.intrinsicPerShare.blended - CURRENT_PRICE) / CURRENT_PRICE;
  const isUp = upside >= 0;

  const fcfBars = result.projections.map((p, i) => ({
    label: `Y${i + 1}`,
    value: p.fcff,
    color: i < 3 ? '#00C851' : '#00FF80',
  }));

  const WACC_OFFSETS = [-0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015];
  const TGR_VALUES   = [0.020, 0.025, 0.030, 0.035, 0.040, 0.045, 0.050];
  const sensGrid = useMemo(
    () => calculateSensitivityGrid(liveAssumptions, WACC_OFFSETS, TGR_VALUES, CURRENT_PRICE),
    [liveAssumptions]
  );

  return (
    <View style={s.root}>
      <AnimatedBackground />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.ticker}>PANW</Text>
          <Text style={s.company}> PALO ALTO NETWORKS</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.headerLabel}>DCF / FCF VALUATION MODEL</Text>
          <Text style={s.headerDate}>FEB 17, 2026  ·  EARNINGS DAY</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === i && s.tabActive]} onPress={() => setActiveTab(i)}>
            <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {activeTab === 0 && (
          <View style={isWide ? s.twoCol : s.oneCol}>
            {/* LEFT — Inputs */}
            <View style={isWide ? s.leftPanel : s.fullPanel}>
              <Panel title="BASE METRICS">
                <Slider label="BASE REVENUE (FY2025, $M)" value={BASE.baseRevenue} min={7000} max={12000} step={100}
                  onChange={() => {}} formatValue={v => `$${v.toLocaleString()}M`} />
                <Slider label="CASH & EQUIVALENTS ($M)" value={cash} min={0} max={8000} step={100}
                  onChange={setCash} formatValue={v => `$${v.toLocaleString()}M`} />
                <Slider label="DILUTED SHARES (M)" value={shares} min={600} max={900} step={1}
                  onChange={setShares} formatValue={v => `${v}M`} />
              </Panel>

              <Panel title="GROWTH ASSUMPTIONS">
                <Slider label="PHASE 1 GROWTH (YR 1–3)" value={phase1Growth} min={0.05} max={0.35} step={0.005}
                  onChange={setPhase1Growth} formatValue={v => `${(v * 100).toFixed(1)}%`} />
                <Slider label="PHASE 2 GROWTH (YR 4–7)" value={phase2Growth} min={0.03} max={0.25} step={0.005}
                  onChange={setPhase2Growth} formatValue={v => `${(v * 100).toFixed(1)}%`} />
                <Slider label="TERMINAL GROWTH RATE" value={tgr} min={0.015} max={0.06} step={0.005}
                  onChange={setTgr} formatValue={v => `${(v * 100).toFixed(1)}%`} />
              </Panel>

              <Panel title="DISCOUNT RATE & MARGINS">
                <Slider label="WACC" value={wacc} min={0.07} max={0.14} step={0.005}
                  onChange={setWacc} formatValue={v => `${(v * 100).toFixed(1)}%`} />
                <Slider label="EBIT MARGIN (NON-GAAP)" value={ebitM} min={0.15} max={0.45} step={0.01}
                  onChange={setEbitM} formatValue={v => `${(v * 100).toFixed(0)}%`} />
                <Slider label="EXIT EV/EBITDA MULTIPLE" value={exitMult} min={15} max={50} step={1}
                  onChange={setExitMult} formatValue={v => `${v}x`} />
              </Panel>
            </View>

            {/* RIGHT — Output */}
            <View style={isWide ? s.rightPanel : s.fullPanel}>
              {/* Main intrinsic card */}
              <View style={[s.intrinsicCard, { borderColor: isUp ? '#00FF80' : '#FF3B3B' }]}>
                <Text style={s.intrinsicLabel}>INTRINSIC VALUE PER SHARE</Text>
                <Text style={[s.intrinsicValue, { color: isUp ? '#00FF80' : '#FF3B3B' }]}>
                  {fmt$(result.intrinsicPerShare.blended, 2)}
                </Text>
                <View style={[s.upsideBadge, { backgroundColor: isUp ? '#00FF8022' : '#FF3B3B22', borderColor: isUp ? '#00FF80' : '#FF3B3B' }]}>
                  <Text style={[s.upsideText, { color: isUp ? '#00FF80' : '#FF3B3B' }]}>
                    {isUp ? '▲' : '▼'} {fmtPct(Math.abs(upside))} vs ${CURRENT_PRICE}  ·  {isUp ? 'UPSIDE' : 'DOWNSIDE'} TO CURRENT
                  </Text>
                </View>
              </View>

              {/* KPI grid */}
              <View style={s.kpiGrid}>
                <KPICard label="PV OF FCFS (7YR)"    val={fmtM(result.pvFCFFs)} />
                <KPICard label="PV TERMINAL VALUE"    val={fmtM(result.terminalValues.pvBlended)} />
                <KPICard label="ENTERPRISE VALUE"     val={fmtM(result.enterpriseValue.blended)} />
                <KPICard label="EQUITY VALUE"         val={fmtM(result.equityValue.blended)} accent />
              </View>

              {/* TV % bar */}
              <Panel title="TERMINAL VALUE AS % OF EV">
                <View style={s.tvBar}>
                  <View style={[s.tvFill, { flex: 1 - result.tvAsPercentEV.ggm, backgroundColor: '#00C851' }]} />
                  <View style={[s.tvFill, { flex: result.tvAsPercentEV.ggm, backgroundColor: '#00FF80' }]} />
                </View>
                <View style={s.tvLabels}>
                  <Text style={s.tvLabel}>FCFs ({fmtPct(1 - result.tvAsPercentEV.ggm, 0)})</Text>
                  <Text style={s.tvLabel}>Terminal ({fmtPct(result.tvAsPercentEV.ggm, 0)})</Text>
                </View>
              </Panel>

              {/* FCF bar chart */}
              <Panel title="PROJECTED FREE CASH FLOWS ($M)">
                <BarChart bars={fcfBars} height={110} />
                <View style={s.chartLegend}>
                  <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#00C851' }]} /><Text style={s.legendText}>Phase 1 ({fmtPct(phase1Growth, 0)} growth)</Text></View>
                  <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#00FF80' }]} /><Text style={s.legendText}>Phase 2 ({fmtPct(phase2Growth, 0)} growth)</Text></View>
                </View>
              </Panel>

              {/* FCF table */}
              <Panel title="YEAR-BY-YEAR SUMMARY">
                <View style={s.tableHeader}>
                  {['Year', 'Revenue', 'FCF ($M)', 'PV ($M)'].map(h => (
                    <Text key={h} style={s.th}>{h}</Text>
                  ))}
                </View>
                {result.projections.map((p, i) => (
                  <View key={i} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? '#0a0a0a' : '#111111' }]}>
                    <Text style={s.td}>FY{2026 + i}</Text>
                    <Text style={s.td}>{fmtM(p.revenue)}</Text>
                    <Text style={[s.td, { color: '#00FF80' }]}>{fmtM(p.fcff)}</Text>
                    <Text style={s.td}>{fmtM(p.pvFcff)}</Text>
                  </View>
                ))}
              </Panel>
            </View>
          </View>
        )}

        {activeTab === 1 && <DCFEngineTab result={result} assumptions={liveAssumptions} />}
        {activeTab === 2 && <WACCTab wacc={wacc} taxRate={BASE.taxRate} />}
        {activeTab === 3 && <SensitivityTab grid={sensGrid} tgrValues={TGR_VALUES} />}
        {activeTab === 4 && <ScenariosTab baseRevenue={BASE.baseRevenue} cash={cash} shares={shares} />}
        {activeTab === 5 && <BridgeTab result={result} assumptions={liveAssumptions} currentPrice={CURRENT_PRICE} />}
      </ScrollView>
    </View>
  );
}

// ── Sub-tabs ───────────────────────────────────────────────
function DCFEngineTab({ result, assumptions }: any) {
  const PROJ_YEARS = ['FY26E', 'FY27E', 'FY28E', 'FY29E', 'FY30E', 'FY31E', 'FY32E'];
  return (
    <Panel title="FCFF PROJECTION ENGINE">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[tr.row, { backgroundColor: '#001a00' }]}>
            <Text style={[tr.cell, tr.label, { color: '#00FF80' }]}>Line Item</Text>
            {PROJ_YEARS.map(y => <Text key={y} style={[tr.cell, { color: '#00FF80', fontWeight: '700', textAlign: 'center' }]}>{y}</Text>)}
          </View>
          {[
            { label: 'Revenue ($M)', key: 'revenue', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'Gross Profit ($M)', key: 'grossProfit', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'EBIT ($M)', key: 'ebit', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'EBIT Margin', key: 'ebitMargin', fmt: fmtPct },
            { label: 'NOPAT ($M)', key: 'nopat', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'D&A ($M)', key: 'da', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'CapEx ($M)', key: 'capex', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'ΔNWC ($M)', key: 'dNwc', fmt: (v: number) => `$${v.toFixed(0)}` },
            { label: 'FCFF ($M)', key: 'fcff', fmt: (v: number) => `$${v.toFixed(0)}`, bold: true },
            { label: 'FCF Margin', key: 'fcfMargin', fmt: fmtPct },
            { label: 'Discount Factor', key: 'discountFactor', fmt: (v: number) => v.toFixed(4) },
            { label: 'PV of FCFF ($M)', key: 'pvFcff', fmt: (v: number) => `$${v.toFixed(0)}`, bold: true },
          ].map((row, ri) => (
            <View key={row.label} style={[tr.row, { backgroundColor: ri % 2 === 0 ? '#050505' : '#0a0a0a' }]}>
              <Text style={[tr.cell, tr.label, row.bold && { color: '#00FF80', fontWeight: '700' }]}>{row.label}</Text>
              {result.projections.map((p: any, i: number) => (
                <Text key={i} style={[tr.cell, row.bold && { color: '#00FF80', fontWeight: '700' }]}>{row.fmt(p[row.key])}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ marginTop: 16 }}>
        {[
          { label: 'Sum PV FCFFs', val: fmtM(result.pvFCFFs) },
          { label: 'GGM Terminal Value', val: fmtM(result.terminalValues.ggmTV) },
          { label: 'PV of GGM TV', val: fmtM(result.terminalValues.pvGGM), bold: true },
          { label: 'Exit TV', val: fmtM(result.terminalValues.exitTV) },
          { label: 'PV of Exit TV', val: fmtM(result.terminalValues.pvExit), bold: true },
        ].map((r, i) => (
          <View key={i} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#050505' : '#0a0a0a' }]}>
            <Text style={[s.simpleLabel, r.bold && { color: '#00FF80' }]}>{r.label}</Text>
            <Text style={[s.simpleVal, r.bold && { color: '#00FF80', fontWeight: '700' }]}>{r.val}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function WACCTab({ wacc, taxRate }: any) {
  const rf = 0.043, beta = 1.30, erp = 0.055, spread = 0.015;
  const ke = rf + beta * erp;
  const kd = (rf + spread) * (1 - taxRate);
  const rows = [
    { label: 'Risk-Free Rate (Rf)', val: fmtPct(rf), note: '10yr UST Feb 2026' },
    { label: 'Equity Beta (β)', val: '1.30', note: '5yr monthly regression' },
    { label: 'Equity Risk Premium', val: fmtPct(erp), note: 'Damodaran US ERP' },
    { label: 'Cost of Equity (Ke)', val: fmtPct(ke), bold: true },
    { label: 'Pre-Tax Cost of Debt', val: fmtPct(rf + spread), note: 'IG spread' },
    { label: 'After-Tax Cost of Debt', val: fmtPct(kd), bold: true },
    { label: 'Equity Weight (We)', val: '95.0%' },
    { label: 'Debt Weight (Wd)', val: '5.0%', note: 'Near debt-free' },
    { label: 'WACC', val: fmtPct(wacc), bold: true, accent: true },
  ];
  return (
    <Panel title="WACC BUILD-UP  —  CAPM">
      {rows.map((r, i) => (
        <View key={i} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#050505' : '#0a0a0a' }]}>
          <View>
            <Text style={[s.simpleLabel, r.bold && { color: r.accent ? '#00FF80' : '#CCCCCC' }]}>{r.label}</Text>
            {r.note && <Text style={{ color: '#64748B', fontSize: 10 }}>{r.note}</Text>}
          </View>
          <Text style={[s.simpleVal, r.bold && { color: r.accent ? '#00FF80' : '#FFFFFF', fontSize: r.accent ? 22 : 14, fontWeight: '700' }]}>{r.val}</Text>
        </View>
      ))}
    </Panel>
  );
}

function SensitivityTab({ grid, tgrValues }: any) {
  return (
    <Panel title="SENSITIVITY  —  WACC × TERMINAL GROWTH RATE  (Blended / Share)">
      <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 12 }}>Green = upside vs $190  ·  Yellow = neutral  ·  Red = downside</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[tr.row, { backgroundColor: '#001a00' }]}>
            <Text style={[tr.sensCell, { color: '#00FF80', fontWeight: '700', width: 80 }]}>WACC\TGR</Text>
            {tgrValues.map((t: number) => <Text key={t} style={[tr.sensCell, { color: '#00FF80' }]}>{fmtPct(t)}</Text>)}
          </View>
          {grid.map((row: any, wi: number) => (
            <View key={wi} style={tr.row}>
              <Text style={[tr.sensCell, { color: '#00FF80', fontWeight: '700', width: 80, backgroundColor: '#001a00' }]}>{fmtPct(row.wacc)}</Text>
              {row.values.map((cell: any, ti: number) => (
                <View key={ti} style={[tr.sensCell, { backgroundColor: getSensitivityBg(cell.delta), justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: getSensitivityColor(cell.delta), fontSize: 11, fontWeight: '700' }}>{fmt$(cell.price, 0)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Panel>
  );
}

function ScenariosTab({ baseRevenue, cash, shares }: any) {
  const scenarios = [
    { name: 'BULL', color: '#00FF80', prob: 0.30, g1: 0.20, g2: 0.13, ebit: 0.32, wacc: 0.09, tgr: 0.04, narrative: 'AI security boom. Platform consolidation. NGS ARR >$12B.' },
    { name: 'BASE', color: '#0EA5E9', prob: 0.50, g1: 0.16, g2: 0.10, ebit: 0.28, wacc: 0.095, tgr: 0.035, narrative: 'Mgmt guidance + consensus. Gradual margin expansion.' },
    { name: 'BEAR', color: '#FF3B3B', prob: 0.20, g1: 0.12, g2: 0.06, ebit: 0.24, wacc: 0.105, tgr: 0.025, narrative: 'Macro IT cuts. Competition intensifies. Margin compression.' },
  ];

  const results = scenarios.map(s => {
    const a: DCFAssumptions = {
      ...BASE, baseRevenue, cash, sharesOutstanding: shares,
      revGrowthRates: [s.g1, s.g1, s.g1, s.g2, s.g2, s.g2, s.g2],
      ebitMargin: s.ebit, wacc: s.wacc, terminalGrowthRate: s.tgr,
    };
    return { ...s, result: calculateDCF(a) };
  });

  const pwv = results.reduce((sum, s) => sum + s.prob * s.result.intrinsicPerShare.blended, 0);

  return (
    <View>
      <View style={isWide ? { flexDirection: 'row', gap: 16 } : {}}>
        {results.map(s => {
          const upside = (s.result.intrinsicPerShare.blended - 190) / 190;
          return (
            <View key={s.name} style={[s2.card, { borderColor: s.color + '55', flex: isWide ? 1 : undefined }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={[s2.pill, { backgroundColor: s.color + '22' }]}><Text style={[s2.pillText, { color: s.color }]}>{s.name}</Text></View>
                <Text style={{ color: '#64748B', fontSize: 12 }}>p = {fmtPct(s.prob, 0)}</Text>
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>{s.narrative}</Text>
              <Text style={[s2.price, { color: s.color }]}>{fmt$(s.result.intrinsicPerShare.blended, 2)}</Text>
              <Text style={{ color: upside >= 0 ? '#00FF80' : '#FF3B3B', fontSize: 13, marginTop: 4 }}>
                {upside >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(upside))} vs $190
              </Text>
              <View style={{ marginTop: 12 }}>
                {[['Yr1 Growth', fmtPct(s.g1)],['Yr4+ Growth', fmtPct(s.g2)],['EBIT Margin', fmtPct(s.ebit)],['WACC', fmtPct(s.wacc)]].map(([k, v]) => (
                  <View key={k as string} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 11 }}>{k}</Text>
                    <Text style={{ color: '#CCCCCC', fontSize: 11, fontWeight: '600' }}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={[s2.card, { borderColor: '#F59E0B55', marginTop: 0 }]}>
        <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>PROBABILITY-WEIGHTED VALUE</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 6 }}>{fmt$(pwv, 2)}</Text>
        <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
          vs $190 current  ·  {fmtPct((pwv - 190) / 190)} implied {pwv > 190 ? 'upside' : 'downside'}
        </Text>
      </View>
    </View>
  );
}

function BridgeTab({ result, assumptions, currentPrice }: any) {
  const rows: { label: string; val: string; indent?: boolean; bold?: boolean; accent?: boolean }[] = [
    { label: 'Sum of PV FCFFs (Yrs 1–7)', val: fmtM(result.pvFCFFs) },
    { label: '+ PV Terminal Value (GGM)', val: fmtM(result.terminalValues.pvGGM), indent: true },
    { label: '+ PV Terminal Value (Exit)', val: fmtM(result.terminalValues.pvExit), indent: true },
    { label: 'Enterprise Value (Blended)', val: fmtM(result.enterpriseValue.blended), bold: true },
    { label: '+ Cash & Equivalents', val: fmtM(assumptions.cash), indent: true },
    { label: '− Total Debt', val: fmtM(assumptions.debt), indent: true },
    { label: 'Equity Value (Blended)', val: fmtM(result.equityValue.blended), bold: true },
    { label: '÷ Diluted Shares (M)', val: `${assumptions.sharesOutstanding}M`, indent: true },
    { label: 'Intrinsic Value — GGM', val: fmt$(result.intrinsicPerShare.ggm, 2) },
    { label: 'Intrinsic Value — Exit Multiple', val: fmt$(result.intrinsicPerShare.exit, 2) },
    { label: 'Intrinsic Value — Blended', val: fmt$(result.intrinsicPerShare.blended, 2), accent: true, bold: true },
    { label: 'Current Market Price', val: fmt$(currentPrice, 2) },
    { label: 'Implied Upside / (Downside)', val: fmtPct((result.intrinsicPerShare.blended - currentPrice) / currentPrice), bold: true },
  ];
  return (
    <Panel title="EV → EQUITY → PER SHARE BRIDGE">
      {rows.map((r, i) => (
        <View key={i} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#050505' : '#0a0a0a', paddingLeft: r.indent ? 32 : 16 }]}>
          <Text style={[s.simpleLabel, r.bold && { color: r.accent ? '#00FF80' : '#CCCCCC' }]}>{r.label}</Text>
          <Text style={[s.simpleVal, r.bold && { fontWeight: '700' }, r.accent && { color: '#00FF80', fontSize: 22 }]}>{r.val}</Text>
        </View>
      ))}
    </Panel>
  );
}

// ── Shared components ──────────────────────────────────────
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

function KPICard({ label, val, accent }: { label: string; val: string; accent?: boolean }) {
  return (
    <View style={[k.card, accent && { borderColor: '#00FF8044' }]}>
      <Text style={k.label}>{label}</Text>
      <Text style={[k.val, accent && { color: '#00FF80' }]}>{val}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#00FF8022', zIndex: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline' },
  ticker: { color: '#00FF80', fontSize: 28, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace' },
  company: { color: '#64748B', fontSize: 13, letterSpacing: 2, fontFamily: 'monospace' },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { color: '#94A3B8', fontSize: 12, letterSpacing: 1.5, fontFamily: 'monospace' },
  headerDate: { color: '#1e3a2a', fontSize: 10, letterSpacing: 1, fontFamily: 'monospace', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#00FF8022', zIndex: 1, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, marginRight: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#00FF80' },
  tabText: { color: '#64748B', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, fontFamily: 'monospace' },
  tabTextActive: { color: '#00FF80' },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  twoCol: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  oneCol: { flexDirection: 'column', gap: 16 },
  leftPanel: { flex: 1, gap: 16, maxWidth: 420 },
  rightPanel: { flex: 1.4, gap: 16 },
  fullPanel: { gap: 16 },
  intrinsicCard: { backgroundColor: '#050505', borderWidth: 1.5, borderRadius: 12, padding: 20, marginBottom: 0 },
  intrinsicLabel: { color: '#64748B', fontSize: 11, letterSpacing: 2, fontFamily: 'monospace', marginBottom: 6 },
  intrinsicValue: { fontSize: 52, fontWeight: '800', fontFamily: 'monospace', lineHeight: 60 },
  upsideBadge: { marginTop: 12, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  upsideText: { fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tvBar: { height: 16, flexDirection: 'row', borderRadius: 4, overflow: 'hidden', backgroundColor: '#111' },
  tvFill: { height: '100%' },
  tvLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tvLabel: { color: '#64748B', fontSize: 11 },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94A3B8', fontSize: 11 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#001a00', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4, marginBottom: 2 },
  th: { flex: 1, color: '#00FF80', fontSize: 11, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10 },
  td: { flex: 1, color: '#94A3B8', fontSize: 12, fontFamily: 'monospace' },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  simpleLabel: { color: '#94A3B8', fontSize: 13 },
  simpleVal: { color: '#94A3B8', fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
});

const p = StyleSheet.create({
  panel: { backgroundColor: '#050505', borderWidth: 1, borderColor: '#00FF8015', borderRadius: 12, padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF80', marginRight: 8 },
  title: { color: '#00FF80', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
});

const k = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', backgroundColor: '#080808', borderWidth: 1, borderColor: '#00FF8022', borderRadius: 10, padding: 14 },
  label: { color: '#64748B', fontSize: 10, letterSpacing: 1, fontFamily: 'monospace', marginBottom: 6 },
  val: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', fontFamily: 'monospace' },
});

const tr = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { width: 90, paddingHorizontal: 8, paddingVertical: 8, color: '#94A3B8', fontSize: 12, textAlign: 'right', fontFamily: 'monospace' },
  label: { width: 200, textAlign: 'left', color: '#94A3B8' },
  sensCell: { width: 72, height: 40, paddingHorizontal: 4, paddingVertical: 6, fontSize: 12, textAlign: 'center', justifyContent: 'center', alignItems: 'center' },
});

const s2 = StyleSheet.create({
  card: { backgroundColor: '#050505', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  price: { fontSize: 32, fontWeight: '800', fontFamily: 'monospace' },
});
