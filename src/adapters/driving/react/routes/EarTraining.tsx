import { useEffect, useRef } from 'react';

import type { Tone } from '../../../../core/domain/tones.js';
import { useEarTraining } from '../hooks/useEarTraining.js';
import { FeedbackFlash } from '../components/FeedbackFlash.js';
import { LevelBadge } from '../components/LevelBadge.js';
import { MasteryDialRow } from '../components/MasteryDial.js';
import { PairReveal } from '../components/PairReveal.js';
import { SameDifferentButtons } from '../components/SameDifferentButtons.js';
import { ToneButtons } from '../components/ToneButtons.js';

const MODE_LABELS: Record<'discrimination' | 'identification', string> = {
  discrimination: 'Same or different?',
  identification: 'Which tone?',
};

export function EarTraining({
  mode,
}: {
  mode: 'discrimination' | 'identification';
}) {
  const ear = useEarTraining(mode);

  const earRef = useRef(ear);
  earRef.current = ear;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const e_ear = earRef.current;
      const locked = e_ear.feedback !== null || e_ear.isLoading;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e_ear.replay();
        return;
      }
      if (locked) return;

      if (mode === 'discrimination') {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          void e_ear.answer({ kind: 'same' });
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          void e_ear.answer({ kind: 'different' });
        }
      } else if (e_ear.current?.mode === 'identification') {
        if (e.key >= '1' && e.key <= '4') {
          const tone = Number(e.key) as Tone;
          if (e_ear.levelInfo.tones.includes(tone)) {
            e.preventDefault();
            void e_ear.answer({ kind: 'tone', tone });
          }
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold">{MODE_LABELS[mode]}</h1>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {ear.stats.trials} trials · {ear.stats.correct} correct
        </div>
      </div>

      <LevelBadge
        level={ear.levelInfo.level}
        pairs={ear.levelInfo.pairs}
        progress={ear.levelInfo.progress}
      />

      <MasteryDialRow stats={ear.levelInfo.pairStats} />

      <div className="min-h-32 flex items-center justify-center">
        {ear.feedback ? (
          <FeedbackFlash flash={ear.feedback} />
        ) : (
          <button
            onClick={ear.replay}
            className="relative text-5xl px-6 py-3 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm"
            aria-label="Replay"
          >
            🔁
            <span className="hidden sm:inline-block absolute top-1 right-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 text-[10px] font-mono text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700">
              R
            </span>
          </button>
        )}
      </div>

      {mode === 'discrimination' ? (
        <div className="space-y-4">
          {ear.reveal?.kind === 'discrimination' && (
            <PairReveal
              syllable={ear.reveal.syllable}
              toneA={ear.reveal.toneA}
              toneB={ear.reveal.toneB}
            />
          )}
          <SameDifferentButtons
            disabled={ear.feedback !== null || ear.isLoading}
            reveal={
              ear.reveal?.kind === 'discrimination'
                ? { picked: ear.reveal.pickedSame, correct: ear.reveal.wasSame }
                : null
            }
            onSelect={(same) => ear.answer({ kind: same ? 'same' : 'different' })}
          />
        </div>
      ) : ear.current?.mode === 'identification' ? (
        <ToneButtons
          syllable={ear.current.item.syllable}
          tones={ear.levelInfo.tones}
          disabled={ear.feedback !== null}
          reveal={
            ear.reveal?.kind === 'identification'
              ? { picked: ear.reveal.picked, correct: ear.reveal.correct }
              : null
          }
          onSelect={(tone: Tone) => ear.answer({ kind: 'tone', tone })}
        />
      ) : (
        <div className="text-center text-slate-500 text-sm">Loading…</div>
      )}
    </div>
  );
}
