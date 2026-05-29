import { describe, expect, it } from 'vitest';

import type { PitchSample } from '../ports/driven/PitchDetector.js';

import { estimateRange } from './calibration.js';

const NOW = 1_716_000_000_000;

function voiced(hz: number, clarity = 0.95): PitchSample {
  return { hz, clarity, timestamp: 0 };
}

describe('estimateRange', () => {
  it('computes 10/50/90 percentiles on the log-Hz scale', () => {
    // 11 voiced samples spaced evenly in log2 from 6.0 to 8.0 (step 0.2).
    // Percentile-by-linear-interpolation lands exactly on indices 1, 5, 9.
    const samples: PitchSample[] = Array.from({ length: 11 }, (_, i) =>
      voiced(2 ** (6 + i * 0.2)),
    );

    const cal = estimateRange(samples, NOW);

    expect(cal.lowHz).toBeCloseTo(2 ** 6.2, 6);
    expect(cal.midHz).toBeCloseTo(2 ** 7.0, 6);
    expect(cal.highHz).toBeCloseTo(2 ** 7.8, 6);
  });

  it('exposes log-Hz endpoints derived from the Hz percentiles', () => {
    const samples = [voiced(100), voiced(200), voiced(400)];

    const cal = estimateRange(samples, NOW);

    expect(cal.logLow).toBeCloseTo(Math.log2(cal.lowHz), 10);
    expect(cal.logHigh).toBeCloseTo(Math.log2(cal.highHz), 10);
  });

  it('drops unvoiced frames where hz is null', () => {
    const samples: PitchSample[] = [
      { hz: null, clarity: 0.99, timestamp: 0 },
      voiced(100),
      voiced(200),
      voiced(400),
      { hz: null, clarity: 0.99, timestamp: 0 },
    ];

    const cal = estimateRange(samples, NOW);

    // After dropping nulls: [100, 200, 400] → median = 200.
    expect(cal.midHz).toBeCloseTo(200, 6);
  });

  it('drops frames with clarity below 0.9', () => {
    const samples: PitchSample[] = [
      voiced(50, 0.5),
      voiced(100),
      voiced(200),
      voiced(400),
      voiced(800, 0.1),
    ];

    const cal = estimateRange(samples, NOW);

    // Surviving samples: [100, 200, 400] → median = 200.
    expect(cal.midHz).toBeCloseTo(200, 6);
  });

  it('records the timestamp it was given', () => {
    const cal = estimateRange(
      [voiced(100), voiced(200), voiced(400)],
      NOW,
    );

    expect(cal.recordedAt).toBe(NOW);
  });
});
