import type { CorpusItem, SyllableKey, Tone } from '../../domain/tones.js';

export type SyllableEntry = {
  syllable: SyllableKey;
  tone: Tone;
  character: string;
};

export interface CorpusRepository {
  load(): Promise<CorpusItem[]>;
  syllables(): Promise<SyllableEntry[]>;
}
