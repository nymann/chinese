import type { Mastery } from '../../domain/adaptive/mastery.js';
import type { Tone } from '../../domain/tones.js';

export type TrialRecord = {
  mode: 'discrimination' | 'identification';
  played: Tone;
  perceived: Tone | 'same' | 'different';
  correct: boolean;
  timestamp: number;
};

export interface MasteryRepository {
  load(): Promise<Mastery>;
  save(m: Mastery): Promise<void>;
  appendTrial(t: TrialRecord): Promise<void>;
}
