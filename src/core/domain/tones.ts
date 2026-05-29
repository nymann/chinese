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

export type ContourPoint = { tMs: number; pitch: number };

type ShapeKnot = { t: number; pitch: number };

const TONE_SHAPES: Record<Tone, readonly ShapeKnot[]> = {
  1: [{ t: 0, pitch: 0.85 }, { t: 1, pitch: 0.85 }],
  2: [{ t: 0, pitch: 0.40 }, { t: 1, pitch: 0.90 }],
  3: [{ t: 0, pitch: 0.45 }, { t: 0.5, pitch: 0.10 }, { t: 1, pitch: 0.55 }],
  4: [{ t: 0, pitch: 0.95 }, { t: 1, pitch: 0.20 }],
};

export function targetContour(tone: Tone, durationMs: number): ContourPoint[] {
  return TONE_SHAPES[tone].map(({ t, pitch }) => ({
    tMs: t * durationMs,
    pitch,
  }));
}
