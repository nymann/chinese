import { addToneMark, type Tone } from '../../../../core/domain/tones.js';

const GLYPHS: Record<Tone, string> = {
  1: '→',
  2: '↗',
  3: '↘↗',
  4: '↘',
};

export function PairReveal({
  syllable,
  toneA,
  toneB,
}: {
  syllable: string;
  toneA: Tone;
  toneB: Tone;
}) {
  return (
    <div className="flex items-center justify-center gap-6 text-slate-800 dark:text-slate-200">
      <Chip syllable={syllable} tone={toneA} />
      <span className="text-slate-500 text-sm">vs</span>
      <Chip syllable={syllable} tone={toneB} />
    </div>
  );
}

function Chip({ syllable, tone }: { syllable: string; tone: Tone }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-semibold">{addToneMark(syllable, tone)}</span>
      <span className="text-base text-sky-700 dark:text-sky-300">{GLYPHS[tone]}</span>
    </div>
  );
}
