import type { Random } from '../../ports/driven/Random.js';
import type { Verdict } from '../scoring.js';
import type { SyllableKey, Tone } from '../tones.js';

export type SyllableTarget = { syllable: SyllableKey; tone: Tone; character: string };

export type RotationState = {
  current: SyllableTarget;
  recentResults: Record<SyllableKey, boolean[]>;
};

const RECENT_WINDOW = 5;
const PASSES_TO_ROTATE = 3;

export function recordResult(
  state: RotationState,
  syllable: SyllableKey,
  verdict: Verdict,
): RotationState {
  const prev = state.recentResults[syllable] ?? [];
  const next = [...prev, verdict.pass].slice(-RECENT_WINDOW);
  return {
    current: state.current,
    recentResults: { ...state.recentResults, [syllable]: next },
  };
}

export function shouldRotate(state: RotationState, syllable: SyllableKey): boolean {
  const recent = state.recentResults[syllable] ?? [];
  if (recent.length < PASSES_TO_ROTATE) return false;
  const passes = recent.filter((p) => p).length;
  return passes >= PASSES_TO_ROTATE;
}

export function nextSyllable(
  state: RotationState,
  candidates: SyllableTarget[],
  rng: Random,
): SyllableTarget {
  if (candidates.length === 0) return state.current;
  const others = candidates.filter(
    (c) => !(c.syllable === state.current.syllable && c.tone === state.current.tone),
  );
  const pool = others.length > 0 ? others : candidates;
  return pool[Math.floor(rng.next() * pool.length)]!;
}
