import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dcfApi, newsApi } from '../../services/api';
import { fmt$ } from '../../utils/dcfEngine';

export default function HomeScreen() {
  const [recent, setRecent]   = useState<any[]>([]);
  const [news, setNews]       = useState<any[]>([]);
  const [newsError, setNewsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    try {
      const [r, n] = await Promise.allSettled([dcfApi.getRecent(), newsApi.getNews()]);
      if (r.status === 'fulfilled') setRecent(r.value);
      if (n.status === 'fulfilled') { setNews(n.value); setNewsError(false); }
      else setNewsError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#FF8C00" />}
      >
        {/* Header — logo taps back to home */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/')} activeOpacity={0.7}>
            <Text style={s.title}>DCF<Text style={{ color: '#FF8C00' }}>.</Text>TERMINAL</Text>
          </TouchableOpacity>
          <Text style={s.sub}>CFA-GRADE INTRINSIC VALUATION  ·  POWERED BY LIVE FINANCIAL DATA</Text>
        </View>

        {/* Tool cards */}
        <Text style={s.sectionLabel}>▸ TOOLS</Text>
        <View style={s.cardRow}>
          <TouchableOpacity style={[s.card, { borderColor: '#FF8C0033' }]} onPress={() => router.push('/(tabs)/panw')} activeOpacity={0.8}>
            <View style={s.cardIcon}><Ionicons name="shield-checkmark-outline" size={24} color="#FF8C00" /></View>
            <Text style={[s.cardTitle, { color: '#FF8C00' }]}>PANW MODEL</Text>
            <Text style={s.cardDesc}>Pre-built Palo Alto Networks DCF — interactive sliders, live recalculation, 6 analysis tabs</Text>
            <View style={[s.chip, { borderColor: '#FF8C0044' }]}><Text style={[s.chipText, { color: '#FF8C00' }]}>LIVE DATA</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.card, { borderColor: '#0EA5E933' }]} onPress={() => router.push('/(tabs)/dcf')} activeOpacity={0.8}>
            <View style={s.cardIcon}><Ionicons name="calculator-outline" size={24} color="#0EA5E9" /></View>
            <Text style={[s.cardTitle, { color: '#0EA5E9' }]}>DCF TOOL</Text>
            <Text style={s.cardDesc}>Model any stock — auto-populate from live financials, instant sensitivity analysis</Text>
            <View style={[s.chip, { borderColor: '#0EA5E944' }]}><Text style={[s.chipText, { color: '#0EA5E9' }]}>ANY TICKER</Text></View>
          </TouchableOpacity>
        </View>

        {/* Live news */}
        <Text style={s.sectionLabel}>▸ MARKET NEWS</Text>
        {loading && news.length === 0 && !newsError && <ActivityIndicator color="#FF8C00" style={{ marginBottom: 20 }} />}
        {newsError && <Text style={s.newsError}>Unable to load news — pull down to retry</Text>}
        {news.map((a, i) => (
          <TouchableOpacity key={a.id || i} style={s.newsCard} onPress={() => Linking.openURL(a.url)} activeOpacity={0.8}>
            <View style={s.newsTop}>
              <Text style={s.newsPublisher}>{a.publisher}</Text>
              <Text style={s.newsTime}>{timeAgo(a.published)}</Text>
            </View>
            <Text style={s.newsTitle}>{a.title}</Text>
            {a.description ? <Text style={s.newsDesc} numberOfLines={2}>{a.description}</Text> : null}
            {a.tickers.length > 0 && (
              <View style={s.tickerRow}>
                {a.tickers.map((t: string) => (
                  <View key={t} style={s.tickerPill}><Text style={s.tickerPillText}>${t}</Text></View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Methodology */}
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>▸ METHODOLOGY</Text>
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

        {/* Recently modeled */}
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
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace' },
  sub: { color: '#aa7a3a', fontSize: 17, letterSpacing: 1.5, marginTop: 6, fontFamily: 'monospace' },
  sectionLabel: { color: '#FF8C00', fontSize: 17, fontWeight: '700', letterSpacing: 2, marginBottom: 12, fontFamily: 'monospace' },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  card: { flex: 1, backgroundColor: '#050505', borderRadius: 14, padding: 18, borderWidth: 1 },
  cardIcon: { marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8 },
  cardDesc: { color: '#CBD5E1', fontSize: 22, lineHeight: 18, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  chipText: { fontSize: 16, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
  // News
  newsCard: { backgroundColor: '#050505', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#FF8C0018' },
  newsTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  newsPublisher: { color: '#FF8C00', fontSize: 16, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace' },
  newsTime: { color: '#aa7a3a', fontSize: 16, fontFamily: 'monospace' },
  newsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
  newsDesc: { color: '#94A3B8', fontSize: 17, lineHeight: 16, marginBottom: 8 },
  tickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tickerPill: { backgroundColor: '#1a0800', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tickerPillText: { color: '#FF8C00', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  newsError: { color: '#64748B', fontSize: 22, fontFamily: 'monospace', marginBottom: 16, textAlign: 'center' },
  // Methodology
  methodBox: { backgroundColor: '#050505', borderRadius: 12, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: '#FF8C0015' },
  methodRow: { flexDirection: 'row', marginBottom: 14 },
  methodDot: { color: '#FF8C00', fontSize: 12 },
  methodTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  methodDesc: { color: '#94A3B8', fontSize: 22, marginTop: 2 },
  // Recent
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050505', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#FF8C0015' },
  recentTicker: { backgroundColor: '#1a0800', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12 },
  recentTickerText: { color: '#FF8C00', fontWeight: '700', fontSize: 16, fontFamily: 'monospace' },
  recentName: { color: '#CBD5E1', fontSize: 16, fontWeight: '600' },
  recentDate: { color: '#94A3B8', fontSize: 17, marginTop: 2 },
  recentPrice: { color: '#FF8C00', fontWeight: '700', fontSize: 22, fontFamily: 'monospace' },
  disclaimer: { backgroundColor: '#0a0500', borderRadius: 8, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#F59E0B22' },
  disclaimerText: { color: '#D97706', fontSize: 17, lineHeight: 16 },
});
