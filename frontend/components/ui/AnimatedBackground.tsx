import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

// Web-only animated canvas background — finance ticker/grid aesthetic
export default function AnimatedBackground() {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId: number;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Matrix-style falling numbers + grid
    const cols = Math.floor(canvas.width / 20);
    const drops: number[] = Array(cols).fill(0).map(() => Math.random() * -50);
    const chars = '01アイウエオカキクケコ$%#@+=-ABCDEFGHIJKLMNOP';

    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = '11px monospace';

      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const alpha = Math.random() * 0.4 + 0.05;

        // Alternate green shades
        ctx.fillStyle = i % 3 === 0
          ? `rgba(0,255,80,${alpha})`
          : i % 3 === 1
          ? `rgba(0,200,60,${alpha * 0.5})`
          : `rgba(0,255,128,${alpha * 0.3})`;

        ctx.fillText(char, i * 20, y * 20);

        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      });

      // Draw subtle grid lines
      ctx.strokeStyle = 'rgba(0,255,80,0.03)';
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
  }, []);

  if (Platform.OS !== 'web') {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} />;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, opacity: 0.6,
      }}
    />
  );
}
