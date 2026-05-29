import type { Tone } from '../../../../core/domain/tones.js';
import { useEarTraining } from '../hooks/useEarTraining.js';
import { FeedbackFlash } from '../components/FeedbackFlash.js';
import { SameDifferentButtons } from '../components/SameDifferentButtons.js';
import { ToneButtons } from '../components/ToneButtons.js';

const MODE_LABELS: Record<'discrimination' | 'identification', string> = {
  discrimination: 'Same or different?',
  identification: 'Which tone?',
};

export function EarTraining({
  mode,
  onPick,
  onPitchMirror,
}: {
  mode: 'discrimination' | 'identification' | null;
  onPick: (m: 'discrimination' | 'identification') => void;
  onPitchMirror: () => void;
}) {
  if (mode === null) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Ear training</h1>
        <p className="text-slate-300">Pick a drill. Items auto-play. Replay is one tap.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['discrimination', 'identification'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onPick(m)}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-6 text-left transition"
            >
              <div className="text-lg font-semibold">{MODE_LABELS[m]}</div>
              <div className="text-sm text-slate-400 mt-1">
                {m === 'discrimination'
                  ? 'Two syllables — same tone or not?'
                  : 'One syllable — pick the tone.'}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onPitchMirror}
          className="text-sky-300 hover:text-sky-200 underline text-sm"
        >
          Skip to pitch mirror →
        </button>
        <p className="text-xs text-slate-500 mt-6">
          Audio is synthesized for the MVP — pitched WebAudio oscillators following the canonical tone shapes.
        </p>
      </div>
    );
  }

  return <DrillScreen mode={mode} onBack={() => onPick(mode)} />;
}

function DrillScreen({
  mode,
  onBack,
}: {
  mode: 'discrimination' | 'identification';
  onBack: () => void;
}) {
  const ear = useEarTraining(mode);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{MODE_LABELS[mode]}</h1>
        <div className="text-sm text-slate-400">
          {ear.stats.trials} trials · {ear.stats.correct} correct
        </div>
      </div>

      <div className="min-h-32 flex items-center justify-center">
        {ear.feedback ? (
          <FeedbackFlash flash={ear.feedback} />
        ) : (
          <button
            onClick={ear.replay}
            className="text-5xl px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700"
            aria-label="Replay"
          >
            🔁
          </button>
        )}
      </div>

      {mode === 'discrimination' ? (
        <SameDifferentButtons
          disabled={ear.feedback !== null || ear.isLoading}
          onSelect={(same) => ear.answer({ kind: same ? 'same' : 'different' })}
        />
      ) : (
        <ToneButtons
          disabled={ear.feedback !== null || ear.isLoading}
          onSelect={(tone: Tone) => ear.answer({ kind: 'tone', tone })}
        />
      )}

      {ear.gateUnlocked && (
        <div className="rounded-lg bg-emerald-900/40 border border-emerald-700 p-3 text-sm">
          🎉 Pitch mirror unlocked.
        </div>
      )}

      <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-200">
        ← Back
      </button>
    </div>
  );
}
