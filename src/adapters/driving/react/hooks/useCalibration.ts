import { useCallback, useEffect, useRef, useState } from 'react';

import type { Calibration } from '../../../../core/domain/calibration.js';
import type { CalibrationStep } from '../../../../core/ports/driving/CalibrationService.js';
import { useContainer } from '../../../../composition/ReactContainer.js';

type State = {
  step: CalibrationStep | 'done';
  isRecording: boolean;
  livePitchHz: number | null;
  result: Calibration | null;
  error: string | null;
};

const ORDER: CalibrationStep[] = ['low', 'high', 'speech'];

export function useCalibration() {
  const { calibration } = useContainer();
  const [state, setState] = useState<State>({
    step: 'low',
    isRecording: false,
    livePitchHz: null,
    result: null,
    error: null,
  });
  const livePollRef = useRef<number | null>(null);

  useEffect(() => {
    void calibration.load().then((cal) => {
      if (cal) setState((s) => ({ ...s, result: cal, step: 'done' }));
    });
  }, [calibration]);

  const tickLive = useCallback(() => {
    const hz = calibration.livePitchHz();
    setState((s) => (s.livePitchHz === hz ? s : { ...s, livePitchHz: hz }));
    livePollRef.current = window.setTimeout(tickLive, 100);
  }, [calibration]);

  const startRecording = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    const current = state.step === 'done' ? 'low' : state.step;
    const res = await calibration.beginStep(current);
    if (!res.ok) {
      setState((s) => ({ ...s, error: res.error.message }));
      return;
    }
    setState((s) => ({ ...s, isRecording: true, step: current }));
    tickLive();
  }, [calibration, state.step, tickLive]);

  const stopRecording = useCallback(async () => {
    calibration.endStep();
    if (livePollRef.current) {
      clearTimeout(livePollRef.current);
      livePollRef.current = null;
    }
    setState((s) => ({ ...s, isRecording: false }));
    const currentIdx = ORDER.indexOf((state.step === 'done' ? 'speech' : state.step) as CalibrationStep);
    const nextIdx = currentIdx + 1;
    if (nextIdx >= ORDER.length) {
      const cal = await calibration.finalise();
      setState((s) => ({ ...s, step: 'done', result: cal }));
    } else {
      setState((s) => ({ ...s, step: ORDER[nextIdx]! }));
    }
  }, [calibration, state.step]);

  const redoStep = useCallback((step: CalibrationStep) => {
    setState((s) => ({ ...s, step, result: null }));
  }, []);

  const reset = useCallback(() => {
    calibration.reset();
    setState({ step: 'low', isRecording: false, livePitchHz: null, result: null, error: null });
  }, [calibration]);

  useEffect(() => () => {
    if (livePollRef.current) clearTimeout(livePollRef.current);
  }, []);

  return {
    step: state.step,
    isRecording: state.isRecording,
    livePitchHz: state.livePitchHz,
    result: state.result,
    error: state.error,
    startRecording,
    stopRecording,
    redoStep,
    reset,
  };
}
