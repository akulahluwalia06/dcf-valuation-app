import React, { useState, useEffect, useRef } from 'react';
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

// Inject global slider CSS once
let cssInjected = false;
function injectSliderCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .dcf-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 4px;
      outline: none;
      border: none;
      cursor: pointer;
      margin-top: 10px;
      margin-bottom: 6px;
      display: block;
    }
    .dcf-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00FF80;
      cursor: pointer;
      border: 2px solid #000;
      box-shadow: 0 0 6px #00FF8066;
    }
    .dcf-slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00FF80;
      cursor: pointer;
      border: 2px solid #000;
      box-shadow: 0 0 6px #00FF8066;
    }
    .dcf-slider::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 4px;
    }
    .dcf-slider::-moz-range-track {
      height: 6px;
      border-radius: 4px;
      background: #1a2a1a;
    }
    .dcf-slider::-moz-range-progress {
      height: 6px;
      border-radius: 4px;
      background: #00FF80;
    }
  `;
  document.head.appendChild(style);
}

export default function Slider({ value, min, max, step = 0.001, onChange, formatValue, label }: SliderProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    injectSliderCSS();
    setMounted(true);
  }, []);

  const display = formatValue ? formatValue(value) : value.toFixed(3);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const trackBg = `linear-gradient(to right, #00FF80 0%, #00FF80 ${pct}%, #1a2a1a ${pct}%, #1a2a1a 100%)`;

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
            className="dcf-slider"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            style={{ background: trackBg } as any}
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
