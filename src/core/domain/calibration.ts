import type { PitchSample } from '../ports/driven/PitchDetector.js';

export type Calibration = {
  lowHz: number;
  highHz: number;
  midHz: number;
  logLow: number;
  logHigh: number;
  recordedAt: number;
};

const CLARITY_THRESHOLD = 0.9;

export function estimateRange(samples: PitchSample[], now: number): Calibration {
  const logs: number[] = [];
  for (const s of samples) {
    if (s.hz === null) continue;
    if (s.clarity < CLARITY_THRESHOLD) continue;
    logs.push(Math.log2(s.hz));
  }

  if (logs.length === 0) {
    throw new Error('estimateRange: no voiced samples above clarity threshold');
  }

  logs.sort((a, b) => a - b);

  const logLow = percentile(logs, 0.1);
  const logMid = percentile(logs, 0.5);
  const logHigh = percentile(logs, 0.9);

  return {
    lowHz: 2 ** logLow,
    midHz: 2 ** logMid,
    highHz: 2 ** logHigh,
    logLow,
    logHigh,
    recordedAt: now,
  };
}

function percentile(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const loVal = sortedAsc[lo]!;
  const hiVal = sortedAsc[hi]!;
  if (lo === hi) return loVal;
  return loVal + (pos - lo) * (hiVal - loVal);
}
