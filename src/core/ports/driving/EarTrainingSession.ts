import type { EarLevel, PairStat } from '../../domain/adaptive/mastery.js';
import type { CorpusItem, Tone } from '../../domain/tones.js';

export type EarTrainingMode = 'discrimination' | 'identification';

export type DiscriminationItem = {
  mode: 'discrimination';
  a: CorpusItem;
  b: CorpusItem;
  isSame: boolean;
};

export type IdentificationItem = {
  mode: 'identification';
  item: CorpusItem;
};

export type CurrentEarItem = DiscriminationItem | IdentificationItem;

export type EarChoice =
  | { kind: 'same' | 'different' }
  | { kind: 'tone'; tone: Tone };

export type SessionStats = {
  trials: number;
  correct: number;
};

export type FeedbackFlash = 'correct' | 'wrong' | null;

export interface EarTrainingSession {
  start(mode: EarTrainingMode): Promise<void>;
  current(): CurrentEarItem | null;
  replay(): Promise<void>;
  answer(choice: EarChoice): Promise<FeedbackFlash>;
  advance(): Promise<void>;
  stats(): SessionStats;
  gateToStep2Unlocked(): boolean;
  level(): EarLevel;
  levelPairs(): ReadonlyArray<readonly [Tone, Tone]>;
  levelTones(): readonly Tone[];
  levelProgress(): { masteredPairs: number; totalPairs: number };
  levelPairStats(): readonly PairStat[];
  end(): Promise<SessionStats>;
}
