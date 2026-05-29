import type { Calibration } from '../../domain/calibration.js';

export interface CalibrationRepository {
  load(): Promise<Calibration | null>;
  save(cal: Calibration): Promise<void>;
}
