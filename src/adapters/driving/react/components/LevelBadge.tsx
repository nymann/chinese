import type { EarLevel } from '../../../../core/domain/adaptive/mastery.js';
import type { Tone } from '../../../../core/domain/tones.js';

const LEVEL_DESCRIPTION: Record<EarLevel, string> = {
  1: 'Easiest pair, single voice',
  2: 'Three tones, single voice',
  3: 'All four tones (T2/T3 not yet paired), single voice',
  4: 'All pairs including T2/T3, single voice',
  5: 'All pairs, multiple voices',
};

const TONE_GLYPH: Record<Tone, string> = {
  1: '→',
  2: '↗',
  3: '↘↗',
  4: '↘',
};

export function LevelBadge({
  level,
  pairs,
  progress,
}: {
  level: EarLevel;
  pairs: ReadonlyArray<readonly [Tone, Tone]>;
  progress: { masteredPairs: number; totalPairs: number };
}) {
  const remaining = progress.totalPairs - progress.masteredPairs;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
      <div>
        <span className="text-xs uppercase tracking-wide text-sky-700 dark:text-sky-300">Level {level}/5</span>
        <span className="text-xs text-slate-500 ml-2">{LEVEL_DESCRIPTION[level]}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {pairs.map(([a, b]) => (
          <span
            key={`${a}-${b}`}
            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            T{a} {TONE_GLYPH[a]} <span className="text-slate-500 mx-1">vs</span> T{b} {TONE_GLYPH[b]}
          </span>
        ))}
      </div>
      {level < 5 && remaining > 0 && (
        <div className="text-[11px] text-slate-500 pt-1">
          Master {remaining === progress.totalPairs ? 'every' : remaining === 1 ? '1 more' : `${remaining} more`} pair{remaining === 1 ? '' : 's'} (reach 100%) to unlock level {level + 1}.
        </div>
      )}
    </div>
  );
}
