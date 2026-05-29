export function SameDifferentButtons({
  onSelect,
  disabled,
}: {
  onSelect: (same: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        disabled={disabled}
        onClick={() => onSelect(true)}
        className="rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 px-6 py-8 text-2xl font-semibold transition"
      >
        SAME
      </button>
      <button
        disabled={disabled}
        onClick={() => onSelect(false)}
        className="rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-40 px-6 py-8 text-2xl font-semibold transition"
      >
        DIFFERENT
      </button>
    </div>
  );
}
