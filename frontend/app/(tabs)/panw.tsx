import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Dimensions,
} from 'react-native';
import { useDCFStore } from '../../store/useDCFStore';
import { panwApi } from '../../services/api';
import { fmt$, fmtPct, fmtM, getSensitivityBg, getSensitivityColor } from '../../utils/dcfEngine';
import { PANWModel } from '../../types/dcf';

const { width } = Dimensions.get('window');
const TABS = ['Overview', 'DCF Engine', 'WACC', 'Sensitivity', 'Scenarios', 'Bridge'];

export default function PANWScreen() {
  const { panwModel, panwLoading, panwError, setPanwModel, setPanwLoading, setPanwError } = useDCFStore();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (panwLoading && !panwModel) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={{ color: '#64748B', marginTop: 12 }}>Loading PANW model…</Text>
      </View>
    );
  }

  if (panwError) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ color: '#C0392B', textAlign: 'center', marginBottom: 16 }}>{panwError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  const m = panwModel;
  if (!m) return null;

  const upside = m.currentPrice ? (m.dcf.intrinsicPerShare.blended - m.currentPrice) / m.currentPrice : 0;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTicker}>PANW  ·  Palo Alto Networks</Text>
          <Text style={s.headerSub}>FY ends July 31  ·  FCFF Model  ·  {m.modelDate}</Text>
        </View>
        <View style={s.priceBox}>
          <Text style={s.priceLabel}>Current</Text>
          <Text style={s.priceVal}>{m.currentPrice ? fmt$(m.currentPrice, 2) : '—'}</Text>
        </View>
      </View>

      {/* KPI strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiStrip} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {[
          { label: 'Blended Intrinsic', val: fmt$(m.dcf.intrinsicPerShare.blended, 2), highlight: true },
          { label: 'GGM', val: fmt$(m.dcf.intrinsicPerShare.ggm, 2) },
          { label: 'Exit Mult.', val: fmt$(m.dcf.intrinsicPerShare.exit, 2) },
          { label: 'Upside', val: fmtPct(upside), color: upside >= 0 ? '#10B981' : '#C0392B' },
          { label: 'EV (Blended)', val: fmtM(m.dcf.enterpriseValue.blended) },
          { label: 'WACC', val: fmtPct(m.assumptions.wacc) },
          { label: 'TGR', val: fmtPct(m.assumptions.terminalGrowthRate) },
          { label: 'FY25 FCF', val: fmtM(3494) },
        ].map(k => (
          <View key={k.label} style={[s.kpiCard, k.highlight && s.kpiCardHL]}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={[s.kpiVal, k.color ? { color: k.color } : k.highlight ? { color: '#0EA5E9' } : {}]}>{k.val}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === i && s.tabActive]} onPress={() => setActiveTab(i)}>
            <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView
        style={s.tabContent}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0EA5E9" />}
      >
        {activeTab === 0 && <OverviewTab m={m} />}
        {activeTab === 1 && <DCFEngineTab m={m} />}
        {activeTab === 2 && <WACCTab m={m} />}
        {activeTab === 3 && <SensitivityTab m={m} />}
        {activeTab === 4 && <ScenariosTab m={m} />}
        {activeTab === 5 && <BridgeTab m={m} />}
      </ScrollView>
    </View>
  );
}

// ── Overview Tab ────────────────────────────────────────────
function OverviewTab({ m }: { m: PANWModel }) {
  return (
    <View>
      <SectionHeader title="HISTORICAL FINANCIALS  (FY2021–FY2025)" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={[tr.row, { backgroundColor: '#1E3A5F' }]}>
            <Text style={[tr.cell, tr.label, { color: '#94A3B8' }]}>Metric</Text>
            {m.historical.map(h => <Text key={h.year} style={[tr.cell, tr.header]}>{h.year}</Text>)}
          </View>
          {[
            { label: 'Revenue ($M)', key: 'revenue', fmt: (v: number) => v.toLocaleString() },
            { label: 'Gross Profit ($M)', key: 'grossProfit', fmt: (v: number) => v.toLocaleString() },
            { label: 'Gross Margin', key: 'grossMargin', fmt: fmtPct },
            { label: 'EBIT ($M)', key: 'ebit', fmt: (v: number) => v.toLocaleString() },
            { label: 'EBIT Margin', key: 'ebitMargin', fmt: fmtPct },
            { label: 'D&A ($M)', key: 'da', fmt: (v: number) => v.toLocaleString() },
            { label: 'CapEx ($M)', key: 'capex', fmt: (v: number) => v.toLocaleString() },
            { label: 'FCF ($M)', key: 'fcf', fmt: (v: number) => v.toLocaleString() },
            { label: 'FCF Margin', key: 'fcfMargin', fmt: fmtPct },
          ].map((row, ri) => (
            <View key={row.label} style={[tr.row, { backgroundColor: ri % 2 === 0 ? '#0F1923' : '#162232' }]}>
              <Text style={[tr.cell, tr.label]}>{row.label}</Text>
              {m.historical.map((h: any) => (
                <Text key={h.year} style={[tr.cell, { color: (h[row.key] as number) < 0 ? '#C0392B' : '#E2E8F0' }]}>
                  {row.fmt(h[row.key] as number)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <SectionHeader title="VALUATION SUMMARY" style={{ marginTop: 24 }} />
      {[
        { method: 'Gordon Growth (GGM)', ev: m.dcf.enterpriseValue.ggm, eq: m.dcf.equityValue.ggm, per: m.dcf.intrinsicPerShare.ggm },
        { method: 'EV/EBITDA Exit', ev: m.dcf.enterpriseValue.exit, eq: m.dcf.equityValue.exit, per: m.dcf.intrinsicPerShare.exit },
        { method: 'Blended 50/50', ev: m.dcf.enterpriseValue.blended, eq: m.dcf.equityValue.blended, per: m.dcf.intrinsicPerShare.blended },
      ].map((row, i) => {
        const upside = m.currentPrice ? (row.per - m.currentPrice) / m.currentPrice : 0;
        return (
          <View key={row.method} style={[s.valRow, i === 2 && { backgroundColor: '#0EA5E911', borderColor: '#0EA5E933' }]}>
            <Text style={[s.valMethod, i === 2 && { color: '#0EA5E9', fontWeight: '700' }]}>{row.method}</Text>
            <View style={s.valNums}>
              <NumCell label="EV" val={fmtM(row.ev)} />
              <NumCell label="Equity" val={fmtM(row.eq)} />
              <NumCell label="Per Share" val={fmt$(row.per, 2)} highlight />
              <NumCell label="Upside" val={fmtPct(upside)} color={upside >= 0 ? '#10B981' : '#C0392B'} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── DCF Engine Tab ──────────────────────────────────────────
function DCFEngineTab({ m }: { m: PANWModel }) {
  const PROJ_YEARS = ['FY26E', 'FY27E', 'FY28E', 'FY29E', 'FY30E', 'FY31E', 'FY32E'];
  const p = m.dcf.projections;

  return (
    <View>
      <SectionHeader title="FCFF PROJECTION  (FY2026E–FY2032E)" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[tr.row, { backgroundColor: '#1E3A5F' }]}>
            <Text style={[tr.cell, tr.label, { color: '#94A3B8' }]}>Line Item</Text>
            {PROJ_YEARS.map(y => <Text key={y} style={[tr.cell, tr.header]}>{y}</Text>)}
          </View>
          {[
            { label: 'Revenue ($M)', key: 'revenue', fmt: (v: number) => v.toFixed(0) },
            { label: 'Rev Growth', key: 'year', fmt: (_: any, i: number) => fmtPct(m.assumptions.revGrowthRates[i]) },
            { label: 'Gross Profit ($M)', key: 'grossProfit', fmt: (v: number) => v.toFixed(0) },
            { label: 'Gross Margin', key: 'grossMargin', fmt: fmtPct },
            { label: 'EBIT ($M)', key: 'ebit', fmt: (v: number) => v.toFixed(0) },
            { label: 'EBIT Margin', key: 'ebitMargin', fmt: fmtPct },
            { label: 'NOPAT ($M)', key: 'nopat', fmt: (v: number) => v.toFixed(0) },
            { label: '(+) D&A ($M)', key: 'da', fmt: (v: number) => v.toFixed(0) },
            { label: '(−) CapEx ($M)', key: 'capex', fmt: (v: number) => v.toFixed(0) },
            { label: '(−) ΔNWC ($M)', key: 'dNwc', fmt: (v: number) => v.toFixed(0) },
            { label: 'FCFF ($M)', key: 'fcff', fmt: (v: number) => v.toFixed(0), bold: true },
            { label: 'FCF Margin', key: 'fcfMargin', fmt: fmtPct },
            { label: 'Discount Factor', key: 'discountFactor', fmt: (v: number) => v.toFixed(4) },
            { label: 'PV of FCFF ($M)', key: 'pvFcff', fmt: (v: number) => v.toFixed(0), bold: true },
          ].map((row, ri) => (
            <View key={row.label} style={[tr.row, { backgroundColor: ri % 2 === 0 ? '#0F1923' : '#162232' }]}>
              <Text style={[tr.cell, tr.label, row.bold && { color: '#0EA5E9', fontWeight: '700' }]}>{row.label}</Text>
              {p.map((yr, i) => {
                const val = row.key === 'year' ? row.fmt(yr.year, i) : row.fmt((yr as any)[row.key], i);
                return <Text key={i} style={[tr.cell, row.bold && { color: '#0EA5E9', fontWeight: '700' }]}>{val}</Text>;
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <SectionHeader title="TERMINAL VALUE" style={{ marginTop: 24 }} />
      {[
        { label: 'GGM Terminal Value ($M)', val: fmtM(m.dcf.terminalValues.ggmTV) },
        { label: 'PV of GGM TV ($M)', val: fmtM(m.dcf.terminalValues.pvGGM), bold: true },
        { label: 'Exit EBITDA × ' + m.assumptions.exitMultiple + 'x  TV ($M)', val: fmtM(m.dcf.terminalValues.exitTV) },
        { label: 'PV of Exit TV ($M)', val: fmtM(m.dcf.terminalValues.pvExit), bold: true },
        { label: 'Sum of PV FCFFs ($M)', val: fmtM(m.dcf.pvFCFFs), bold: true },
      ].map((row, i) => (
        <View key={row.label} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#0F1923' : '#162232' }]}>
          <Text style={[s.simpleLabel, row.bold && { color: '#0EA5E9' }]}>{row.label}</Text>
          <Text style={[s.simpleVal, row.bold && { color: '#0EA5E9', fontWeight: '700' }]}>{row.val}</Text>
        </View>
      ))}
    </View>
  );
}

// ── WACC Tab ────────────────────────────────────────────────
function WACCTab({ m }: { m: PANWModel }) {
  const a = m.assumptions;
  const ke = a.wacc; // simplified display
  type WACCItem = { label: string; val: string; note?: string; highlight?: boolean; big?: boolean };
  type WACCSection = { section: string; items: WACCItem[] };
  const rows: WACCSection[] = [
    { section: 'COST OF EQUITY (CAPM)', items: [
      { label: 'Risk-Free Rate (Rf)', val: fmtPct(0.043), note: '10yr UST Feb 2026' },
      { label: 'Equity Beta (β)', val: '1.30', note: '5yr monthly vs NASDAQ' },
      { label: 'Equity Risk Premium (ERP)', val: fmtPct(0.055), note: 'Damodaran US ERP' },
      { label: 'Cost of Equity  Ke', val: fmtPct(0.043 + 1.30 * 0.055), highlight: true },
    ]},
    { section: 'COST OF DEBT', items: [
      { label: 'Pre-Tax Cost of Debt', val: fmtPct(0.043 + 0.015) },
      { label: 'Tax Rate', val: fmtPct(a.taxRate) },
      { label: 'After-Tax Kd', val: fmtPct((0.043 + 0.015) * (1 - a.taxRate)), highlight: true },
    ]},
    { section: 'CAPITAL STRUCTURE', items: [
      { label: 'Equity Weight (We)', val: fmtPct(1 - a.debt / (a.debt + 1)) },
      { label: 'Debt Weight (Wd)', val: fmtPct(0.05), note: 'Near debt-free' },
    ]},
    { section: 'WACC', items: [
      { label: 'WACC  =  Ke×We + Kd(1−t)×Wd', val: fmtPct(a.wacc), highlight: true, big: true },
    ]},
  ];

  return (
    <View>
      {rows.map(({ section, items }) => (
        <View key={section}>
          <SectionHeader title={section} />
          {items.map((item, i) => (
            <View key={item.label} style={[s.simpleRow, { backgroundColor: item.highlight ? '#0EA5E911' : i % 2 === 0 ? '#0F1923' : '#162232' }]}>
              <Text style={[s.simpleLabel, item.highlight && { color: '#0EA5E9', fontWeight: '700' }]}>{item.label}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.simpleVal, item.highlight && { color: '#0EA5E9', fontWeight: '800' }, item.big && { fontSize: 20 }]}>{item.val}</Text>
                {item.note && <Text style={{ color: '#64748B', fontSize: 10 }}>{item.note}</Text>}
              </View>
            </View>
          ))}
        </View>
      ))}

      <SectionHeader title="PEER BENCHMARKS" style={{ marginTop: 8 }} />
      {[
        ['Fortinet (FTNT)', '9.5–10.5%'],
        ['CrowdStrike (CRWD)', '10.0–11.5%'],
        ['Zscaler (ZS)', '10.5–12.0%'],
        ['PANW (this model)', fmtPct(a.wacc)],
        ['Sector Median', '9.8–11.2%'],
      ].map(([co, range], i) => (
        <View key={co} style={[s.simpleRow, { backgroundColor: co.includes('PANW') ? '#0EA5E911' : i % 2 === 0 ? '#0F1923' : '#162232' }]}>
          <Text style={[s.simpleLabel, co.includes('PANW') && { color: '#0EA5E9' }]}>{co}</Text>
          <Text style={[s.simpleVal, co.includes('PANW') && { color: '#0EA5E9', fontWeight: '700' }]}>{range}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Sensitivity Tab ─────────────────────────────────────────
function SensitivityTab({ m }: { m: PANWModel }) {
  const { grid, tgrValues } = m.sensitivity;
  const currentPrice = m.currentPrice || 190;

  return (
    <View>
      <SectionHeader title="WACC × TERMINAL GROWTH RATE  (Blended Intrinsic / Share)" />
      <Text style={s.sensNote}>Green &gt; +20%  ·  Yellow ±10%  ·  Red &lt; −10%  vs ${currentPrice}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* TGR header */}
          <View style={[tr.row, { backgroundColor: '#1E3A5F' }]}>
            <Text style={[tr.sensCell, { color: '#94A3B8', fontWeight: '700', width: 80 }]}>WACC \ TGR</Text>
            {tgrValues.map(t => <Text key={t} style={[tr.sensCell, { color: '#94A3B8', fontWeight: '600' }]}>{fmtPct(t)}</Text>)}
          </View>
          {grid.map((row, wi) => (
            <View key={wi} style={tr.row}>
              <Text style={[tr.sensCell, { color: '#0EA5E9', fontWeight: '700', width: 80, backgroundColor: '#162232' }]}>{fmtPct(row.wacc)}</Text>
              {row.values.map((price, ti) => {
                const delta = (price - currentPrice) / currentPrice;
                return (
                  <View key={ti} style={[tr.sensCell, { backgroundColor: getSensitivityBg(delta), justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: getSensitivityColor(delta), fontSize: 12, fontWeight: '600' }}>{fmt$(price, 0)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Scenarios Tab ────────────────────────────────────────────
function ScenariosTab({ m }: { m: PANWModel }) {
  const COLORS: Record<string, string> = { 'Bull Case': '#10B981', 'Base Case': '#0EA5E9', 'Bear Case': '#C0392B' };

  const probWeighted = m.scenarios.reduce((sum, s) => sum + s.probability * s.result.intrinsicPerShare.blended, 0);

  return (
    <View>
      {m.scenarios.map(s => {
        const color = COLORS[s.name] || '#0EA5E9';
        const upside = m.currentPrice ? (s.result.intrinsicPerShare.blended - m.currentPrice) / m.currentPrice : 0;
        return (
          <View key={s.name} style={[s2.card, { borderColor: color + '44' }]}>
            <View style={s2.cardHeader}>
              <View style={[s2.pill, { backgroundColor: color + '22' }]}>
                <Text style={[s2.pillText, { color }]}>{s.name.toUpperCase()}</Text>
              </View>
              <Text style={s2.prob}>p = {fmtPct(s.probability, 0)}</Text>
            </View>
            <Text style={s2.narrative}>{s.narrative}</Text>
            <View style={s2.metrics}>
              <ScenMetric label="Revenue Gr Yr1" val={fmtPct(s.revGrowthRates[0])} color={color} />
              <ScenMetric label="EBIT Margin" val={fmtPct(s.ebitMargin)} color={color} />
              <ScenMetric label="WACC" val={fmtPct(s.wacc)} color={color} />
              <ScenMetric label="TGR" val={fmtPct(s.terminalGrowthRate)} color={color} />
            </View>
            <View style={s2.output}>
              <View style={s2.outputItem}>
                <Text style={s2.outputLabel}>Intrinsic / Share</Text>
                <Text style={[s2.outputVal, { color }]}>{fmt$(s.result.intrinsicPerShare.blended, 2)}</Text>
              </View>
              <View style={s2.outputItem}>
                <Text style={s2.outputLabel}>vs ${m.currentPrice?.toFixed(0)}</Text>
                <Text style={[s2.outputVal, { color: upside >= 0 ? '#10B981' : '#C0392B' }]}>{fmtPct(upside)}</Text>
              </View>
              <View style={s2.outputItem}>
                <Text style={s2.outputLabel}>EV (Blended)</Text>
                <Text style={s2.outputVal}>{fmtM(s.result.enterpriseValue.blended)}</Text>
              </View>
            </View>
          </View>
        );
      })}

      <View style={[s2.card, { borderColor: '#F59E0B44', backgroundColor: '#F59E0B11' }]}>
        <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>PROBABILITY-WEIGHTED VALUE</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800' }}>{fmt$(probWeighted, 2)}</Text>
        {m.currentPrice && (
          <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
            vs {fmt$(m.currentPrice, 2)} current  ·  {fmtPct((probWeighted - m.currentPrice) / m.currentPrice)} implied {probWeighted > m.currentPrice ? 'upside' : 'downside'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Bridge Tab ───────────────────────────────────────────────
function BridgeTab({ m }: { m: PANWModel }) {
  const d = m.dcf;
  const a = m.assumptions;
  const blended = (d.terminalValues.pvGGM + d.terminalValues.pvExit) / 2;

  type BridgeRow = { label: string; val: string; indent: boolean; bold?: boolean; highlight?: boolean; big?: boolean };
  const rows: BridgeRow[] = [
    { label: 'Sum of PV FCFFs (Yrs 1–7)', val: fmtM(d.pvFCFFs), indent: false },
    { label: '(+) PV Terminal Value — GGM', val: fmtM(d.terminalValues.pvGGM), indent: true },
    { label: '(+) PV Terminal Value — Exit Mult.', val: fmtM(d.terminalValues.pvExit), indent: true },
    { label: '(+) PV Terminal Value — Blended', val: fmtM(blended), indent: true, highlight: true },
    { label: 'Enterprise Value (GGM)', val: fmtM(d.enterpriseValue.ggm), indent: false },
    { label: 'Enterprise Value (Exit Multiple)', val: fmtM(d.enterpriseValue.exit), indent: false },
    { label: 'Enterprise Value (Blended)', val: fmtM(d.enterpriseValue.blended), indent: false, bold: true },
    { label: '(+) Cash & Equivalents', val: fmtM(a.cash), indent: true },
    { label: '(−) Total Debt', val: fmtM(a.debt), indent: true },
    { label: 'Equity Value (GGM)', val: fmtM(d.equityValue.ggm), indent: false },
    { label: 'Equity Value (Exit)', val: fmtM(d.equityValue.exit), indent: false },
    { label: 'Equity Value (Blended)', val: fmtM(d.equityValue.blended), indent: false, bold: true },
    { label: '÷ Diluted Shares Outstanding (M)', val: a.sharesOutstanding.toLocaleString(), indent: true },
    { label: 'Intrinsic Value / Share — GGM', val: fmt$(d.intrinsicPerShare.ggm, 2), indent: false },
    { label: 'Intrinsic Value / Share — Exit', val: fmt$(d.intrinsicPerShare.exit, 2), indent: false },
    { label: 'Intrinsic Value / Share — Blended', val: fmt$(d.intrinsicPerShare.blended, 2), indent: false, highlight: true, big: true },
    { label: 'Current Market Price', val: fmt$(m.currentPrice || 190, 2), indent: false },
    { label: 'Implied Upside / (Downside)', val: m.currentPrice ? fmtPct((d.intrinsicPerShare.blended - m.currentPrice) / m.currentPrice) : '—', indent: false, bold: true },
  ];

  return (
    <View>
      <SectionHeader title="EV → EQUITY → PER SHARE BRIDGE" />
      {rows.map((row, i) => (
        <View key={i} style={[s.simpleRow, {
          backgroundColor: row.highlight ? '#0EA5E911' : i % 2 === 0 ? '#0F1923' : '#162232',
          paddingLeft: row.indent ? 28 : 16,
        }]}>
          <Text style={[s.simpleLabel, row.bold && { fontWeight: '700', color: '#E2E8F0' }, row.highlight && { color: '#0EA5E9', fontWeight: '700' }]}>{row.label}</Text>
          <Text style={[s.simpleVal, row.bold && { fontWeight: '700' }, row.highlight && { color: '#0EA5E9', fontWeight: '800' }, (row as any).big && { fontSize: 20 }]}>{row.val}</Text>
        </View>
      ))}

      <SectionHeader title="RELATIVE VALUATION CROSS-CHECK" style={{ marginTop: 24 }} />
      {[
        { label: 'EV / Revenue (FY25)', val: (d.enterpriseValue.blended / 9222).toFixed(1) + 'x' },
        { label: 'EV / EBITDA (FY25)', val: (d.enterpriseValue.blended / (9222 * 0.28 + 345)).toFixed(1) + 'x' },
        { label: 'P / FCF (FY25)', val: ((m.currentPrice || 190) * a.sharesOutstanding / 3494).toFixed(1) + 'x' },
        { label: 'TV as % of EV (GGM)', val: fmtPct(d.tvAsPercentEV.ggm) },
        { label: 'TV as % of EV (Exit)', val: fmtPct(d.tvAsPercentEV.exit) },
      ].map((row, i) => (
        <View key={row.label} style={[s.simpleRow, { backgroundColor: i % 2 === 0 ? '#0F1923' : '#162232' }]}>
          <Text style={s.simpleLabel}>{row.label}</Text>
          <Text style={s.simpleVal}>{row.val}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Shared sub-components ────────────────────────────────────
function SectionHeader({ title, style }: { title: string; style?: any }) {
  return (
    <View style={[{ backgroundColor: '#1E3A5F', padding: 10, borderRadius: 8, marginBottom: 8 }, style]}>
      <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{title}</Text>
    </View>
  );
}

function NumCell({ label, val, highlight, color }: { label: string; val: string; highlight?: boolean; color?: string }) {
  return (
    <View style={{ alignItems: 'center', marginHorizontal: 8 }}>
      <Text style={{ color: '#64748B', fontSize: 10 }}>{label}</Text>
      <Text style={{ color: color || (highlight ? '#0EA5E9' : '#E2E8F0'), fontWeight: highlight ? '700' : '600', fontSize: 13 }}>{val}</Text>
    </View>
  );
}

function ScenMetric({ label, val, color }: { label: string; val: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: '#64748B', fontSize: 10, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{val}</Text>
    </View>
  );
}

const tr = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { width: 90, paddingHorizontal: 8, paddingVertical: 8, color: '#E2E8F0', fontSize: 12, textAlign: 'right' },
  label: { width: 180, textAlign: 'left', color: '#94A3B8', fontWeight: '500' },
  header: { color: '#FFFFFF', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  sensCell: { width: 72, height: 40, paddingHorizontal: 4, paddingVertical: 6, fontSize: 12, textAlign: 'center' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1B2A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 52, backgroundColor: '#0F1923', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  headerTicker: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceLabel: { color: '#64748B', fontSize: 10 },
  priceVal: { color: '#0EA5E9', fontSize: 20, fontWeight: '800' },
  kpiStrip: { maxHeight: 72, backgroundColor: '#0F1923', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  kpiCard: { backgroundColor: '#162232', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', minWidth: 100, borderWidth: 1, borderColor: '#1B2A3B' },
  kpiCardHL: { backgroundColor: '#0EA5E911', borderColor: '#0EA5E933' },
  kpiLabel: { color: '#64748B', fontSize: 10, marginBottom: 3 },
  kpiVal: { color: '#E2E8F0', fontWeight: '700', fontSize: 14 },
  tabBar: { maxHeight: 44, backgroundColor: '#0F1923', borderBottomWidth: 1, borderBottomColor: '#1B2A3B' },
  tab: { paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0EA5E9' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0EA5E9' },
  tabContent: { flex: 1 },
  valRow: { flexDirection: 'column', backgroundColor: '#162232', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1B2A3B' },
  valMethod: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  valNums: { flexDirection: 'row', justifyContent: 'space-around' },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  simpleLabel: { color: '#94A3B8', fontSize: 13, flex: 1 },
  simpleVal: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  sensNote: { color: '#64748B', fontSize: 11, marginBottom: 10 },
  retryBtn: { backgroundColor: '#1E3A5F', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#0EA5E9', fontWeight: '700' },
});

const s2 = StyleSheet.create({
  card: { backgroundColor: '#162232', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  prob: { color: '#64748B', fontSize: 12 },
  narrative: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14, backgroundColor: '#0F1923', borderRadius: 10, padding: 12 },
  output: { flexDirection: 'row', justifyContent: 'space-around' },
  outputItem: { alignItems: 'center' },
  outputLabel: { color: '#64748B', fontSize: 10, marginBottom: 3 },
  outputVal: { color: '#E2E8F0', fontWeight: '700', fontSize: 15 },
});
