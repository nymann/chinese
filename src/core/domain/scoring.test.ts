import { describe, expect, it } from 'vitest';

import type { PitchSample } from '../ports/driven/PitchDetector.js';

import type { Calibration } from './calibration.js';
import { scoreAttempt } from './scoring.js';
import { targetContour } from './tones.js';

const CAL: Calibration = {
  lowHz: 100,
  midHz: 150,
  highHz: 200,
  logLow: Math.log2(100),
  logHigh: Math.log2(200),
  recordedAt: 0,
};

function buildVoiced(
  count: number,
  durationMs: number,
  pitchAt: (frac: number) => number,
): PitchSample[] {
  const out: PitchSample[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    const t = frac * durationMs;
    const targetPitch = pitchAt(frac);
    const logHz = CAL.logLow + targetPitch * (CAL.logHigh - CAL.logLow);
    out.push({ hz: 2 ** logHz, clarity: 0.95, timestamp: t });
  }
  return out;
}

describe('scoreAttempt', () => {
  it('passes a clean rising contour against the T2 target', () => {
    const target = targetContour(2, 800);
    const samples = buildVoiced(40, 800, (f) => 0.4 + 0.5 * f);

    const verdict = scoreAttempt(samples, target, CAL);

    expect(verdict.pass).toBe(true);
    expect(verdict.voicedRatio).toBeGreaterThan(0.9);
    expect(verdict.durationMs).toBeCloseTo(800, 0);
    expect(verdict.shapeDistance).toBeLessThan(0.05);
  });

  it('fails a flat contour against the T2 (rising) target', () => {
    const target = targetContour(2, 800);
    const samples = buildVoiced(40, 800, () => 0.65);

    const verdict = scoreAttempt(samples, target, CAL);

    expect(verdict.pass).toBe(false);
    expect(verdict.shapeDistance).toBeGreaterThan(0.1);
  });

  it('fails when too short', () => {
    const target = targetContour(1, 200);
    const samples = buildVoiced(8, 100, () => 0.85);

    const verdict = scoreAttempt(samples, target, CAL);

    expect(verdict.pass).toBe(false);
    expect(verdict.durationMs).toBeLessThan(200);
  });

  it('fails when mostly unvoiced', () => {
    const target = targetContour(1, 600);
    const samples: PitchSample[] = [];
    for (let i = 0; i < 30; i++) {
      const t = (i / 29) * 600;
      if (i % 5 === 0) {
        samples.push({ hz: 150, clarity: 0.95, timestamp: t });
      } else {
        samples.push({ hz: null, clarity: 0.0, timestamp: t });
      }
    }

    const verdict = scoreAttempt(samples, target, CAL);

    expect(verdict.voicedRatio).toBeLessThan(0.6);
    expect(verdict.pass).toBe(false);
  });
});
