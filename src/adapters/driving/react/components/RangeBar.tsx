import type { Calibration } from '../../../../core/domain/calibration.js';

export function RangeBar({ cal }: { cal: Calibration }) {
  const low = Math.round(cal.lowHz);
  const mid = Math.round(cal.midHz);
  const high = Math.round(cal.highHz);
  const midPct =
    ((cal.midHz > 0 ? Math.log2(cal.midHz) : 0) - cal.logLow) /
    (cal.logHigh - cal.logLow);
  return (
    <div className="w-full">
      <div className="relative h-3 rounded-full bg-gradient-to-r from-indigo-700 via-sky-500 to-rose-400">
        <div
          className="absolute -top-1 h-5 w-1 bg-white rounded"
          style={{ left: `${Math.max(0, Math.min(1, midPct)) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-300">
        <span>{low} Hz low</span>
        <span>{mid} Hz mid</span>
        <span>{high} Hz high</span>
      </div>
    </div>
  );
}
