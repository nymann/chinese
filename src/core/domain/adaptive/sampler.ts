import type { Random } from '../../ports/driven/Random.js';
import type { CorpusItem, SyllableClip, Tone } from '../tones.js';

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

export function nextDiscriminationPair(
  clips: SyllableClip[],
  mastery: Mastery,
  rng: Random,
  constraints: SamplerConstraints,
): { a: SyllableClip; b: SyllableClip; isSame: boolean } {
  if (clips.length === 0) {
    throw new Error('nextDiscriminationPair: empty syllable corpus');
  }
  const pool =
    constraints.allowedVoices.length === 0
      ? clips
      : clips.filter((c) => constraints.allowedVoices.includes(c.voice));
  if (pool.length === 0) {
    throw new Error('nextDiscriminationPair: no clips match voice constraints');
  }
  const [toneX, toneY] = pickTargetPair(mastery, rng, constraints);
  const swap = rng.next() < 0.5;
  const toneA = swap ? toneY : toneX;
  const toneB = swap ? toneX : toneY;
  const isSame = rng.next() < 0.5;

  const aPool = pool.filter((c) => c.tone === toneA);
  const a = aPool.length > 0 ? pick(aPool, rng) : pick(pool, rng);
  // "same": a different recording (take) of the same syllable+voice+tone, so the
  // learner judges the tone — not whether the two waveforms are identical.
  if (isSame) {
    const otherTakes = pool.filter(
      (c) =>
        c.syllable === a.syllable &&
        c.voice === a.voice &&
        c.tone === a.tone &&
        c.id !== a.id,
    );
    return { a, b: otherTakes.length > 0 ? pick(otherTakes, rng) : a, isSame: true };
  }
  // "different": the minimal pair — same syllable + voice, only the tone changes.
  const minimalPair = pool.filter(
    (c) => c.syllable === a.syllable && c.voice === a.voice && c.tone === toneB,
  );
  if (minimalPair.length > 0) {
    return { a, b: pick(minimalPair, rng), isSame: false };
  }
  const sameSyllable = pool.filter(
    (c) => c.syllable === a.syllable && c.voice === a.voice && c.tone !== a.tone,
  );
  if (sameSyllable.length > 0) {
    return { a, b: pick(sameSyllable, rng), isSame: false };
  }
  return { a, b: a, isSame: true };
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
