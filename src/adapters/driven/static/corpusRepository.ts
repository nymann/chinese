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
  { syllable: 'ma',   characters: { 1: '妈', 2: '麻', 3: '马', 4: '骂' } },
  { syllable: 'shi',  characters: { 1: '诗', 2: '十', 3: '使', 4: '是' } },
  { syllable: 'yi',   characters: { 1: '一', 2: '姨', 3: '以', 4: '意' } },
  { syllable: 'bai',  characters: { 1: '掰', 2: '白', 3: '百', 4: '败' } },
  { syllable: 'ba',   characters: { 1: '八', 2: '拔', 3: '把', 4: '爸' } },
  { syllable: 'da',   characters: { 1: '搭', 2: '达', 3: '打', 4: '大' } },
  { syllable: 'di',   characters: { 1: '低', 2: '敌', 3: '底', 4: '地' } },
  { syllable: 'fan',  characters: { 1: '番', 2: '烦', 3: '反', 4: '饭' } },
  { syllable: 'guo',  characters: { 1: '锅', 2: '国', 3: '果', 4: '过' } },
  { syllable: 'jiao', characters: { 1: '交', 2: '角', 3: '脚', 4: '叫' } },
  { syllable: 'liu',  characters: { 1: '溜', 2: '流', 3: '柳', 4: '六' } },
  { syllable: 'tang', characters: { 1: '汤', 2: '糖', 3: '躺', 4: '烫' } },
];

const VOICES = ['v1', 'v2', 'v3'];
const TONES: Tone[] = [1, 2, 3, 4];

type ManifestItem = {
  id: string;
  syllable: SyllableKey;
  tone: Tone;
  voice: string;
  character: string;
  url: string;
};

type Manifest = { items: ManifestItem[] };

function synthCorpus(): CorpusItem[] {
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

function syllableEntries(): SyllableEntry[] {
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

async function loadManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch('/audio/manifest.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Manifest;
    if (!Array.isArray(data.items) || data.items.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function createStaticCorpusRepository(): CorpusRepository {
  let cached: Promise<CorpusItem[]> | null = null;

  async function getCorpus(): Promise<CorpusItem[]> {
    const manifest = await loadManifest();
    if (manifest) {
      return manifest.items.map((m) => ({
        id: m.id,
        syllable: m.syllable,
        tone: m.tone,
        voice: m.voice,
        url: m.url,
      }));
    }
    return synthCorpus();
  }

  return {
    async load() {
      if (!cached) cached = getCorpus();
      return cached;
    },
    async syllables() {
      return syllableEntries();
    },
  };
}
