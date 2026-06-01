import { createHttpDebugBeacon } from '../adapters/driven/http/debugBeacon.js';
import { createIndexedDbCalibrationRepository } from '../adapters/driven/indexeddb/calibrationRepository.js';
import { createIndexedDbMasteryRepository } from '../adapters/driven/indexeddb/masteryRepository.js';
import { createLocalStoragePreferencesRepository } from '../adapters/driven/localStorage/preferencesRepository.js';
import { createLocalStorageSessionStatsRepository } from '../adapters/driven/localStorage/sessionStatsRepository.js';
import { createPitchyDetector } from '../adapters/driven/pitchy/pitchDetector.js';
import { createStaticCorpusRepository } from '../adapters/driven/static/corpusRepository.js';
import { systemClock } from '../adapters/driven/system/clock.js';
import { mathRandom } from '../adapters/driven/system/random.js';
import { createCompositeAudioPlayer } from '../adapters/driven/webaudio/compositeAudioPlayer.js';
import { createSyntheticAudioPlayer } from '../adapters/driven/webaudio/syntheticAudioPlayer.js';
import { createWebAudioMicrophone } from '../adapters/driven/webaudio/microphone.js';

import { createCalibrationService } from '../core/usecases/calibrationService.js';
import { createEarTrainingSession } from '../core/usecases/earTrainingSession.js';
import { createPitchMirrorSession } from '../core/usecases/pitchMirrorSession.js';

import type { DebugBeacon } from '../core/ports/driven/DebugBeacon.js';
import type { PreferencesRepository } from '../core/ports/driven/PreferencesRepository.js';
import type { VoiceInfo } from '../core/domain/tones.js';
import type { CalibrationService } from '../core/ports/driving/CalibrationService.js';
import type { EarTrainingSession } from '../core/ports/driving/EarTrainingSession.js';
import type { PitchMirrorSession } from '../core/ports/driving/PitchMirrorSession.js';

function reportBoot(beacon: DebugBeacon): void {
  const win = window as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  const nav = navigator as Navigator & { audioSession?: unknown };
  beacon.report('boot', {
    hasAudioContext: typeof win.AudioContext === 'function',
    hasWebkitAudioContext: typeof win.webkitAudioContext === 'function',
    hasMediaDevices: typeof nav.mediaDevices !== 'undefined',
    hasGetUserMedia:
      typeof nav.mediaDevices?.getUserMedia === 'function',
    hasAudioSession: typeof nav.audioSession !== 'undefined',
    pageVisible: !document.hidden,
    referrer: document.referrer || null,
  });
}

export type Container = {
  calibration: CalibrationService;
  earTraining: EarTrainingSession;
  pitchMirror: PitchMirrorSession;
  preferences: PreferencesRepository;
  voices: VoiceInfo[];
};

export function buildContainer(): Container {
  const beacon = createHttpDebugBeacon();
  reportBoot(beacon);
  const microphone = createWebAudioMicrophone();
  const pitchDetector = createPitchyDetector();
  const calibrationRepo = createIndexedDbCalibrationRepository();
  const masteryRepo = createIndexedDbMasteryRepository();
  const statsRepo = createLocalStorageSessionStatsRepository();
  const preferencesRepo = createLocalStoragePreferencesRepository();
  const corpusRepo = createStaticCorpusRepository();
  const player = createCompositeAudioPlayer(
    createSyntheticAudioPlayer({ beacon }),
    beacon,
  );
  const clock = systemClock;
  const rng = mathRandom;

  const calibration = createCalibrationService({
    microphone,
    pitchDetector,
    repository: calibrationRepo,
    clock,
  });
  const earTraining = createEarTrainingSession({
    player,
    mastery: masteryRepo,
    corpus: corpusRepo,
    stats: statsRepo,
    preferences: preferencesRepo,
    clock,
    rng,
  });
  const pitchMirror = createPitchMirrorSession({
    microphone,
    pitchDetector,
    calibration: calibrationRepo,
    mastery: masteryRepo,
    corpus: corpusRepo,
    clock,
    rng,
  });

  return {
    calibration,
    earTraining,
    pitchMirror,
    preferences: preferencesRepo,
    voices: corpusRepo.voices(),
  };
}
