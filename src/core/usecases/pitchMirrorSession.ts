import { emptyMastery, type Mastery } from '../domain/adaptive/mastery.js';
import {
  nextSyllable,
  recordResult,
  shouldRotate,
  type RotationState,
  type SyllableTarget,
} from '../domain/adaptive/rotation.js';
import type { Calibration } from '../domain/calibration.js';
import { scoreAttempt, type Verdict } from '../domain/scoring.js';
import { targetContour, type ContourPoint, type Tone } from '../domain/tones.js';
import type { CalibrationRepository } from '../ports/driven/CalibrationRepository.js';
import type { Clock } from '../ports/driven/Clock.js';
import type {
  CorpusRepository,
  SyllableEntry,
} from '../ports/driven/CorpusRepository.js';
import type { MasteryRepository } from '../ports/driven/MasteryRepository.js';
import type {
  AudioChunk,
  MicError,
  Microphone,
  Result,
} from '../ports/driven/Microphone.js';
import type { PitchDetector, PitchSample } from '../ports/driven/PitchDetector.js';
import type { Random } from '../ports/driven/Random.js';
import type {
  PitchMirrorItem,
  PitchMirrorSession,
  SessionSummary,
  Unsubscribe,
} from '../ports/driving/PitchMirrorSession.js';

const TARGET_DURATION_MS = 700;

export function createPitchMirrorSession(deps: {
  microphone: Microphone;
  pitchDetector: PitchDetector;
  calibration: CalibrationRepository;
  mastery: MasteryRepository;
  corpus: CorpusRepository;
  clock: Clock;
  rng: Random;
}): PitchMirrorSession {
  const {
    microphone,
    pitchDetector,
    calibration: calRepo,
    mastery: masteryRepo,
    corpus: corpusRepo,
    clock,
    rng,
  } = deps;

  let cal: Calibration | null = null;
  let mastery: Mastery = emptyMastery(0);
  let candidates: SyllableTarget[] = [];
  let rotation: RotationState | null = null;
  let attempt: PitchSample[] = [];
  let listeners: Array<(s: PitchSample) => void> = [];
  let session: SessionSummary = { attempts: 0, passes: 0, rotations: 0 };
  let capturing = false;
  let captureStartTime = 0;
  let lastVerdict: Verdict | null = null;

  function onChunk(chunk: AudioChunk) {
    if (!capturing) return;
    const sample = pitchDetector.detect(chunk.samples, chunk.sampleRate);
    const stamped: PitchSample = {
      ...sample,
      timestamp: chunk.timestamp - captureStartTime,
    };
    attempt.push(stamped);
    for (const l of listeners) l(stamped);
  }

  function chooseInitial(): SyllableTarget {
    if (candidates.length === 0) {
      return { syllable: 'ma', tone: 2, character: '麻' };
    }
    return candidates[Math.floor(rng.next() * candidates.length)]!;
  }

  return {
    async init() {
      cal = await calRepo.load();
      if (!cal) {
        return { ok: false, error: { kind: 'noCalibration' as const } };
      }
      mastery = await masteryRepo.load();
      const entries: SyllableEntry[] = await corpusRepo.syllables();
      candidates = entries.map((e) => ({
        syllable: e.syllable,
        tone: e.tone,
        character: e.character,
      }));
      const start = chooseInitial();
      rotation = { current: start, recentResults: {} };
      return { ok: true, value: cal };
    },
    current(): PitchMirrorItem {
      const c = rotation?.current ?? chooseInitial();
      return { syllable: c.syllable, tone: c.tone, character: c.character };
    },
    target(): ContourPoint[] {
      const tone: Tone = rotation?.current.tone ?? 1;
      return targetContour(tone, TARGET_DURATION_MS);
    },
    async start(): Promise<Result<void, MicError>> {
      attempt = [];
      lastVerdict = null;
      capturing = true;
      captureStartTime = clock.now();
      const status = microphone.status();
      if (status === 'streaming') return { ok: true, value: undefined };
      return microphone.start(onChunk);
    },
    stop(): Verdict {
      capturing = false;
      if (!cal) {
        lastVerdict = { pass: false, shapeDistance: 1, voicedRatio: 0, durationMs: 0 };
        return lastVerdict;
      }
      const tone: Tone = rotation?.current.tone ?? 1;
      const target = targetContour(tone, TARGET_DURATION_MS);
      lastVerdict = scoreAttempt(attempt, target, cal);
      return lastVerdict;
    },
    onLiveSample(cb): Unsubscribe {
      listeners = [...listeners, cb];
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    advance() {
      if (!rotation || !lastVerdict) return;
      const verdict = lastVerdict;
      rotation = recordResult(rotation, rotation.current.syllable, verdict);
      session = {
        ...session,
        attempts: session.attempts + 1,
        passes: session.passes + (verdict.pass ? 1 : 0),
      };
      if (shouldRotate(rotation, rotation.current.syllable)) {
        const next = nextSyllable(rotation, candidates, rng);
        rotation = { current: next, recentResults: rotation.recentResults };
        session = { ...session, rotations: session.rotations + 1 };
      }
      attempt = [];
      lastVerdict = null;
    },
    stats() {
      return session;
    },
    async end() {
      microphone.stop();
      await masteryRepo.save(mastery);
      return session;
    },
  };
}
