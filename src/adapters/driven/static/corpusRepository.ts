import type {
  CorpusItem,
  SyllableClip,
  SyllableKey,
  Tone,
  VoiceInfo,
} from '../../../core/domain/tones.js';
import type {
  CorpusRepository,
  SyllableEntry,
} from '../../../core/ports/driven/CorpusRepository.js';

// Qwen3-TTS built-in Chinese speakers used to generate the word corpus.
// Mirrors scripts/voices.json.
const VOICES_META: VoiceInfo[] = [
  { id: 'vivian', name: 'Vivian', gender: 'female', accent: 'Standard' },
  { id: 'serena', name: 'Serena', gender: 'female', accent: 'Standard' },
  { id: 'uncle_fu', name: 'Uncle Fu', gender: 'male', accent: 'Standard' },
  { id: 'dylan', name: 'Dylan', gender: 'male', accent: 'Beijing' },
  { id: 'eric', name: 'Eric', gender: 'male', accent: 'Sichuan' },
];

type SyllableSpec = {
  syllable: SyllableKey;
  characters: Record<Tone, string>;
};

// Single-syllable inventory — used only by Step 2 (pitch mirror), which
// imitates one syllable's contour. Ear training plays the word corpus below.
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

const TONES: Tone[] = [1, 2, 3, 4];

type ManifestItem = {
  id: string;
  word: string;
  pinyin: string;
  syllables: string[];
  tones: number[];
  gloss: string;
  voice: string;
  url: string;
};

type Manifest = { items: ManifestItem[] };

type SyllableManifestItem = {
  id: string;
  syllable: SyllableKey;
  tone: number;
  character: string;
  voice: string;
  url: string;
};

type SyllableManifest = { items: SyllableManifestItem[] };

function isTone(t: number): t is Tone {
  return t >= 1 && t <= 4;
}

// Each word yields one drill item per non-neutral syllable: the learner
// identifies the tone of that target syllable, highlighted in the word.
function wordToItems(m: ManifestItem): CorpusItem[] {
  const out: CorpusItem[] = [];
  m.tones.forEach((t, i) => {
    if (!isTone(t)) return;
    out.push({
      id: `${m.id}-${i}`,
      word: m.word,
      pinyin: m.pinyin,
      syllables: m.syllables,
      tones: m.tones,
      gloss: m.gloss,
      targetIndex: i,
      tone: t,
      voice: m.voice,
      url: m.url,
    });
  });
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

async function loadSyllableManifest(): Promise<SyllableManifest | null> {
  try {
    const res = await fetch('/audio/syllables-manifest.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as SyllableManifest;
    if (!Array.isArray(data.items) || data.items.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function createStaticCorpusRepository(): CorpusRepository {
  let cached: Promise<CorpusItem[]> | null = null;
  let cachedSyllableClips: Promise<SyllableClip[]> | null = null;

  async function getCorpus(): Promise<CorpusItem[]> {
    const manifest = await loadManifest();
    if (!manifest) return [];
    return manifest.items.flatMap(wordToItems);
  }

  async function getSyllableClips(): Promise<SyllableClip[]> {
    const manifest = await loadSyllableManifest();
    if (!manifest) return [];
    return manifest.items.flatMap((m) =>
      isTone(m.tone)
        ? [
            {
              id: m.id,
              syllable: m.syllable,
              tone: m.tone,
              character: m.character,
              voice: m.voice,
              url: m.url,
            },
          ]
        : [],
    );
  }

  return {
    async load() {
      if (!cached) cached = getCorpus();
      return cached;
    },
    async syllableClips() {
      if (!cachedSyllableClips) cachedSyllableClips = getSyllableClips();
      return cachedSyllableClips;
    },
    async syllables() {
      return syllableEntries();
    },
    voices() {
      return VOICES_META;
    },
  };
}
