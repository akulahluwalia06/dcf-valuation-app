import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const display = formatValue ? formatValue(value) : value.toFixed(3);

  return (
    <View style={s.row}>
      <View style={s.topRow}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{display}</Text>
      </View>
      {mounted && (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#00FF80',
              cursor: 'pointer',
              marginTop: 8,
              marginBottom: 4,
              height: 4,
              background: `linear-gradient(to right, #00FF80 0%, #00FF80 ${((value - min) / (max - min)) * 100}%, #1a2a1a ${((value - min) / (max - min)) * 100}%, #1a2a1a 100%)`,
              borderRadius: 4,
              outline: 'none',
              border: 'none',
              WebkitAppearance: 'none',
            } as any}
          />
          <View style={s.rangeLabels}>
            <Text style={s.rangeText}>{formatValue ? formatValue(min) : min}</Text>
            <Text style={s.rangeText}>{formatValue ? formatValue(max) : max}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginBottom: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: '#64748B', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'monospace', flex: 1 },
  value: { color: '#00FF80', fontSize: 20, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 1 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  rangeText: { color: '#4a7a5a', fontSize: 9, fontFamily: 'monospace' },
});
