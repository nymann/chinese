import { PitchDetector as PitchyDetector } from 'pitchy';

import type {
  PitchDetector,
  PitchSample,
} from '../../../core/ports/driven/PitchDetector.js';

export function createPitchyDetector(bufferSize = 2048): PitchDetector {
  const detector = PitchyDetector.forFloat32Array(bufferSize);
  detector.minVolumeDecibels = -50;
  return {
    detect(chunk, sampleRate): PitchSample {
      if (chunk.length < bufferSize) {
        return { hz: null, clarity: 0, timestamp: 0 };
      }
      const view =
        chunk.length === bufferSize ? chunk : chunk.subarray(0, bufferSize);
      const [pitch, clarity] = detector.findPitch(view, sampleRate);
      const valid = clarity > 0.5 && pitch >= 60 && pitch <= 800;
      return {
        hz: valid ? pitch : null,
        clarity,
        timestamp: 0,
      };
    },
  };
}
