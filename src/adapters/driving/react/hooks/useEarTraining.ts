import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CurrentEarItem,
  EarChoice,
  EarTrainingMode,
  FeedbackFlash,
  SessionStats,
} from '../../../../core/ports/driving/EarTrainingSession.js';
import { useContainer } from '../../../../composition/ReactContainer.js';

type State = {
  current: CurrentEarItem | null;
  feedback: FeedbackFlash;
  stats: SessionStats;
  gateUnlocked: boolean;
  isLoading: boolean;
};

export function useEarTraining(mode: EarTrainingMode) {
  const { earTraining } = useContainer();
  const [state, setState] = useState<State>({
    current: null,
    feedback: null,
    stats: { trials: 0, correct: 0 },
    gateUnlocked: false,
    isLoading: true,
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      await earTraining.start(mode);
      setState((s) => ({
        ...s,
        current: earTraining.current(),
        gateUnlocked: earTraining.gateToStep2Unlocked(),
        isLoading: false,
      }));
    })();
  }, [earTraining, mode]);

  const answer = useCallback(
    async (choice: EarChoice) => {
      const flash = await earTraining.answer(choice);
      setState((s) => ({
        ...s,
        feedback: flash,
        stats: earTraining.stats(),
        gateUnlocked: earTraining.gateToStep2Unlocked(),
      }));
      window.setTimeout(async () => {
        await earTraining.advance();
        setState((s) => ({
          ...s,
          current: earTraining.current(),
          feedback: null,
        }));
      }, 600);
    },
    [earTraining],
  );

  const replay = useCallback(() => {
    void earTraining.replay();
  }, [earTraining]);

  return {
    ...state,
    answer,
    replay,
  };
}
