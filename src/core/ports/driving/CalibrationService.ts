import type { Calibration } from '../../domain/calibration.js';
import type { MicError, Result } from '../driven/Microphone.js';

export type CalibrationStep = 'low' | 'high' | 'speech';

export type CalibrationDraft = {
  low: number;
  high: number;
  speech: number;
};

export interface CalibrationService {
  beginStep(step: CalibrationStep): Promise<Result<void, MicError>>;
  endStep(): void;
  livePitchHz(): number | null;
  draft(): CalibrationDraft;
  finalise(): Promise<Calibration>;
  reset(): void;
  load(): Promise<Calibration | null>;
}
