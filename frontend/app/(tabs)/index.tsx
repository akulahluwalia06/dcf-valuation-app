import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dcfApi } from '../../services/api';
import { fmt$, fmtPct } from '../../utils/dcfEngine';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRecent() {
    try {
      const data = await dcfApi.getRecent();
      setRecent(data);
    } catch {
      // no-op — recent models optional
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadRecent(); }, []);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecent(); }} tintColor="#0EA5E9" />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>DCF Valuation</Text>
        <Text style={s.headerSub}>CFA-grade intrinsic value models</Text>
      </View>

      {/* Quick access cards */}
      <Text style={s.sectionLabel}>TOOLS</Text>
      <View style={s.cardRow}>
        <TouchableOpacity style={[s.card, s.cardBlue]} onPress={() => router.push('/(tabs)/panw')} activeOpacity={0.8}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#0EA5E9" />
          <Text style={s.cardTitle}>PANW Model</Text>
          <Text style={s.cardDesc}>Pre-built Palo Alto Networks DCF — live price, 6 analysis tabs</Text>
          <View style={s.cardChip}><Text style={s.cardChipText}>LIVE DATA</Text></View>
        </TouchableOpacity>

        <TouchableOpacity style={[s.card, s.cardGreen]} onPress={() => router.push('/(tabs)/dcf')} activeOpacity={0.8}>
          <Ionicons name="calculator-outline" size={28} color="#10B981" />
          <Text style={s.cardTitle}>DCF Tool</Text>
          <Text style={s.cardDesc}>Model any stock — auto-populate from live financials</Text>
          <View style={[s.cardChip, { backgroundColor: '#10B98122' }]}><Text style={[s.cardChipText, { color: '#10B981' }]}>ANY TICKER</Text></View>
        </TouchableOpacity>
      </View>

      {/* Methodology callout */}
      <Text style={s.sectionLabel}>METHODOLOGY</Text>
      <View style={s.methodBox}>
        {[
          ['FCFF Model', 'NOPAT + D&A − CapEx − ΔNWC'],
          ['Terminal Value', 'GGM + EV/EBITDA blended 50/50'],
          ['WACC', 'CAPM  Ke = Rf + β × ERP'],
          ['Sensitivity', 'WACC × TGR  &  Margin × Growth heatmaps'],
          ['Scenarios', 'Bull / Base / Bear probability-weighted'],
        ].map(([title, desc]) => (
          <View key={title} style={s.methodRow}>
            <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" style={{ marginTop: 1 }} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={s.methodTitle}>{title}</Text>
              <Text style={s.methodDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent models */}
      {recent.length > 0 && (
        <>
          <Text style={s.sectionLabel}>RECENTLY MODELED</Text>
          {recent.map((m: any, i: number) => (
            <View key={m._id || i} style={s.recentRow}>
              <View style={s.recentTicker}><Text style={s.recentTickerText}>{m.ticker}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.recentName}>{m.companyName || m.ticker}</Text>
                <Text style={s.recentDate}>{new Date(m.createdAt).toLocaleDateString()}</Text>
              </View>
              {m.results?.intrinsicPerShare?.blended && (
                <Text style={s.recentPrice}>{fmt$(m.results.intrinsicPerShare.blended, 2)}</Text>
              )}
            </View>
          ))}
        </>
      )}

      {loading && <ActivityIndicator color="#0EA5E9" style={{ marginTop: 24 }} />}

      {/* Disclaimer */}
      <View style={s.disclaimer}>
        <Ionicons name="warning-outline" size={14} color="#B45309" />
        <Text style={s.disclaimerText}>  For informational purposes only. Not investment advice. Based on public filings and third-party data.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1B2A' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  header: { marginBottom: 28 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: '#64748B', fontSize: 14, marginTop: 4 },
  sectionLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  card: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  cardBlue: { backgroundColor: '#0EA5E911', borderColor: '#0EA5E933' },
  cardGreen: { backgroundColor: '#10B98111', borderColor: '#10B98133' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  cardDesc: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  cardChip: { marginTop: 12, backgroundColor: '#0EA5E922', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  cardChipText: { color: '#0EA5E9', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  methodBox: { backgroundColor: '#162232', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#1B2A3B' },
  methodRow: { flexDirection: 'row', marginBottom: 14 },
  methodTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  methodDesc: { color: '#64748B', fontSize: 12, marginTop: 2 },
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#162232', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1B2A3B' },
  recentTicker: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12 },
  recentTickerText: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },
  recentName: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  recentDate: { color: '#64748B', fontSize: 11, marginTop: 2 },
  recentPrice: { color: '#10B981', fontWeight: '700', fontSize: 15 },
  disclaimer: { flexDirection: 'row', backgroundColor: '#FFF8E122', borderRadius: 10, padding: 12, marginTop: 8, alignItems: 'flex-start' },
  disclaimerText: { color: '#B45309', fontSize: 11, flex: 1, lineHeight: 16 },
});
