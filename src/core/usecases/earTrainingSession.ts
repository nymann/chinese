import {
  currentLevel,
  emptyMastery,
  gatePassed,
  levelPairStats,
  levelProgress,
  pairsForLevel,
  tonesForLevel,
  voiceCohortForLevel,
  type EarLevel,
  type Mastery,
} from '../domain/adaptive/mastery.js';
import {
  nextDiscriminationItem,
  nextIdentificationItem,
  type SamplerConstraints,
} from '../domain/adaptive/sampler.js';
import type { CorpusItem, Tone } from '../domain/tones.js';
import type { AudioPlayer } from '../ports/driven/AudioPlayer.js';
import type { Clock } from '../ports/driven/Clock.js';
import type { CorpusRepository } from '../ports/driven/CorpusRepository.js';
import type { MasteryRepository, TrialRecord } from '../ports/driven/MasteryRepository.js';
import type { Random } from '../ports/driven/Random.js';
import type { SessionStatsRepository } from '../ports/driven/SessionStatsRepository.js';
import type {
  CurrentEarItem,
  EarChoice,
  EarTrainingMode,
  EarTrainingSession,
  FeedbackFlash,
  SessionStats,
} from '../ports/driving/EarTrainingSession.js';

const DISCRIMINATION_GAP_MS = 600;

export function createEarTrainingSession(deps: {
  player: AudioPlayer;
  mastery: MasteryRepository;
  corpus: CorpusRepository;
  stats: SessionStatsRepository;
  clock: Clock;
  rng: Random;
}): EarTrainingSession {
  const {
    player,
    mastery: masteryRepo,
    corpus: corpusRepo,
    stats: statsRepo,
    clock,
    rng,
  } = deps;

  let mode: EarTrainingMode = 'identification';
  let corpus: CorpusItem[] = [];
  let mastery: Mastery = emptyMastery(0);
  let currentItem: CurrentEarItem | null = null;
  let stats: SessionStats = { trials: 0, correct: 0 };

  async function loadIfNeeded() {
    if (corpus.length === 0) corpus = await corpusRepo.load();
    mastery = await masteryRepo.load();
  }

  function allVoicesSorted(): string[] {
    return [...new Set(corpus.map((c) => c.voice))].sort();
  }

  function allowedVoices(level: EarLevel): readonly string[] {
    const cohort = voiceCohortForLevel(level);
    const voices = allVoicesSorted();
    if (cohort === 'all') return voices;
    return voices.slice(0, cohort);
  }

  function constraints(): SamplerConstraints {
    const level = currentLevel(mastery);
    return {
      allowedTones: tonesForLevel(level),
      allowedPairs: pairsForLevel(level),
      allowedVoices: allowedVoices(level),
    };
  }

  function pickNext(): CurrentEarItem {
    const c = constraints();
    if (mode === 'discrimination') {
      const { a, b, isSame } = nextDiscriminationItem(corpus, mastery, rng, c);
      return { mode, a, b, isSame };
    }
    return { mode, item: nextIdentificationItem(corpus, mastery, rng, c) };
  }

  async function playCurrent(): Promise<boolean> {
    if (!currentItem) return false;
    if (currentItem.mode === 'discrimination') {
      return player.playSequence(
        [currentItem.a.url, currentItem.b.url],
        DISCRIMINATION_GAP_MS,
      );
    }
    return player.play(currentItem.item.url);
  }

  function updateMastery(played: Tone, perceived: Tone | 'same' | 'different', correct: boolean) {
    mastery = { ...mastery, updatedAt: clock.now() };
    if (typeof perceived === 'number') {
      const key = `${played}->${perceived}` as const;
      const cell = mastery.identification[key] ?? { trials: 0, correct: 0 };
      mastery.identification = {
        ...mastery.identification,
        [key]: { trials: cell.trials + 1, correct: cell.correct + (correct ? 1 : 0) },
      };
    } else if (currentItem?.mode === 'discrimination') {
      const a = currentItem.a.tone;
      const b = currentItem.b.tone;
      const lo = Math.min(a, b) as Tone;
      const hi = Math.max(a, b) as Tone;
      const key = `${lo}|${hi}` as const;
      const cell = mastery.discrimination[key] ?? { trials: 0, correct: 0 };
      mastery.discrimination = {
        ...mastery.discrimination,
        [key]: { trials: cell.trials + 1, correct: cell.correct + (correct ? 1 : 0) },
      };
    }
  }

  return {
    async start(m) {
      mode = m;
      await loadIfNeeded();
      stats = await statsRepo.load(m);
      currentItem = pickNext();
      return playCurrent();
    },
    current() {
      return currentItem;
    },
    async replay() {
      return playCurrent();
    },
    async answer(choice: EarChoice): Promise<FeedbackFlash> {
      if (!currentItem) return null;
      let correct = false;
      const trial: TrialRecord = {
        mode,
        played: currentItem.mode === 'identification' ? currentItem.item.tone : currentItem.a.tone,
        perceived: 'same',
        correct: false,
        timestamp: clock.now(),
      };
      if (currentItem.mode === 'discrimination' && choice.kind !== 'tone') {
        const userSays = choice.kind === 'same';
        correct = userSays === currentItem.isSame;
        trial.perceived = userSays ? 'same' : 'different';
        updateMastery(currentItem.a.tone, userSays ? 'same' : 'different', correct);
      } else if (currentItem.mode === 'identification' && choice.kind === 'tone') {
        correct = choice.tone === currentItem.item.tone;
        trial.perceived = choice.tone;
        updateMastery(currentItem.item.tone, choice.tone, correct);
      }
      trial.correct = correct;
      stats = { trials: stats.trials + 1, correct: stats.correct + (correct ? 1 : 0) };
      await masteryRepo.appendTrial(trial);
      await masteryRepo.save(mastery);
      await statsRepo.save(mode, stats);
      return correct ? 'correct' : 'wrong';
    },
    async advance() {
      currentItem = pickNext();
      return playCurrent();
    },
    stats() {
      return stats;
    },
    gateToStep2Unlocked() {
      return gatePassed(mastery);
    },
    level(): EarLevel {
      return currentLevel(mastery);
    },
    levelPairs() {
      return pairsForLevel(currentLevel(mastery));
    },
    levelTones() {
      return tonesForLevel(currentLevel(mastery));
    },
    levelProgress() {
      return levelProgress(currentLevel(mastery), mastery);
    },
    levelPairStats() {
      return levelPairStats(currentLevel(mastery), mastery);
    },
    async end() {
      await masteryRepo.save(mastery);
      return stats;
    },
  };
}
