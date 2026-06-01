import { useEffect, useRef, useState } from 'react';

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
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold flex items-center gap-1.5">
          {MODE_LABELS[mode]}
          <LevelInfoButton
            level={ear.levelInfo.level}
            pairs={ear.levelInfo.pairs}
            progress={ear.levelInfo.progress}
          />
        </h1>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {ear.stats.trials} trials · {ear.stats.correct} correct
        </div>
      </div>

      <MasteryDialRow stats={ear.levelInfo.pairStats} />

      <div className="flex justify-center">
        <div className="relative">
          {!ear.audioUnlocked && !ear.isLoading && (
            <span className="absolute inset-0 rounded-lg ring-2 ring-sky-400 animate-ping pointer-events-none" />
          )}
          <button
            onClick={ear.replay}
            className="relative text-5xl leading-none px-6 py-3 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm"
            aria-label="Play sound"
          >
            🔊
            <span className="hidden sm:inline-block absolute top-1 right-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 text-[10px] font-mono text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700">
              R
            </span>
          </button>
        </div>
      </div>

      <div
        className="min-h-28 sm:min-h-32 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ease-out"
        style={{ opacity: ear.revealActive ? 1 : 0 }}
        aria-hidden={!ear.revealActive}
      >
        {ear.feedback && <FeedbackFlash flash={ear.feedback} />}
        {ear.slotReveal?.kind === 'discrimination' && (
          <PairReveal
            syllable={ear.slotReveal.syllable}
            toneA={ear.slotReveal.toneA}
            toneB={ear.slotReveal.toneB}
          />
        )}
      </div>

      {mode === 'discrimination' ? (
        <SameDifferentButtons
          disabled={ear.feedback !== null || ear.isLoading}
          reveal={
            ear.reveal?.kind === 'discrimination'
              ? { picked: ear.reveal.pickedSame, correct: ear.reveal.wasSame }
              : null
          }
          onSelect={(same) => ear.answer({ kind: same ? 'same' : 'different' })}
        />
      ) : ear.current?.mode === 'identification' ? (
        <div className="space-y-3">
          <WordContext
            syllables={ear.current.item.syllables}
            targetIndex={ear.current.item.targetIndex}
          />
          <ToneButtons
            syllable={
              ear.current.item.syllables[ear.current.item.targetIndex] ?? ear.current.item.pinyin
            }
            tones={ear.levelInfo.tones}
            disabled={ear.feedback !== null}
            reveal={
              ear.reveal?.kind === 'identification'
                ? { picked: ear.reveal.picked, correct: ear.reveal.correct }
                : null
            }
            onSelect={(tone: Tone) => ear.answer({ kind: 'tone', tone })}
          />
        </div>
      ) : (
        <div className="text-center text-slate-500 text-sm">Loading…</div>
      )}
    </div>
  );
}

function WordContext({
  syllables,
  targetIndex,
}: {
  syllables: string[];
  targetIndex: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-lg" aria-label="word">
      {syllables.map((s, i) => (
        <span
          key={i}
          className={
            i === targetIndex
              ? 'font-semibold text-slate-900 dark:text-slate-100 underline decoration-sky-500 decoration-2 underline-offset-4'
              : 'text-slate-400 dark:text-slate-500'
          }
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function LevelInfoButton({
  level,
  pairs,
  progress,
}: {
  level: 1 | 2 | 3 | 4 | 5;
  pairs: ReadonlyArray<readonly [Tone, Tone]>;
  progress: { masteredPairs: number; totalPairs: number };
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-label={`Level ${level} of 5 — details`}
        className="text-base text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 leading-none align-middle"
      >
        ⓘ
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute left-0 top-full mt-2 z-10 w-72 sm:w-80 max-w-[calc(100vw-2rem)]"
        >
          <LevelBadge level={level} pairs={pairs} progress={progress} />
        </div>
      )}
    </span>
  );
}
