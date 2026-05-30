import { useCallback, useEffect, useRef, useState } from 'react';

import type { EarLevel, PairStat } from '../../../../core/domain/adaptive/mastery.js';
import type { Tone } from '../../../../core/domain/tones.js';
import type {
  CurrentEarItem,
  EarChoice,
  EarTrainingMode,
  FeedbackFlash,
  SessionStats,
} from '../../../../core/ports/driving/EarTrainingSession.js';
import { useContainer } from '../../../../composition/ReactContainer.js';

export type EarReveal =
  | {
      kind: 'identification';
      syllable: string;
      picked: Tone;
      correct: Tone;
    }
  | {
      kind: 'discrimination';
      syllable: string;
      toneA: Tone;
      toneB: Tone;
      pickedSame: boolean;
      wasSame: boolean;
    };

type LevelInfo = {
  level: EarLevel;
  pairs: ReadonlyArray<readonly [Tone, Tone]>;
  tones: readonly Tone[];
  pairStats: readonly PairStat[];
  progress: { masteredPairs: number; totalPairs: number };
};

type State = {
  current: CurrentEarItem | null;
  feedback: FeedbackFlash;
  reveal: EarReveal | null;
  slotReveal: EarReveal | null;
  revealActive: boolean;
  stats: SessionStats;
  gateUnlocked: boolean;
  isLoading: boolean;
  audioUnlocked: boolean;
  levelInfo: LevelInfo;
};

const FADE_MS = 300;
const PRE_ADVANCE_PAUSE_MS = 400;
const FADE_START_MS: Record<EarTrainingMode, number> = {
  identification: 1000,
  discrimination: 1800,
};

export function useEarTraining(mode: EarTrainingMode) {
  const { earTraining } = useContainer();
  const [state, setState] = useState<State>({
    current: null,
    feedback: null,
    reveal: null,
    slotReveal: null,
    revealActive: false,
    stats: { trials: 0, correct: 0 },
    gateUnlocked: false,
    isLoading: true,
    audioUnlocked: false,
    levelInfo: {
      level: 1,
      pairs: [],
      tones: [],
      pairStats: [],
      progress: { masteredPairs: 0, totalPairs: 1 },
    },
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const played = await earTraining.start(mode);
      setState((s) => ({
        ...s,
        current: earTraining.current(),
        gateUnlocked: earTraining.gateToStep2Unlocked(),
        levelInfo: {
          level: earTraining.level(),
          pairs: earTraining.levelPairs(),
          tones: earTraining.levelTones(),
          pairStats: earTraining.levelPairStats(),
          progress: earTraining.levelProgress(),
        },
        isLoading: false,
        audioUnlocked: played,
      }));
    })();
  }, [earTraining, mode]);

  const answer = useCallback(
    async (choice: EarChoice) => {
      const before = earTraining.current();
      const flash = await earTraining.answer(choice);
      let reveal: EarReveal | null = null;
      if (before?.mode === 'identification' && choice.kind === 'tone') {
        reveal = {
          kind: 'identification',
          syllable: before.item.syllable,
          picked: choice.tone,
          correct: before.item.tone,
        };
      } else if (before?.mode === 'discrimination' && choice.kind !== 'tone') {
        reveal = {
          kind: 'discrimination',
          syllable: before.a.syllable,
          toneA: before.a.tone,
          toneB: before.b.tone,
          pickedSame: choice.kind === 'same',
          wasSame: before.isSame,
        };
      }
      setState((s) => ({
        ...s,
        feedback: flash,
        reveal,
        slotReveal: reveal,
        revealActive: true,
        stats: earTraining.stats(),
        gateUnlocked: earTraining.gateToStep2Unlocked(),
        levelInfo: {
          level: earTraining.level(),
          pairs: earTraining.levelPairs(),
          tones: earTraining.levelTones(),
          pairStats: earTraining.levelPairStats(),
          progress: earTraining.levelProgress(),
        },
      }));
      const fadeStartAt = FADE_START_MS[mode];
      // Advance to the next item soon after the answer; the reveal slot
      // keeps showing the previous feedback while the next audio plays.
      window.setTimeout(() => {
        void earTraining.advance().then((played) => {
          if (played) setState((s) => (s.audioUnlocked ? s : { ...s, audioUnlocked: true }));
        });
        setState((s) => ({
          ...s,
          current: earTraining.current(),
          reveal: null,
        }));
      }, PRE_ADVANCE_PAUSE_MS);
      // Begin fading the reveal slot around 80% through the next audio.
      window.setTimeout(() => {
        setState((s) => ({ ...s, revealActive: false }));
      }, fadeStartAt);
      // Clear the slot content once the fade completes so buttons re-enable.
      window.setTimeout(() => {
        setState((s) => ({ ...s, feedback: null, slotReveal: null }));
      }, fadeStartAt + FADE_MS);
    },
    [earTraining],
  );

  const replay = useCallback(() => {
    void earTraining.replay().then((played) => {
      if (played) setState((s) => (s.audioUnlocked ? s : { ...s, audioUnlocked: true }));
    });
  }, [earTraining]);

  return {
    ...state,
    answer,
    replay,
  };
}
