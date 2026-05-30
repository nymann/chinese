import type { FeedbackFlash as Flash } from '../../../../core/ports/driving/EarTrainingSession.js';

export function FeedbackFlash({ flash }: { flash: Flash }) {
  if (flash === null) return null;
  const color =
    flash === 'correct'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400';
  const glyph = flash === 'correct' ? '✓' : '✗';
  return (
    <div className={`text-7xl font-bold text-center ${color}`}>{glyph}</div>
  );
}
