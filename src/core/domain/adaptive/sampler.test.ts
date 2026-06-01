import { describe, expect, it } from 'vitest';

import type { Random } from '../../ports/driven/Random.js';
import type { CorpusItem, SyllableClip, Tone } from '../tones.js';

import {
  emptyMastery,
  pairsForLevel,
  tonesForLevel,
  type Mastery,
} from './mastery.js';
import {
  nextDiscriminationPair,
  nextIdentificationItem,
  type SamplerConstraints,
} from './sampler.js';

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

const ALL_VOICES: readonly string[] = ['v1', 'v2', 'v3'];

const ALL_PAIRS: SamplerConstraints = {
  allowedTones: [1, 2, 3, 4],
  allowedPairs: [
    [1, 2], [1, 3], [1, 4],
    [2, 3], [2, 4], [3, 4],
  ],
  allowedVoices: ALL_VOICES,
};

function makeCorpus(): CorpusItem[] {
  const items: CorpusItem[] = [];
  for (const syllable of ['ma', 'shi']) {
    for (const tone of [1, 2, 3, 4] as const) {
      for (const voice of ['v1', 'v2', 'v3']) {
        items.push({
          id: `${syllable}-${tone}-${voice}`,
          word: syllable,
          pinyin: syllable,
          syllables: [syllable],
          tones: [tone],
          gloss: '',
          targetIndex: 0,
          tone,
          voice,
          url: '',
        });
      }
    }
  }
  return items;
}

function makeSyllableClips(): SyllableClip[] {
  const items: SyllableClip[] = [];
  for (const syllable of ['ma', 'shi']) {
    for (const tone of [1, 2, 3, 4] as const) {
      for (const voice of ['v1', 'v2', 'v3']) {
        for (const take of [0, 1]) {
          items.push({
            id: `${syllable}-${tone}-${voice}-${take}`,
            syllable,
            tone,
            character: syllable,
            voice,
            url: '',
          });
        }
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
      const item = nextIdentificationItem(corpus, mastery, rng, ALL_PAIRS);
      counts[item.tone]! += 1;
    }
    const weakShare = (counts[2]! + counts[3]!) / 400;
    expect(weakShare).toBeGreaterThan(0.55);
  });

  it('returns items from the corpus', () => {
    const corpus = makeCorpus();
    const rng = seededRng(1);
    const item = nextIdentificationItem(
      corpus,
      emptyMastery(0),
      rng,
      ALL_PAIRS,
    );
    expect(corpus).toContain(item);
  });

  it('respects level-1 constraints — only plays T1 or T4', () => {
    const corpus = makeCorpus();
    const rng = seededRng(7);
    const constraints: SamplerConstraints = {
      allowedTones: tonesForLevel(1),
      allowedPairs: pairsForLevel(1),
      allowedVoices: ALL_VOICES,
    };
    const tones = new Set<Tone>();
    for (let i = 0; i < 200; i++) {
      tones.add(nextIdentificationItem(corpus, emptyMastery(0), rng, constraints).tone);
    }
    expect([...tones].sort()).toEqual([1, 4]);
  });

  it('respects allowedVoices — only sampled voices appear', () => {
    const corpus = makeCorpus();
    const rng = seededRng(99);
    const constraints: SamplerConstraints = {
      allowedTones: [1, 2, 3, 4],
      allowedPairs: [[1, 2], [3, 4]],
      allowedVoices: ['v1'],
    };
    for (let i = 0; i < 100; i++) {
      const item = nextIdentificationItem(corpus, emptyMastery(0), rng, constraints);
      expect(item.voice).toBe('v1');
    }
  });
});

describe('nextDiscriminationPair', () => {
  it('randomizes which tone in the pair plays first', () => {
    const clips = makeSyllableClips();
    const rng = seededRng(13);
    const constraints: SamplerConstraints = {
      allowedTones: tonesForLevel(1),
      allowedPairs: pairsForLevel(1),
      allowedVoices: ALL_VOICES,
    };
    const firstTones = new Map<Tone, number>();
    for (let i = 0; i < 200; i++) {
      const { a } = nextDiscriminationPair(clips, emptyMastery(0), rng, constraints);
      firstTones.set(a.tone, (firstTones.get(a.tone) ?? 0) + 1);
    }
    expect([...firstTones.keys()].sort()).toEqual([1, 4]);
    // Roughly balanced — neither side > 80%
    const t1 = firstTones.get(1) ?? 0;
    const t4 = firstTones.get(4) ?? 0;
    expect(t1 / 200).toBeGreaterThan(0.3);
    expect(t4 / 200).toBeGreaterThan(0.3);
  });

  it('respects level-1 constraints — only pairs T1 with T4', () => {
    const clips = makeSyllableClips();
    const rng = seededRng(11);
    const constraints: SamplerConstraints = {
      allowedTones: tonesForLevel(1),
      allowedPairs: pairsForLevel(1),
      allowedVoices: ALL_VOICES,
    };
    for (let i = 0; i < 200; i++) {
      const { a, b, isSame } = nextDiscriminationPair(clips, emptyMastery(0), rng, constraints);
      const usedTones = new Set([a.tone, b.tone]);
      // both cases keep syllable + voice constant
      expect(b.syllable).toBe(a.syllable);
      expect(b.voice).toBe(a.voice);
      if (isSame) {
        expect(usedTones.size).toBe(1);
        expect([1, 4]).toContain([...usedTones][0]);
        // a different recording of the same tone — not the identical clip
        expect(b.id).not.toBe(a.id);
      } else {
        expect(usedTones).toEqual(new Set([1, 4]));
      }
    }
  });
});
