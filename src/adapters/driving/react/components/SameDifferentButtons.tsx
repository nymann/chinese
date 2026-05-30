export type SameDifferentReveal = { picked: boolean; correct: boolean };

export function SameDifferentButtons({
  onSelect,
  disabled,
  reveal,
}: {
  onSelect: (same: boolean) => void;
  disabled?: boolean;
  reveal?: SameDifferentReveal | null;
}) {
  const classFor = (isSameButton: boolean): string => {
    const base =
      'relative rounded-xl px-4 py-5 sm:px-6 sm:py-8 text-2xl font-semibold transition border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center gap-2';
    if (!reveal) {
      return `${base} bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40`;
    }
    if (isSameButton === reveal.correct) {
      return `${base} bg-emerald-600 text-white ring-2 ring-emerald-300 dark:bg-emerald-700`;
    }
    if (isSameButton === reveal.picked) {
      return `${base} bg-rose-600 text-white ring-2 ring-rose-400 dark:bg-rose-800`;
    }
    return `${base} bg-white dark:bg-slate-800 opacity-30`;
  };
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        disabled={disabled}
        onClick={() => onSelect(true)}
        className={classFor(true)}
      >
        <span className="text-4xl leading-none">🙂‍↕️</span>
        <span>SAME</span>
        <HotkeyBadge label="S" />
      </button>
      <button
        disabled={disabled}
        onClick={() => onSelect(false)}
        className={classFor(false)}
      >
        <span className="text-4xl leading-none">🙂‍↔️</span>
        <span>DIFFERENT</span>
        <HotkeyBadge label="D" />
      </button>
    </div>
  );
}

function HotkeyBadge({ label }: { label: string }) {
  return (
    <span className="hidden sm:inline-block absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 text-[10px] font-mono text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700">
      {label}
    </span>
  );
}
