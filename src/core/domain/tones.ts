export type Tone = 1 | 2 | 3 | 4;

export type SyllableKey = string;

export type VoiceId = string;

export type VoiceInfo = {
  id: VoiceId;
  name: string;
  gender: 'male' | 'female';
  accent: string;
};

export type CorpusItem = {
  id: string;
  word: string;
  pinyin: string;
  /** Toneless per-syllable pinyin (e.g. ['ni','hao']) — shown without leaking the tone. */
  syllables: string[];
  /** Per-syllable tones of the whole word; 0 = neutral. For display. */
  tones: number[];
  gloss: string;
  /** Which syllable the drill targets. */
  targetIndex: number;
  /** The drilled syllable's tone (= tones[targetIndex], always 1–4). */
  tone: Tone;
  voice: VoiceId;
  url: string;
};

// Single isolated syllable — the unit for minimal-pair discrimination
// (same syllable + voice, differing only in tone).
export type SyllableClip = {
  id: string;
  syllable: SyllableKey;
  tone: Tone;
  character: string;
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

const TONE_MARKS: Record<string, Record<Tone, string>> = {
  a: { 1: 'ā', 2: 'á', 3: 'ǎ', 4: 'à' },
  o: { 1: 'ō', 2: 'ó', 3: 'ǒ', 4: 'ò' },
  e: { 1: 'ē', 2: 'é', 3: 'ě', 4: 'è' },
  i: { 1: 'ī', 2: 'í', 3: 'ǐ', 4: 'ì' },
  u: { 1: 'ū', 2: 'ú', 3: 'ǔ', 4: 'ù' },
};

export function addToneMark(pinyin: string, tone: Tone): string {
  for (const v of ['a', 'o', 'e'] as const) {
    const idx = pinyin.indexOf(v);
    if (idx >= 0) {
      return pinyin.slice(0, idx) + TONE_MARKS[v]![tone] + pinyin.slice(idx + 1);
    }
  }
  for (let i = pinyin.length - 1; i >= 0; i--) {
    const c = pinyin[i]!;
    if (c === 'i' || c === 'u') {
      return pinyin.slice(0, i) + TONE_MARKS[c]![tone] + pinyin.slice(i + 1);
    }
  }
  return pinyin;
}

export function targetContour(tone: Tone, durationMs: number): ContourPoint[] {
  return TONE_SHAPES[tone].map(({ t, pitch }) => ({
    tMs: t * durationMs,
    pitch,
  }));
}
