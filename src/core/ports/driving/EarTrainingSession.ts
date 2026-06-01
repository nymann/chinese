import type { EarLevel, PairStat } from '../../domain/adaptive/mastery.js';
import type { CorpusItem, SyllableClip, Tone } from '../../domain/tones.js';

export type EarTrainingMode = 'discrimination' | 'identification';

export type DiscriminationItem = {
  mode: 'discrimination';
  a: SyllableClip;
  b: SyllableClip;
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
  /** Resolves with `true` if the prompt audio actually played; `false` if it was blocked (e.g. mobile autoplay). */
  start(mode: EarTrainingMode): Promise<boolean>;
  current(): CurrentEarItem | null;
  replay(): Promise<boolean>;
  answer(choice: EarChoice): Promise<FeedbackFlash>;
  advance(): Promise<boolean>;
  stats(): SessionStats;
  gateToStep2Unlocked(): boolean;
  level(): EarLevel;
  levelPairs(): ReadonlyArray<readonly [Tone, Tone]>;
  levelTones(): readonly Tone[];
  levelProgress(): { masteredPairs: number; totalPairs: number };
  levelPairStats(): readonly PairStat[];
  end(): Promise<SessionStats>;
}
