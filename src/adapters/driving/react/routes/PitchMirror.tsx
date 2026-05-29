import { usePitchMirror } from '../hooks/usePitchMirror.js';
import { PitchChart } from '../components/PitchChart.js';

export function PitchMirror({ onCalibrate }: { onCalibrate: () => void }) {
  const mirror = usePitchMirror();

  if (mirror.status === 'init') {
    return <div className="p-6 text-slate-400">Loading…</div>;
  }
  if (mirror.status === 'noCalibration') {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Calibration required</h1>
        <p className="text-slate-300">
          The pitch mirror scores you relative to your own range. Calibrate first.
        </p>
        <button
          onClick={onCalibrate}
          className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500"
        >
          Calibrate →
        </button>
      </div>
    );
  }

  const recording = mirror.status === 'recording';
  const item = mirror.current;
  const verdictGlyph =
    mirror.status === 'pass' ? '✓' : mirror.status === 'retry' ? '↺' : '';

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-4xl font-bold">{item?.syllable}</div>
          <div className="text-2xl text-slate-300 mt-1">{item?.character}</div>
        </div>
        <div className="text-sm text-slate-400">
          tone {item?.tone} · {mirror.stats.attempts} attempts · {mirror.stats.passes} pass · {mirror.stats.rotations} rotated
        </div>
      </div>

      <div className="relative">
        <PitchChart
          liveBufferRef={mirror.liveBufferRef}
          target={mirror.target}
          calibration={mirror.calibration}
        />
        {verdictGlyph && (
          <div className="absolute inset-0 flex items-center justify-center text-8xl font-bold pointer-events-none">
            <span
              className={
                mirror.status === 'pass' ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {verdictGlyph}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        {!recording ? (
          <button
            onClick={mirror.start}
            disabled={mirror.status === 'pass' || mirror.status === 'retry'}
            className="px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold"
          >
            🎙 Speak
          </button>
        ) : (
          <button
            onClick={mirror.stop}
            className="px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold animate-pulse"
          >
            ■ Stop
          </button>
        )}
        {mirror.verdict && (
          <div className="text-sm text-slate-400">
            shape Δ {mirror.verdict.shapeDistance.toFixed(2)} · voiced{' '}
            {(mirror.verdict.voicedRatio * 100).toFixed(0)}% ·{' '}
            {mirror.verdict.durationMs.toFixed(0)} ms
          </div>
        )}
      </div>
    </div>
  );
}
