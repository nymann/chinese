import { createIndexedDbCalibrationRepository } from '../adapters/driven/indexeddb/calibrationRepository.js';
import { createIndexedDbMasteryRepository } from '../adapters/driven/indexeddb/masteryRepository.js';
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

import type { CalibrationService } from '../core/ports/driving/CalibrationService.js';
import type { EarTrainingSession } from '../core/ports/driving/EarTrainingSession.js';
import type { PitchMirrorSession } from '../core/ports/driving/PitchMirrorSession.js';

export type Container = {
  calibration: CalibrationService;
  earTraining: EarTrainingSession;
  pitchMirror: PitchMirrorSession;
};

export function buildContainer(): Container {
  const microphone = createWebAudioMicrophone();
  const pitchDetector = createPitchyDetector();
  const calibrationRepo = createIndexedDbCalibrationRepository();
  const masteryRepo = createIndexedDbMasteryRepository();
  const statsRepo = createLocalStorageSessionStatsRepository();
  const corpusRepo = createStaticCorpusRepository();
  const player = createCompositeAudioPlayer(createSyntheticAudioPlayer());
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

  return { calibration, earTraining, pitchMirror };
}
