export type PitchSample = {
  hz: number | null;
  clarity: number;
  timestamp: number;
};

export interface PitchDetector {
  detect(chunk: Float32Array, sampleRate: number): PitchSample;
}
