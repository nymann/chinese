import type { PitchSample } from '../driven/PitchDetector.js';
import type { Calibration } from '../../domain/calibration.js';
import type { Verdict } from '../../domain/scoring.js';
import type { ContourPoint, SyllableKey, Tone } from '../../domain/tones.js';
import type { MicError, Result } from '../driven/Microphone.js';

export type PitchMirrorItem = {
  syllable: SyllableKey;
  tone: Tone;
  character: string;
};

export type Unsubscribe = () => void;

export type SessionSummary = {
  attempts: number;
  passes: number;
  rotations: number;
};

export interface PitchMirrorSession {
  init(): Promise<Result<Calibration, MicError | { kind: 'noCalibration' }>>;
  current(): PitchMirrorItem;
  target(): ContourPoint[];
  start(): Promise<Result<void, MicError>>;
  stop(): Verdict;
  onLiveSample(cb: (s: PitchSample) => void): Unsubscribe;
  advance(): void;
  stats(): SessionSummary;
  end(): Promise<SessionSummary>;
}
