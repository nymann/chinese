import { useCalibration } from '../hooks/useCalibration.js';
import { PitchChart } from '../components/PitchChart.js';
import { RangeBar } from '../components/RangeBar.js';
import { useEffect, useRef } from 'react';
import type { PitchSample } from '../../../../core/ports/driven/PitchDetector.js';

const PROMPTS = {
  low: {
    title: 'Lowest comfortable note',
    body: 'Say "ahh" at the lowest pitch you can comfortably hold for ~3 seconds.',
  },
  high: {
    title: 'Highest comfortable note',
    body: 'Say "ahh" at the highest pitch you can comfortably hold for ~3 seconds.',
  },
  speech: {
    title: 'Normal speech',
    body: 'Read this aloud at your normal speaking pitch: "The quick brown fox jumps over the lazy dog."',
  },
};

export function Calibrate({ onDone }: { onDone: () => void }) {
  const cal = useCalibration();
  const liveBufferRef = useRef<PitchSample[]>([]);

  useEffect(() => {
    if (cal.livePitchHz !== null) {
      liveBufferRef.current = [
        ...liveBufferRef.current,
        { hz: cal.livePitchHz, clarity: 1, timestamp: performance.now() },
      ].slice(-100);
    }
  }, [cal.livePitchHz]);

  if (cal.step === 'done' && cal.result) {
    return (
      <div className="max-w-xl mx-auto space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Your range</h1>
        <RangeBar cal={cal.result} />
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Calibrated {new Date(cal.result.recordedAt).toLocaleString()}.
        </p>
        <div className="flex gap-3">
          <button
            onClick={cal.reset}
            className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Redo calibration
          </button>
          <button
            onClick={onDone}
            className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white ml-auto"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  const step = cal.step;
  if (step === 'done') return null;
  const prompt = PROMPTS[step];

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4 sm:p-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Step {['low', 'high', 'speech'].indexOf(step) + 1} of 3
        </div>
        <h1 className="text-2xl font-bold mt-1">{prompt.title}</h1>
        <p className="text-slate-700 dark:text-slate-300 mt-2">{prompt.body}</p>
      </div>

      <PitchChart liveBufferRef={liveBufferRef} />

      <div className="flex items-center gap-4">
        {!cal.isRecording ? (
          <button
            onClick={cal.startRecording}
            className="px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white"
          >
            ● Start
          </button>
        ) : (
          <button
            onClick={cal.stopRecording}
            className="px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold animate-pulse text-white"
          >
            ■ Stop
          </button>
        )}
        <div className="text-slate-600 dark:text-slate-400 text-sm">
          {cal.livePitchHz ? `${cal.livePitchHz.toFixed(0)} Hz` : 'Silence'}
        </div>
      </div>

      {cal.error && <div className="text-rose-600 dark:text-rose-400 text-sm">{cal.error}</div>}
    </div>
  );
}
