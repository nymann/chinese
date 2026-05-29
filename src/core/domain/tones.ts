export type Tone = 1 | 2 | 3 | 4;

export type SyllableKey = string;

export type VoiceId = string;

export type CorpusItem = {
  id: string;
  syllable: SyllableKey;
  tone: Tone;
  voice: VoiceId;
  url: string;
};
