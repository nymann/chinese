import { estimateRange, type Calibration } from '../domain/calibration.js';
import type { Clock } from '../ports/driven/Clock.js';
import type { CalibrationRepository } from '../ports/driven/CalibrationRepository.js';
import type {
  AudioChunk,
  MicError,
  Microphone,
  Result,
} from '../ports/driven/Microphone.js';
import type { PitchDetector, PitchSample } from '../ports/driven/PitchDetector.js';
import type {
  CalibrationDraft,
  CalibrationService,
  CalibrationStep,
} from '../ports/driving/CalibrationService.js';

type Bucket = PitchSample[];

export function createCalibrationService(deps: {
  microphone: Microphone;
  pitchDetector: PitchDetector;
  repository: CalibrationRepository;
  clock: Clock;
}): CalibrationService {
  const { microphone, pitchDetector, repository, clock } = deps;
  const buckets: Record<CalibrationStep, Bucket> = {
    low: [],
    high: [],
    speech: [],
  };
  let activeStep: CalibrationStep | null = null;
  let lastSample: PitchSample | null = null;

  function onChunk(chunk: AudioChunk) {
    if (!activeStep) return;
    const sample = pitchDetector.detect(chunk.samples, chunk.sampleRate);
    const stamped: PitchSample = { ...sample, timestamp: chunk.timestamp };
    buckets[activeStep].push(stamped);
    lastSample = stamped;
  }

  return {
    async beginStep(step): Promise<Result<void, MicError>> {
      activeStep = step;
      buckets[step] = [];
      lastSample = null;
      const status = microphone.status();
      if (status === 'streaming') {
        return { ok: true, value: undefined };
      }
      return microphone.start(onChunk);
    },
    endStep() {
      activeStep = null;
    },
    livePitchHz() {
      return lastSample?.hz ?? null;
    },
    draft(): CalibrationDraft {
      return {
        low: medianHz(buckets.low),
        high: medianHz(buckets.high),
        speech: medianHz(buckets.speech),
      };
    },
    async finalise(): Promise<Calibration> {
      activeStep = null;
      microphone.stop();
      const all: PitchSample[] = [
        ...buckets.low,
        ...buckets.high,
        ...buckets.speech,
      ];
      const cal = estimateRange(all, clock.now());
      await repository.save(cal);
      return cal;
    },
    reset() {
      activeStep = null;
      buckets.low = [];
      buckets.high = [];
      buckets.speech = [];
      lastSample = null;
    },
    async load() {
      return repository.load();
    },
  };
}

function medianHz(samples: PitchSample[]): number {
  const hz: number[] = [];
  for (const s of samples) {
    if (s.hz === null || s.clarity < 0.85) continue;
    hz.push(s.hz);
  }
  if (hz.length === 0) return 0;
  hz.sort((a, b) => a - b);
  return hz[Math.floor(hz.length / 2)]!;
}
