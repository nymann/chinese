import type {
  EarTrainingMode,
  SessionStats,
} from '../../../core/ports/driving/EarTrainingSession.js';
import type { SessionStatsRepository } from '../../../core/ports/driven/SessionStatsRepository.js';

const KEY_PREFIX = 'mockingbird:stats:';
const EMPTY: SessionStats = { trials: 0, correct: 0 };

function keyFor(mode: EarTrainingMode): string {
  return KEY_PREFIX + mode;
}

export function createLocalStorageSessionStatsRepository(): SessionStatsRepository {
  return {
    async load(mode) {
      try {
        const raw = localStorage.getItem(keyFor(mode));
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<SessionStats>;
        return {
          trials: typeof parsed.trials === 'number' ? parsed.trials : 0,
          correct: typeof parsed.correct === 'number' ? parsed.correct : 0,
        };
      } catch {
        return EMPTY;
      }
    },
    async save(mode, stats) {
      try {
        localStorage.setItem(keyFor(mode), JSON.stringify(stats));
      } catch {
        /* localStorage disabled (private mode etc.); silently no-op */
      }
    },
  };
}
