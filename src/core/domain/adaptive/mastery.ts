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

export type EarLevel = 1 | 2 | 3 | 4 | 5;

const ALL_PAIRS: ReadonlyArray<readonly [Tone, Tone]> = [
  [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
];

const LEVEL_PAIRS: Record<EarLevel, ReadonlyArray<readonly [Tone, Tone]>> = {
  1: [[1, 4]],
  2: [[1, 2], [1, 4], [2, 4]],
  3: [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4]],
  4: ALL_PAIRS,
  5: ALL_PAIRS,
};

const LEVEL_TONES: Record<EarLevel, readonly Tone[]> = {
  1: [1, 4],
  2: [1, 2, 4],
  3: [1, 2, 3, 4],
  4: [1, 2, 3, 4],
  5: [1, 2, 3, 4],
};

export type VoiceCohort = number | 'all';

const LEVEL_VOICE_COHORT: Record<EarLevel, VoiceCohort> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 'all',
};

export function pairsForLevel(
  level: EarLevel,
): ReadonlyArray<readonly [Tone, Tone]> {
  return LEVEL_PAIRS[level];
}

export function tonesForLevel(level: EarLevel): readonly Tone[] {
  return LEVEL_TONES[level];
}

export function voiceCohortForLevel(level: EarLevel): VoiceCohort {
  return LEVEL_VOICE_COHORT[level];
}

export function emptyMastery(now: number): Mastery {
  return { identification: {}, discrimination: {}, updatedAt: now };
}

export function posteriorAccuracy(cell: CellStat): number {
  return (cell.correct + 1) / (cell.trials + 2);
}

export type PairStat = {
  pair: readonly [Tone, Tone];
  trials: number;
  correct: number;
  posterior: number;
  progress: number;
  mastered: boolean;
};

const PRIOR = 0.5;

export function masteryProgress(
  trials: number,
  posterior: number,
  threshold = 0.85,
  minTrials = 20,
): number {
  const byTrials = Math.min(trials / minTrials, 1);
  const byAccuracy = Math.max(0, Math.min((posterior - PRIOR) / (threshold - PRIOR), 1));
  return byTrials * byAccuracy;
}

export function pairStat(
  mastery: Mastery,
  a: Tone,
  b: Tone,
  threshold = 0.85,
  minTrials = 20,
): PairStat {
  const stat = pairStats(mastery, a, b);
  const posterior = posteriorAccuracy(stat);
  const progress = masteryProgress(stat.trials, posterior, threshold, minTrials);
  return {
    pair: [a, b],
    trials: stat.trials,
    correct: stat.correct,
    posterior,
    progress,
    mastered: stat.trials >= minTrials && posterior >= threshold,
  };
}

export function levelPairStats(
  level: EarLevel,
  mastery: Mastery,
  threshold = 0.85,
  minTrials = 20,
): PairStat[] {
  return LEVEL_PAIRS[level].map(([a, b]) =>
    pairStat(mastery, a, b, threshold, minTrials),
  );
}

function pairStatsIdentification(
  mastery: Mastery,
  a: Tone,
  b: Tone,
): CellStat {
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

function pairStatsDiscrimination(
  mastery: Mastery,
  a: Tone,
  b: Tone,
): CellStat {
  const lo = (a < b ? a : b) as Tone;
  const hi = (a < b ? b : a) as Tone;
  const cell = mastery.discrimination[`${lo}|${hi}`];
  return cell
    ? { trials: cell.trials, correct: cell.correct }
    : { trials: 0, correct: 0 };
}

function pairStats(mastery: Mastery, a: Tone, b: Tone): CellStat {
  const i = pairStatsIdentification(mastery, a, b);
  const d = pairStatsDiscrimination(mastery, a, b);
  return { trials: i.trials + d.trials, correct: i.correct + d.correct };
}

export function weakestPair(
  mastery: Mastery,
): { tones: [Tone, Tone]; confidence: number } | null {
  let worst: { tones: [Tone, Tone]; confidence: number } | null = null;
  for (let i = 0; i < TONES.length; i++) {
    for (let j = i + 1; j < TONES.length; j++) {
      const a = TONES[i]!;
      const b = TONES[j]!;
      const stat = pairStatsIdentification(mastery, a, b);
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

export function levelMastered(
  level: EarLevel,
  mastery: Mastery,
  threshold = 0.85,
  minTrials = 20,
): boolean {
  for (const [a, b] of LEVEL_PAIRS[level]) {
    const stat = pairStats(mastery, a, b);
    if (stat.trials < minTrials) return false;
    if (posteriorAccuracy(stat) < threshold) return false;
  }
  return true;
}

export function currentLevel(
  mastery: Mastery,
  threshold = 0.85,
  minTrials = 20,
): EarLevel {
  if (!levelMastered(1, mastery, threshold, minTrials)) return 1;
  if (!levelMastered(2, mastery, threshold, minTrials)) return 2;
  if (!levelMastered(3, mastery, threshold, minTrials)) return 3;
  if (!levelMastered(4, mastery, threshold, minTrials)) return 4;
  return 5;
}

export function levelProgress(
  level: EarLevel,
  mastery: Mastery,
  threshold = 0.85,
  minTrials = 20,
): { masteredPairs: number; totalPairs: number } {
  const pairs = LEVEL_PAIRS[level];
  let mastered = 0;
  for (const [a, b] of pairs) {
    const stat = pairStats(mastery, a, b);
    if (stat.trials >= minTrials && posteriorAccuracy(stat) >= threshold) {
      mastered += 1;
    }
  }
  return { masteredPairs: mastered, totalPairs: pairs.length };
}
