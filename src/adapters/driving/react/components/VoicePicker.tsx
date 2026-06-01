import type { VoiceInfo } from '../../../../core/domain/tones.js';

type Option = { id: string | null; label: string; sub: string };

export function VoicePicker({
  voices,
  selectedVoiceId,
  onSelect,
}: {
  voices: VoiceInfo[];
  selectedVoiceId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const options: Option[] = [
    { id: null, label: 'Auto', sub: 'Adapts as you progress' },
    ...voices.map((v) => ({
      id: v.id,
      label: v.name,
      sub: `${v.gender === 'female' ? 'Female' : 'Male'} · ${v.accent}`,
    })),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((o) => {
        const active = o.id === selectedVoiceId;
        return (
          <button
            key={o.id ?? 'auto'}
            onClick={() => onSelect(o.id)}
            aria-pressed={active}
            className={[
              'rounded-xl px-3 py-3 text-left border shadow-sm transition',
              active
                ? 'bg-sky-700 text-white border-sky-700'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700',
            ].join(' ')}
          >
            <div className="font-medium">{o.label}</div>
            <div
              className={
                active ? 'text-xs text-sky-100' : 'text-xs text-slate-500 dark:text-slate-400'
              }
            >
              {o.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}
