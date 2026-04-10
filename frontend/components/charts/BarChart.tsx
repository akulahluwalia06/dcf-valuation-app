import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Bar {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  bars: Bar[];
  height?: number;
}

export default function BarChart({ bars, height = 120 }: BarChartProps) {
  const max = Math.max(...bars.map(b => b.value), 1);

  return (
    <View style={s.root}>
      <View style={[s.chart, { height }]}>
        {bars.map((bar, i) => (
          <View key={i} style={s.barWrap}>
            <View style={s.barContainer}>
              <View
                style={[
                  s.bar,
                  {
                    height: `${Math.max((bar.value / max) * 100, 4)}%` as any,
                    backgroundColor: bar.color || '#0EA5E9',
                  },
                ]}
              />
            </View>
            <Text style={s.barLabel}>{bar.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { width: '100%' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barWrap: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, minHeight: 4 },
  barLabel: { color: '#475569', fontSize: 9, marginTop: 4, textAlign: 'center' },
});
