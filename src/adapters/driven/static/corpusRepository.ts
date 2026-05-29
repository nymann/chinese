import type { CorpusItem, SyllableKey, Tone } from '../../../core/domain/tones.js';
import type {
  CorpusRepository,
  SyllableEntry,
} from '../../../core/ports/driven/CorpusRepository.js';

type SyllableSpec = {
  syllable: SyllableKey;
  characters: Record<Tone, string>;
};

const SYLLABLES: SyllableSpec[] = [
  { syllable: 'ma', characters: { 1: '妈', 2: '麻', 3: '马', 4: '骂' } },
  { syllable: 'shi', characters: { 1: '诗', 2: '十', 3: '使', 4: '是' } },
  { syllable: 'yi', characters: { 1: '一', 2: '姨', 3: '以', 4: '意' } },
  { syllable: 'bai', characters: { 1: '掰', 2: '白', 3: '百', 4: '败' } },
];

const VOICES = ['v1', 'v2', 'v3'];
const TONES: Tone[] = [1, 2, 3, 4];

function buildCorpus(): CorpusItem[] {
  const out: CorpusItem[] = [];
  for (const spec of SYLLABLES) {
    for (const tone of TONES) {
      for (const voice of VOICES) {
        out.push({
          id: `${spec.syllable}-${tone}-${voice}`,
          syllable: spec.syllable,
          tone,
          voice,
          url: `synth:${spec.syllable}:${tone}:${voice}`,
        });
      }
    }
  }
  return out;
}

function buildSyllables(): SyllableEntry[] {
  const out: SyllableEntry[] = [];
  for (const spec of SYLLABLES) {
    for (const tone of TONES) {
      out.push({
        syllable: spec.syllable,
        tone,
        character: spec.characters[tone],
      });
    }
  }
  return out;
}

export function createStaticCorpusRepository(): CorpusRepository {
  const corpus = buildCorpus();
  const syllables = buildSyllables();
  return {
    async load() {
      return corpus;
    },
    async syllables() {
      return syllables;
    },
  };
}
