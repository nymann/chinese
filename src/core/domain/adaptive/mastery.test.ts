import { describe, expect, it } from 'vitest';

import {
  emptyMastery,
  gatePassed,
  posteriorAccuracy,
  weakestPair,
  type Mastery,
} from './mastery.js';

const NOW = 1_716_000_000_000;

type IdentificationMap = Mastery['identification'];

function masteryWith(identification: IdentificationMap): Mastery {
  return {
    identification,
    discrimination: {},
    updatedAt: NOW,
  };
}

describe('posteriorAccuracy', () => {
  it('returns 0.5 for an empty cell (Beta(1,1) prior mean)', () => {
    expect(posteriorAccuracy({ trials: 0, correct: 0 })).toBeCloseTo(0.5, 10);
  });

  it('returns the Beta(1,1) posterior mean (correct + 1) / (trials + 2)', () => {
    expect(posteriorAccuracy({ trials: 8, correct: 6 })).toBeCloseTo(7 / 10, 10);
    expect(posteriorAccuracy({ trials: 100, correct: 90 })).toBeCloseTo(91 / 102, 10);
  });

  it('shrinks extreme counts toward 0.5 (the prior holds back overconfidence)', () => {
    expect(posteriorAccuracy({ trials: 2, correct: 2 })).toBeCloseTo(3 / 4, 10);
    expect(posteriorAccuracy({ trials: 2, correct: 0 })).toBeCloseTo(1 / 4, 10);
  });
});

describe('emptyMastery', () => {
  it('produces an empty record stamped with the given time', () => {
    const m = emptyMastery(NOW);
    expect(m.identification).toEqual({});
    expect(m.discrimination).toEqual({});
    expect(m.updatedAt).toBe(NOW);
  });
});

describe('weakestPair', () => {
  it('returns null when no pair has at least 5 aggregated trials', () => {
    expect(weakestPair(emptyMastery(NOW))).toBeNull();
    expect(
      weakestPair(
        masteryWith({
          '1->1': { trials: 2, correct: 2 },
          '2->2': { trials: 2, correct: 2 },
        }),
      ),
    ).toBeNull();
  });

  it('returns the unordered pair (A,B) with the lowest aggregated posterior accuracy', () => {
    // T2 vs T3 is the classic Mandarin confusion — set it as worst.
    const m = masteryWith({
      '1->1': { trials: 20, correct: 19 },
      '2->2': { trials: 10, correct: 5 },
      '2->3': { trials: 5, correct: 0 },
      '3->2': { trials: 5, correct: 0 },
      '3->3': { trials: 10, correct: 6 },
      '4->4': { trials: 20, correct: 18 },
    });

    const w = weakestPair(m);

    expect(w).not.toBeNull();
    expect(w!.tones).toEqual([2, 3]);
    // Pair (2,3): trials = 10+5+5+10 = 30; correct = 5+0+0+6 = 11
    // Posterior = (11+1)/(30+2) = 12/32 = 0.375
    expect(w!.confidence).toBeCloseTo(12 / 32, 10);
  });

  it('ignores pairs whose aggregated trials are below the minimum (5)', () => {
    // Pair (1,2) has the worst posterior (0 correct of 4) but only 4 aggregated
    // trials — it must be skipped. Without the gate it would otherwise be the
    // weakest pair returned.
    const m = masteryWith({
      '1->1': { trials: 2, correct: 0 },
      '2->2': { trials: 2, correct: 0 },
      '3->3': { trials: 50, correct: 50 },
      '4->4': { trials: 50, correct: 50 },
    });

    const w = weakestPair(m);

    expect(w).not.toBeNull();
    expect(w!.tones).not.toEqual([1, 2]);
  });
});

describe('gatePassed', () => {
  it('returns false on an empty mastery record', () => {
    expect(gatePassed(emptyMastery(NOW))).toBe(false);
  });

  it('returns false when an adjacent pair has fewer than minTrials aggregated trials', () => {
    // Adjacent pair (1,2): trials = 5 + 10 = 15 < 20 — should fail.
    // Adjacent pairs (2,3)=30 and (3,4)=40 are fine.
    const m = masteryWith({
      '1->1': { trials: 5, correct: 5 },
      '2->2': { trials: 10, correct: 9 },
      '3->3': { trials: 20, correct: 18 },
      '4->4': { trials: 20, correct: 18 },
    });

    expect(gatePassed(m)).toBe(false);
  });

  it('returns false when an adjacent pair is below the accuracy threshold', () => {
    // Pair (2,3) and (3,4) get pulled down by a weak T3.
    const m = masteryWith({
      '1->1': { trials: 100, correct: 95 },
      '2->2': { trials: 100, correct: 95 },
      '3->3': { trials: 100, correct: 60 },
      '4->4': { trials: 100, correct: 95 },
    });

    expect(gatePassed(m)).toBe(false);
  });

  it('returns true when every adjacent pair meets the default thresholds', () => {
    const m = masteryWith({
      '1->1': { trials: 50, correct: 47 },
      '2->2': { trials: 50, correct: 47 },
      '3->3': { trials: 50, correct: 47 },
      '4->4': { trials: 50, correct: 47 },
    });

    expect(gatePassed(m)).toBe(true);
  });

  it('respects the provided threshold and minTrials arguments', () => {
    // Adjacent pair aggregates: trials = 20, correct = 18.
    // Posterior = 19/22 ≈ 0.864.
    const m = masteryWith({
      '1->1': { trials: 10, correct: 9 },
      '2->2': { trials: 10, correct: 9 },
      '3->3': { trials: 10, correct: 9 },
      '4->4': { trials: 10, correct: 9 },
    });

    expect(gatePassed(m)).toBe(true);
    expect(gatePassed(m, 0.95, 20)).toBe(false);
    expect(gatePassed(m, 0.85, 30)).toBe(false);
  });
});
