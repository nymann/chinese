import type { Calibration } from '../../../core/domain/calibration.js';
import type { CalibrationRepository } from '../../../core/ports/driven/CalibrationRepository.js';

import { getDb, STORE_CALIBRATION } from './db.js';

const KEY = 'current';

export function createIndexedDbCalibrationRepository(): CalibrationRepository {
  return {
    async load() {
      const db = await getDb();
      const value = await db.get(STORE_CALIBRATION, KEY);
      return (value as Calibration | undefined) ?? null;
    },
    async save(cal) {
      const db = await getDb();
      await db.put(STORE_CALIBRATION, cal, KEY);
    },
  };
}
