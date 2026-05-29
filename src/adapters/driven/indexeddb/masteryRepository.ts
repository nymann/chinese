import { emptyMastery, type Mastery } from '../../../core/domain/adaptive/mastery.js';
import type {
  MasteryRepository,
  TrialRecord,
} from '../../../core/ports/driven/MasteryRepository.js';

import { getDb, STORE_MASTERY, STORE_TRIALS } from './db.js';

const KEY = 'current';

export function createIndexedDbMasteryRepository(): MasteryRepository {
  return {
    async load() {
      const db = await getDb();
      const value = await db.get(STORE_MASTERY, KEY);
      return (value as Mastery | undefined) ?? emptyMastery(Date.now());
    },
    async save(m) {
      const db = await getDb();
      await db.put(STORE_MASTERY, m, KEY);
    },
    async appendTrial(t: TrialRecord) {
      const db = await getDb();
      await db.add(STORE_TRIALS, t);
    },
  };
}
