import type { Tone } from '../../../../core/domain/tones.js';

const LABELS: Record<Tone, { dia: string; glyph: string; name: string }> = {
  1: { dia: 'mā', glyph: '→', name: 'High level' },
  2: { dia: 'má', glyph: '↗', name: 'Rising' },
  3: { dia: 'mǎ', glyph: '↘↗', name: 'Dipping' },
  4: { dia: 'mà', glyph: '↘', name: 'Falling' },
};

export function ToneButtons({
  onSelect,
  disabled,
}: {
  onSelect: (tone: Tone) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {([1, 2, 3, 4] as const).map((t) => (
        <button
          key={t}
          disabled={disabled}
          onClick={() => onSelect(t)}
          className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-6 flex flex-col items-center gap-1 transition"
        >
          <span className="text-3xl font-semibold">{LABELS[t].dia}</span>
          <span className="text-xl text-sky-300">{LABELS[t].glyph}</span>
          <span className="text-xs uppercase text-slate-400 tracking-wide">{LABELS[t].name}</span>
        </button>
      ))}
    </div>
  );
}
