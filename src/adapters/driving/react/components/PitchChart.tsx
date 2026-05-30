import { useEffect, useRef } from 'react';

import type { Calibration } from '../../../../core/domain/calibration.js';
import { normalize } from '../../../../core/domain/calibration.js';
import type { ContourPoint } from '../../../../core/domain/tones.js';
import type { PitchSample } from '../../../../core/ports/driven/PitchDetector.js';

type Props = {
  liveBufferRef: { current: PitchSample[] };
  target?: ContourPoint[];
  calibration?: Calibration | null;
  windowMs?: number;
};

const DARK_PALETTE = {
  bg: '#0f172a',
  grid: '#1e293b',
  target: '#475569',
  live: '#7dd3fc',
};

const LIGHT_PALETTE = {
  bg: '#f1f5f9',
  grid: '#cbd5e1',
  target: '#94a3b8',
  live: '#0284c7',
};

export function PitchChart({ liveBufferRef, target, calibration, windowMs = 1500 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mq = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const draw = () => {
      const isDark = mq?.matches ?? true;
      const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (target && target.length > 1) {
        ctx.strokeStyle = palette.target;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const tMax = target[target.length - 1]!.tMs;
        const xOf = (tMs: number) => (tMs / tMax) * (w * 0.9) + w * 0.05;
        const yOf = (p: number) => h - p * h;
        ctx.moveTo(xOf(target[0]!.tMs), yOf(target[0]!.pitch));
        for (const p of target.slice(1)) ctx.lineTo(xOf(p.tMs), yOf(p.pitch));
        ctx.stroke();
      }

      const buf = liveBufferRef.current;
      if (calibration && buf.length > 1) {
        ctx.strokeStyle = palette.live;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const last = buf[buf.length - 1]!;
        const winStart = last.timestamp - windowMs;
        let started = false;
        for (const s of buf) {
          if (s.hz === null) {
            started = false;
            continue;
          }
          const x = ((s.timestamp - winStart) / windowMs) * w;
          const y = h - normalize(s.hz, calibration) * h;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [liveBufferRef, target, calibration, windowMs]);

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={240}
      className="w-full h-60 rounded-lg border border-slate-200 dark:border-slate-800"
    />
  );
}
