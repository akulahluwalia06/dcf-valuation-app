import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  label: string;
}

export default function Slider({ value, min, max, step = 0.001, onChange, formatValue, label }: SliderProps) {
  const display = formatValue ? formatValue(value) : value.toString();

  if (Platform.OS === 'web') {
    return (
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{display}</Text>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#0EA5E9',
            cursor: 'pointer',
            marginTop: 6,
            marginBottom: 2,
          }}
        />
        <View style={s.rangeLabels}>
          <Text style={s.rangeText}>{formatValue ? formatValue(min) : min}</Text>
          <Text style={s.rangeText}>{formatValue ? formatValue(max) : max}</Text>
        </View>
      </View>
    );
  }

  // Native fallback — simple display (full native slider can be added later)
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{display}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginBottom: 20 },
  label: { color: '#64748B', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { color: '#334155', fontSize: 10 },
});
