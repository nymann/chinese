import { describe, expect, it } from 'vitest';

import type { Random } from '../../ports/driven/Random.js';
import type { CorpusItem } from '../tones.js';

import { emptyMastery, type Mastery } from './mastery.js';
import { nextIdentificationItem } from './sampler.js';

function seededRng(seed: number): Random {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function makeCorpus(): CorpusItem[] {
  const items: CorpusItem[] = [];
  for (const syllable of ['ma', 'shi']) {
    for (const tone of [1, 2, 3, 4] as const) {
      for (const voice of ['v1', 'v2', 'v3']) {
        items.push({
          id: `${syllable}-${tone}-${voice}`,
          syllable,
          tone,
          voice,
          url: '',
        });
      }
    }
  }
  return items;
}

describe('nextIdentificationItem', () => {
  it('biases selection toward the weakest tone pair', () => {
    const mastery: Mastery = {
      identification: {
        '1->1': { trials: 30, correct: 28 },
        '2->2': { trials: 30, correct: 12 },
        '3->3': { trials: 30, correct: 13 },
        '4->4': { trials: 30, correct: 29 },
      },
      discrimination: {},
      updatedAt: 0,
    };
    const corpus = makeCorpus();
    const rng = seededRng(42);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < 400; i++) {
      const item = nextIdentificationItem(corpus, mastery, rng);
      counts[item.tone]! += 1;
    }
    const weakShare = (counts[2]! + counts[3]!) / 400;
    expect(weakShare).toBeGreaterThan(0.55);
  });

  it('returns items from the corpus', () => {
    const corpus = makeCorpus();
    const rng = seededRng(1);
    const item = nextIdentificationItem(corpus, emptyMastery(0), rng);
    expect(corpus).toContain(item);
  });
});
