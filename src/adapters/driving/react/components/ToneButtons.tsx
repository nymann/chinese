import { addToneMark, type Tone } from '../../../../core/domain/tones.js';

const TONE_META: Record<Tone, { glyph: string; name: string }> = {
  1: { glyph: '→', name: 'High level' },
  2: { glyph: '↗', name: 'Rising' },
  3: { glyph: '↘↗', name: 'Dipping' },
  4: { glyph: '↘', name: 'Falling' },
};

export type ToneReveal = { picked: Tone; correct: Tone };

const ALL_TONES: readonly Tone[] = [1, 2, 3, 4];

export function ToneButtons({
  syllable,
  tones = ALL_TONES,
  onSelect,
  disabled,
  reveal,
}: {
  syllable: string;
  tones?: readonly Tone[];
  onSelect: (tone: Tone) => void;
  disabled?: boolean;
  reveal?: ToneReveal | null;
}) {
  const classFor = (t: Tone): string => {
    const base =
      'relative rounded-xl px-3 py-4 sm:px-4 sm:py-6 flex flex-col items-center gap-1 transition border border-slate-200 dark:border-slate-700 shadow-sm';
    if (!reveal) {
      return `${base} bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40`;
    }
    if (t === reveal.correct) {
      return `${base} bg-emerald-600 text-white ring-2 ring-emerald-300 dark:bg-emerald-700`;
    }
    if (t === reveal.picked) {
      return `${base} bg-rose-600 text-white ring-2 ring-rose-400 dark:bg-rose-800`;
    }
    return `${base} bg-white dark:bg-slate-800 opacity-30`;
  };

  const grid =
    tones.length <= 2
      ? 'grid grid-cols-2 gap-3'
      : tones.length === 3
        ? 'grid grid-cols-3 gap-3'
        : 'grid grid-cols-2 sm:grid-cols-4 gap-3';

  return (
    <div className={grid}>
      {tones.map((t) => (
        <button
          key={t}
          disabled={disabled}
          onClick={() => onSelect(t)}
          className={classFor(t)}
        >
          <span className="text-3xl font-semibold">{addToneMark(syllable, t)}</span>
          <span className="text-xl text-sky-700 dark:text-sky-300">{TONE_META[t].glyph}</span>
          <span className="text-xs uppercase text-slate-600 dark:text-slate-400 tracking-wide">
            {TONE_META[t].name}
          </span>
          <span className="hidden sm:inline-block absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 text-[10px] font-mono text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700">
            {t}
          </span>
        </button>
      ))}
    </div>
  );
}
