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

export function PitchChart({ liveBufferRef, target, calibration, windowMs = 1500 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (target && target.length > 1) {
        ctx.strokeStyle = '#475569';
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
        ctx.strokeStyle = '#7dd3fc';
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
      className="w-full h-60 rounded-lg border border-slate-800"
    />
  );
}
