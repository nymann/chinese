import { describe, expect, it } from 'vitest';

import type { Random } from '../../ports/driven/Random.js';
import type { Verdict } from '../scoring.js';

import {
  nextSyllable,
  recordResult,
  shouldRotate,
  type RotationState,
  type SyllableTarget,
} from './rotation.js';

const verdict = (pass: boolean): Verdict => ({
  pass,
  shapeDistance: pass ? 0.05 : 0.5,
  voicedRatio: 0.9,
  durationMs: 600,
});

const seq: SyllableTarget = { syllable: 'ma', tone: 2, character: '麻' };

const stateWith = (
  recent: Record<string, boolean[]>,
  current: SyllableTarget = seq,
): RotationState => ({ current, recentResults: recent });

describe('shouldRotate', () => {
  it('does not rotate before 3 passes seen', () => {
    expect(shouldRotate(stateWith({ ma: [true, true] }), 'ma')).toBe(false);
  });

  it('rotates once 3 of last 5 passed', () => {
    expect(
      shouldRotate(stateWith({ ma: [false, true, true, false, true] }), 'ma'),
    ).toBe(true);
  });

  it('does not rotate when last 5 contain < 3 passes', () => {
    expect(
      shouldRotate(stateWith({ ma: [false, true, true, false, false] }), 'ma'),
    ).toBe(false);
  });
});

describe('recordResult', () => {
  it('appends to the bounded ring buffer for that syllable', () => {
    let s: RotationState = { current: seq, recentResults: {} };
    for (let i = 0; i < 7; i++) s = recordResult(s, 'ma', verdict(i % 2 === 0));
    expect(s.recentResults['ma']).toHaveLength(5);
    expect(s.recentResults['ma']).toEqual([true, false, true, false, true]);
  });
});

describe('nextSyllable', () => {
  it('avoids picking the current syllable+tone when alternatives exist', () => {
    const rng: Random = { next: () => 0 };
    const candidates: SyllableTarget[] = [
      { syllable: 'ma', tone: 2, character: '麻' },
      { syllable: 'ma', tone: 4, character: '骂' },
      { syllable: 'shi', tone: 4, character: '是' },
    ];
    const picked = nextSyllable(
      stateWith({}, candidates[0]!),
      candidates,
      rng,
    );
    expect(
      picked.syllable === candidates[0]!.syllable &&
        picked.tone === candidates[0]!.tone,
    ).toBe(false);
  });
});
