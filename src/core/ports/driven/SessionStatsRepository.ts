import type { EarTrainingMode, SessionStats } from '../driving/EarTrainingSession.js';

export interface SessionStatsRepository {
  load(mode: EarTrainingMode): Promise<SessionStats>;
  save(mode: EarTrainingMode, stats: SessionStats): Promise<void>;
}
