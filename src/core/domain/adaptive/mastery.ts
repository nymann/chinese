import type { Tone } from '../tones.js';

export type ConfusionKey = `${Tone}->${Tone}`;
export type DiscriminationKey = `${Tone}|${Tone}`;

export type CellStat = { trials: number; correct: number };

export type Mastery = {
  identification: Partial<Record<ConfusionKey, CellStat>>;
  discrimination: Partial<Record<DiscriminationKey, CellStat>>;
  updatedAt: number;
};

const TONES: readonly Tone[] = [1, 2, 3, 4];
const ADJACENT_PAIRS: ReadonlyArray<readonly [Tone, Tone]> = [
  [1, 2],
  [2, 3],
  [3, 4],
];
const MIN_TRIALS_FOR_WEAKEST = 5;

export function emptyMastery(now: number): Mastery {
  return { identification: {}, discrimination: {}, updatedAt: now };
}

export function posteriorAccuracy(cell: CellStat): number {
  return (cell.correct + 1) / (cell.trials + 2);
}

function pairStats(mastery: Mastery, a: Tone, b: Tone): CellStat {
  const cells: ConfusionKey[] = [
    `${a}->${a}`,
    `${a}->${b}`,
    `${b}->${a}`,
    `${b}->${b}`,
  ];
  let trials = 0;
  let correct = 0;
  for (const key of cells) {
    const cell = mastery.identification[key];
    if (!cell) continue;
    trials += cell.trials;
    correct += cell.correct;
  }
  return { trials, correct };
}

export function weakestPair(
  mastery: Mastery,
): { tones: [Tone, Tone]; confidence: number } | null {
  let worst: { tones: [Tone, Tone]; confidence: number } | null = null;
  for (let i = 0; i < TONES.length; i++) {
    for (let j = i + 1; j < TONES.length; j++) {
      const a = TONES[i]!;
      const b = TONES[j]!;
      const stat = pairStats(mastery, a, b);
      if (stat.trials < MIN_TRIALS_FOR_WEAKEST) continue;
      const confidence = posteriorAccuracy(stat);
      if (worst === null || confidence < worst.confidence) {
        worst = { tones: [a, b], confidence };
      }
    }
  }
  return worst;
}

export function gatePassed(
  mastery: Mastery,
  threshold = 0.85,
  minTrials = 20,
): boolean {
  for (const [a, b] of ADJACENT_PAIRS) {
    const stat = pairStats(mastery, a, b);
    if (stat.trials < minTrials) return false;
    if (posteriorAccuracy(stat) < threshold) return false;
  }
  return true;
}
