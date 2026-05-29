import { describe, expect, it } from 'vitest';

import { targetContour, type ContourPoint } from './tones.js';

describe('targetContour', () => {
  it('produces a flat-high contour for T1 (Mandarin high level)', () => {
    expect(targetContour(1, 1000)).toEqual<ContourPoint[]>([
      { tMs: 0, pitch: 0.85 },
      { tMs: 1000, pitch: 0.85 },
    ]);
  });

  it('produces a rising contour for T2 over the full duration', () => {
    expect(targetContour(2, 800)).toEqual<ContourPoint[]>([
      { tMs: 0, pitch: 0.4 },
      { tMs: 800, pitch: 0.9 },
    ]);
  });

  it('produces a dipping contour for T3 with the trough at the midpoint', () => {
    expect(targetContour(3, 1200)).toEqual<ContourPoint[]>([
      { tMs: 0, pitch: 0.45 },
      { tMs: 600, pitch: 0.1 },
      { tMs: 1200, pitch: 0.55 },
    ]);
  });

  it('produces a sharp-fall contour for T4', () => {
    expect(targetContour(4, 500)).toEqual<ContourPoint[]>([
      { tMs: 0, pitch: 0.95 },
      { tMs: 500, pitch: 0.2 },
    ]);
  });

  it('scales knot times linearly with the requested duration', () => {
    const points = targetContour(3, 2000);
    expect(points.map((p) => p.tMs)).toEqual([0, 1000, 2000]);
  });

  it('keeps pitch values normalized in [0,1] (independent of duration)', () => {
    const points = targetContour(2, 1234);
    for (const p of points) {
      expect(p.pitch).toBeGreaterThanOrEqual(0);
      expect(p.pitch).toBeLessThanOrEqual(1);
    }
  });
});
