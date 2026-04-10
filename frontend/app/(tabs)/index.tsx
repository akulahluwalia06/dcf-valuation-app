import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dcfApi } from '../../services/api';
import { fmt$ } from '../../utils/dcfEngine';
import AnimatedBackground from '../../components/ui/AnimatedBackground';

export default function HomeScreen() {
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRecent() {
    try { setRecent(await dcfApi.getRecent()); } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { loadRecent(); }, []);

  return (
    <View style={s.root}>
      <AnimatedBackground />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecent(); }} tintColor="#00FF80" />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>DCF<Text style={{ color: '#00FF80' }}>.</Text>TERMINAL</Text>
          <Text style={s.sub}>CFA-GRADE INTRINSIC VALUATION  ·  POWERED BY LIVE FINANCIAL DATA</Text>
        </View>

        {/* Cards */}
        <Text style={s.sectionLabel}>▸ TOOLS</Text>
        <View style={s.cardRow}>
          <TouchableOpacity style={[s.card, { borderColor: '#00FF8033' }]} onPress={() => router.push('/(tabs)/panw')} activeOpacity={0.8}>
            <View style={s.cardIcon}><Ionicons name="shield-checkmark-outline" size={24} color="#00FF80" /></View>
            <Text style={[s.cardTitle, { color: '#00FF80' }]}>PANW MODEL</Text>
            <Text style={s.cardDesc}>Pre-built Palo Alto Networks DCF — interactive sliders, live recalculation, 6 analysis tabs</Text>
            <View style={[s.chip, { borderColor: '#00FF8044' }]}><Text style={[s.chipText, { color: '#00FF80' }]}>LIVE DATA</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.card, { borderColor: '#0EA5E933' }]} onPress={() => router.push('/(tabs)/dcf')} activeOpacity={0.8}>
            <View style={s.cardIcon}><Ionicons name="calculator-outline" size={24} color="#0EA5E9" /></View>
            <Text style={[s.cardTitle, { color: '#0EA5E9' }]}>DCF TOOL</Text>
            <Text style={s.cardDesc}>Model any stock — auto-populate from live financials, instant sensitivity analysis</Text>
            <View style={[s.chip, { borderColor: '#0EA5E944' }]}><Text style={[s.chipText, { color: '#0EA5E9' }]}>ANY TICKER</Text></View>
          </TouchableOpacity>
        </View>

        {/* Methodology */}
        <Text style={s.sectionLabel}>▸ METHODOLOGY</Text>
        <View style={s.methodBox}>
          {[
            ['FCFF Model', 'NOPAT + D&A − CapEx − ΔNWC'],
            ['Terminal Value', 'GGM + EV/EBITDA blended 50/50'],
            ['WACC', 'CAPM  Ke = Rf + β × ERP'],
            ['Sensitivity', '7×7 WACC × TGR heatmap'],
            ['Scenarios', 'Bull / Base / Bear probability-weighted'],
          ].map(([t, d]) => (
            <View key={t} style={s.methodRow}>
              <Text style={s.methodDot}>▸</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.methodTitle}>{t}</Text>
                <Text style={s.methodDesc}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent */}
        {recent.length > 0 && (
          <>
            <Text style={s.sectionLabel}>▸ RECENTLY MODELED</Text>
            {recent.map((m: any, i: number) => {
              const price = m.results?.intrinsicPerShare?.blended;
              return (
                <View key={m._id || i} style={s.recentRow}>
                  <View style={s.recentTicker}><Text style={s.recentTickerText}>{m.ticker}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentName}>{m.companyName || m.ticker}</Text>
                    <Text style={s.recentDate}>{new Date(m.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {price && <Text style={s.recentPrice}>{fmt$(price, 2)}</Text>}
                </View>
              );
            })}
          </>
        )}

        {loading && <ActivityIndicator color="#00FF80" style={{ marginTop: 24 }} />}

        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>⚠  For informational purposes only. Not investment advice. Based on public filings and third-party data.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1, zIndex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 50 },
  header: { marginBottom: 32 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace' },
  sub: { color: '#1a3a2a', fontSize: 11, letterSpacing: 1.5, marginTop: 6, fontFamily: 'monospace' },
  sectionLabel: { color: '#00FF80', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12, fontFamily: 'monospace' },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  card: { flex: 1, backgroundColor: '#050505', borderRadius: 14, padding: 18, borderWidth: 1 },
  cardIcon: { marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8 },
  cardDesc: { color: '#334155', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
  methodBox: { backgroundColor: '#050505', borderRadius: 12, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: '#00FF8015' },
  methodRow: { flexDirection: 'row', marginBottom: 14 },
  methodDot: { color: '#00FF80', fontSize: 12 },
  methodTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  methodDesc: { color: '#334155', fontSize: 12, marginTop: 2 },
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050505', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#00FF8015' },
  recentTicker: { backgroundColor: '#001a00', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12 },
  recentTickerText: { color: '#00FF80', fontWeight: '700', fontSize: 13, fontFamily: 'monospace' },
  recentName: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  recentDate: { color: '#334155', fontSize: 11, marginTop: 2 },
  recentPrice: { color: '#00FF80', fontWeight: '700', fontSize: 15, fontFamily: 'monospace' },
  disclaimer: { backgroundColor: '#0a0500', borderRadius: 8, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#F59E0B22' },
  disclaimerText: { color: '#78350f', fontSize: 11, lineHeight: 16 },
});
