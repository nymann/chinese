import type { PairStat } from '../../../../core/domain/adaptive/mastery.js';
import type { Tone } from '../../../../core/domain/tones.js';

const TONE_GLYPH: Record<Tone, string> = {
  1: '→',
  2: '↗',
  3: '↘↗',
  4: '↘',
};

const SIZE = 72;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MIN_TRIALS_FOR_SIGNAL = 5;

function arcColor(stat: PairStat): string {
  if (stat.trials < MIN_TRIALS_FOR_SIGNAL) return '#94a3b8';
  if (stat.mastered) return '#10b981';
  if (stat.progress >= 0.7) return '#f59e0b';
  return '#f43f5e';
}

function arcLabel(stat: PairStat): string {
  if (stat.trials === 0) return '—';
  return `${Math.round(stat.progress * 100)}%`;
}

export function MasteryDial({ stat }: { stat: PairStat }) {
  const [a, b] = stat.pair;
  const dashOffset = CIRCUMFERENCE * (1 - stat.progress);
  const color = arcColor(stat);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          className="-rotate-90 text-slate-200 dark:text-slate-800"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="currentColor"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
            style={{ transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-mono text-slate-900 dark:text-slate-100">
          {arcLabel(stat)}
        </div>
      </div>
      <div className="text-xs text-slate-700 dark:text-slate-300 leading-tight text-center">
        <span className="font-semibold">T{a}</span>
        <span className="text-sky-700 dark:text-sky-300 mx-0.5">{TONE_GLYPH[a]}</span>
        <span className="text-slate-500 mx-1">↔</span>
        <span className="font-semibold">T{b}</span>
        <span className="text-sky-700 dark:text-sky-300 mx-0.5">{TONE_GLYPH[b]}</span>
      </div>
      <div className="text-[10px] text-slate-500">{stat.trials} trials</div>
    </div>
  );
}

export function MasteryDialRow({ stats }: { stats: readonly PairStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start justify-center gap-4 py-2">
      {stats.map((s) => (
        <MasteryDial key={`${s.pair[0]}-${s.pair[1]}`} stat={s} />
      ))}
    </div>
  );
}
