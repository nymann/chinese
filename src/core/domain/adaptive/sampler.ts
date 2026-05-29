import type { Random } from '../../ports/driven/Random.js';
import type { CorpusItem, Tone } from '../tones.js';

import type { Mastery } from './mastery.js';
import { posteriorAccuracy, weakestPair } from './mastery.js';

const TONES: readonly Tone[] = [1, 2, 3, 4];
const WEAK_BIAS = 0.7;
const STRONG_BIAS = 0.9;
const MIN_TRIALS_FOR_BIAS = 5;

export function nextIdentificationItem(
  corpus: CorpusItem[],
  mastery: Mastery,
  rng: Random,
): CorpusItem {
  if (corpus.length === 0) throw new Error('nextIdentificationItem: empty corpus');
  const tone = pickTargetTone(mastery, rng);
  return pickByTone(corpus, tone, rng) ?? pickAny(corpus, rng);
}

export function nextDiscriminationItem(
  corpus: CorpusItem[],
  mastery: Mastery,
  rng: Random,
): { a: CorpusItem; b: CorpusItem; isSame: boolean } {
  if (corpus.length < 2) {
    throw new Error('nextDiscriminationItem: corpus needs ≥ 2 items');
  }
  const a = nextIdentificationItem(corpus, mastery, rng);
  const isSame = rng.next() < 0.5;
  if (isSame) {
    const sameTone = corpus.filter(
      (c) => c.syllable === a.syllable && c.tone === a.tone && c.id !== a.id,
    );
    if (sameTone.length === 0) {
      return { a, b: a, isSame: true };
    }
    return { a, b: pick(sameTone, rng), isSame: true };
  }
  const otherTones = corpus.filter(
    (c) => c.syllable === a.syllable && c.tone !== a.tone,
  );
  if (otherTones.length === 0) {
    const anyOther = corpus.filter((c) => c.tone !== a.tone);
    return { a, b: pick(anyOther, rng), isSame: false };
  }
  return { a, b: pick(otherTones, rng), isSame: false };
}

function pickTargetTone(mastery: Mastery, rng: Random): Tone {
  const weak = weakestPair(mastery);
  const r = rng.next();
  if (weak !== null && weak.confidence < STRONG_BIAS && r < WEAK_BIAS) {
    return rng.next() < 0.5 ? weak.tones[0] : weak.tones[1];
  }
  if (r < WEAK_BIAS + 0.2) {
    return TONES[Math.floor(rng.next() * TONES.length)]!;
  }
  const strongest = strongestTone(mastery);
  return strongest ?? TONES[Math.floor(rng.next() * TONES.length)]!;
}

function strongestTone(mastery: Mastery): Tone | null {
  let best: { tone: Tone; confidence: number } | null = null;
  for (const t of TONES) {
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
