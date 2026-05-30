import type { Random } from '../../ports/driven/Random.js';
import type { CorpusItem, Tone } from '../tones.js';

import type { CellStat, Mastery } from './mastery.js';
import { posteriorAccuracy } from './mastery.js';

const WEAK_BIAS = 0.7;
const STRONG_BIAS = 0.9;
const MIN_TRIALS_FOR_BIAS = 5;

export type SamplerConstraints = {
  allowedTones: readonly Tone[];
  allowedPairs: ReadonlyArray<readonly [Tone, Tone]>;
  allowedVoices: readonly string[];
};

function filterCorpus(
  corpus: CorpusItem[],
  constraints: SamplerConstraints,
): CorpusItem[] {
  if (constraints.allowedVoices.length === 0) return corpus;
  return corpus.filter((c) => constraints.allowedVoices.includes(c.voice));
}

export function nextIdentificationItem(
  corpus: CorpusItem[],
  mastery: Mastery,
  rng: Random,
  constraints: SamplerConstraints,
): CorpusItem {
  if (corpus.length === 0) {
    throw new Error('nextIdentificationItem: empty corpus');
  }
  const pool = filterCorpus(corpus, constraints);
  if (pool.length === 0) {
    throw new Error('nextIdentificationItem: no items match voice constraints');
  }
  const tone = pickTargetTone(mastery, rng, constraints);
  return pickByTone(pool, tone, rng) ?? pickAny(pool, rng);
}

export function nextDiscriminationItem(
  corpus: CorpusItem[],
  mastery: Mastery,
  rng: Random,
  constraints: SamplerConstraints,
): { a: CorpusItem; b: CorpusItem; isSame: boolean } {
  if (corpus.length < 2) {
    throw new Error('nextDiscriminationItem: corpus needs ≥ 2 items');
  }
  const pool = filterCorpus(corpus, constraints);
  if (pool.length === 0) {
    throw new Error('nextDiscriminationItem: no items match voice constraints');
  }
  const [toneX, toneY] = pickTargetPair(mastery, rng, constraints);
  const swap = rng.next() < 0.5;
  const toneA = swap ? toneY : toneX;
  const toneB = swap ? toneX : toneY;
  const isSame = rng.next() < 0.5;
  const aPool = pool.filter((c) => c.tone === toneA);
  if (aPool.length === 0) {
    const a = pick(pool, rng);
    return { a, b: a, isSame: true };
  }
  const a = pick(aPool, rng);
  if (isSame) {
    const sameCombo = pool.filter(
      (c) => c.syllable === a.syllable && c.tone === a.tone && c.id !== a.id,
    );
    return { a, b: sameCombo.length > 0 ? pick(sameCombo, rng) : a, isSame: true };
  }
  const sameSyllableOtherTone = pool.filter(
    (c) => c.syllable === a.syllable && c.tone === toneB,
  );
  if (sameSyllableOtherTone.length > 0) {
    return { a, b: pick(sameSyllableOtherTone, rng), isSame: false };
  }
  const anyToneB = pool.filter((c) => c.tone === toneB);
  if (anyToneB.length > 0) {
    return { a, b: pick(anyToneB, rng), isSame: false };
  }
  return {
    a,
    b: pick(pool.filter((c) => c.id !== a.id), rng),
    isSame: false,
  };
}

function pickTargetTone(
  mastery: Mastery,
  rng: Random,
  constraints: SamplerConstraints,
): Tone {
  const tones = constraints.allowedTones;
  const weak = weakestAllowedPair(mastery, constraints.allowedPairs);
  const r = rng.next();
  if (weak !== null && weak.confidence < STRONG_BIAS && r < WEAK_BIAS) {
    return rng.next() < 0.5 ? weak.tones[0] : weak.tones[1];
  }
  if (r < WEAK_BIAS + 0.2) {
    return tones[Math.floor(rng.next() * tones.length)]!;
  }
  const strongest = strongestAllowedTone(mastery, tones);
  return strongest ?? tones[Math.floor(rng.next() * tones.length)]!;
}

function pickTargetPair(
  mastery: Mastery,
  rng: Random,
  constraints: SamplerConstraints,
): readonly [Tone, Tone] {
  const pairs = constraints.allowedPairs;
  if (pairs.length === 0) return [1, 4];
  const weak = weakestAllowedPair(mastery, pairs);
  const r = rng.next();
  if (weak !== null && weak.confidence < STRONG_BIAS && r < WEAK_BIAS) {
    return weak.tones;
  }
  return pairs[Math.floor(rng.next() * pairs.length)]!;
}

function pairStat(mastery: Mastery, a: Tone, b: Tone): CellStat {
  const keys = [`${a}->${a}`, `${a}->${b}`, `${b}->${a}`, `${b}->${b}`] as const;
  let trials = 0;
  let correct = 0;
  for (const k of keys) {
    const cell = mastery.identification[k];
    if (!cell) continue;
    trials += cell.trials;
    correct += cell.correct;
  }
  return { trials, correct };
}

function weakestAllowedPair(
  mastery: Mastery,
  pairs: ReadonlyArray<readonly [Tone, Tone]>,
): { tones: readonly [Tone, Tone]; confidence: number } | null {
  let worst: { tones: readonly [Tone, Tone]; confidence: number } | null = null;
  for (const [a, b] of pairs) {
    const stat = pairStat(mastery, a, b);
    if (stat.trials < MIN_TRIALS_FOR_BIAS) continue;
    const confidence = posteriorAccuracy(stat);
    if (worst === null || confidence < worst.confidence) {
      worst = { tones: [a, b], confidence };
    }
  }
  return worst;
}

function strongestAllowedTone(
  mastery: Mastery,
  tones: readonly Tone[],
): Tone | null {
  let best: { tone: Tone; confidence: number } | null = null;
  for (const t of tones) {
    const cell = mastery.identification[`${t}->${t}`];
    if (!cell || cell.trials < MIN_TRIALS_FOR_BIAS) continue;
    const confidence = posteriorAccuracy(cell);
    if (best === null || confidence > best.confidence) {
      best = { tone: t, confidence };
    }
  }
  return best?.tone ?? null;
}

function pickByTone(corpus: CorpusItem[], tone: Tone, rng: Random): CorpusItem | null {
  const matching = corpus.filter((c) => c.tone === tone);
  if (matching.length === 0) return null;
  return pick(matching, rng);
}

function pickAny(corpus: CorpusItem[], rng: Random): CorpusItem {
  return pick(corpus, rng);
}

function pick<T>(arr: T[], rng: Random): T {
  return arr[Math.floor(rng.next() * arr.length)]!;
}
