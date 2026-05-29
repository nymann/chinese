import type { PitchSample } from '../ports/driven/PitchDetector.js';

import type { Calibration } from './calibration.js';
import { normalize } from './calibration.js';
import type { ContourPoint } from './tones.js';

export type Verdict = {
  pass: boolean;
  shapeDistance: number;
  voicedRatio: number;
  durationMs: number;
};

const SHAPE_DISTANCE_THRESHOLD = 0.1;
const VOICED_RATIO_THRESHOLD = 0.6;
const MIN_DURATION_MS = 200;
const MAX_DURATION_MS = 2000;
const RESAMPLE_N = 40;

export function scoreAttempt(
  samples: PitchSample[],
  target: ContourPoint[],
  cal: Calibration,
): Verdict {
  if (samples.length === 0 || target.length === 0) {
    return { pass: false, shapeDistance: 1, voicedRatio: 0, durationMs: 0 };
  }

  const total = samples.length;
  const voicedAll = samples.filter((s) => s.hz !== null && s.clarity >= 0.5);
  const voicedRatio = voicedAll.length / total;

  const firstVoiced = samples.findIndex((s) => s.hz !== null);
  const lastVoiced = findLastIndex(samples, (s) => s.hz !== null);
  if (firstVoiced < 0 || lastVoiced < 0) {
    return { pass: false, shapeDistance: 1, voicedRatio, durationMs: 0 };
  }

  const slice = samples.slice(firstVoiced, lastVoiced + 1);
  const durationMs =
    (slice[slice.length - 1]?.timestamp ?? 0) - (slice[0]?.timestamp ?? 0);

  const observedNormalized: number[] = [];
  for (const s of slice) {
    if (s.hz === null) continue;
    observedNormalized.push(normalize(s.hz, cal));
  }
  if (observedNormalized.length < 4) {
    return { pass: false, shapeDistance: 1, voicedRatio, durationMs };
  }

  const targetSeries = sampleTarget(target, RESAMPLE_N);
  const observedSeries = resample(observedNormalized, RESAMPLE_N);
  const shapeDistance = meanAbsError(observedSeries, targetSeries);

  const pass =
    shapeDistance < SHAPE_DISTANCE_THRESHOLD &&
    voicedRatio > VOICED_RATIO_THRESHOLD &&
    durationMs >= MIN_DURATION_MS &&
    durationMs <= MAX_DURATION_MS;

  return { pass, shapeDistance, voicedRatio, durationMs };
}

function findLastIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return i;
  }
  return -1;
}

function sampleTarget(points: ContourPoint[], n: number): number[] {
  const t0 = points[0]!.tMs;
  const t1 = points[points.length - 1]!.tMs;
  const span = t1 - t0 || 1;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = t0 + (i / (n - 1)) * span;
    out[i] = interpolatePiecewise(points, t);
  }
  return out;
}

function interpolatePiecewise(points: ContourPoint[], t: number): number {
  if (t <= points[0]!.tMs) return points[0]!.pitch;
  if (t >= points[points.length - 1]!.tMs)
    return points[points.length - 1]!.pitch;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (t >= a.tMs && t <= b.tMs) {
      const span = b.tMs - a.tMs || 1;
      const frac = (t - a.tMs) / span;
      return a.pitch + frac * (b.pitch - a.pitch);
    }
  }
  return points[points.length - 1]!.pitch;
}

function resample(values: number[], n: number): number[] {
  const m = values.length;
  if (m === n) return values.slice();
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (m - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const frac = pos - lo;
    out[i] = values[lo]! + frac * (values[hi]! - values[lo]!);
  }
  return out;
}

function meanAbsError(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / n;
}
