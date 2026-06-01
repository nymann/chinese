import type {
  CorpusItem,
  SyllableClip,
  SyllableKey,
  Tone,
  VoiceInfo,
} from '../../domain/tones.js';

export type SyllableEntry = {
  syllable: SyllableKey;
  tone: Tone;
  character: string;
};

export interface CorpusRepository {
  /** Word clips for the identification drill ("Which tone?"). */
  load(): Promise<CorpusItem[]>;
  /** Single-syllable clips for the discrimination drill ("Same or different?"). */
  syllableClips(): Promise<SyllableClip[]>;
  /** Syllable metadata for the pitch mirror (Step 2); no audio. */
  syllables(): Promise<SyllableEntry[]>;
  voices(): VoiceInfo[];
}
