import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

export default function AnimatedBackground() {
  const canvasRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const cols = Math.floor((canvas.width || 800) / 20);
    const drops: number[] = Array(cols).fill(0).map(() => Math.random() * -50);
    const chars = '01アイウエオカキクケコ$%#@+=-ABCDEFGHIJKLMNOP0123456789';

    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '11px monospace';

      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const alpha = Math.random() * 0.35 + 0.05;
        ctx.fillStyle = i % 3 === 0
          ? `rgba(0,255,80,${alpha})`
          : i % 3 === 1
          ? `rgba(0,200,60,${alpha * 0.5})`
          : `rgba(0,255,128,${alpha * 0.25})`;
        ctx.fillText(char, i * 20, y * 20);
        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      });

      // subtle grid
      ctx.strokeStyle = 'rgba(0,255,80,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [mounted]);

  if (!mounted) {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', opacity: 0.55 }}
      />
    </View>
  );
}
