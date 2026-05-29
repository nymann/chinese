import type { Clock } from '../../../core/ports/driven/Clock.js';

export const systemClock: Clock = {
  now: () => Date.now(),
};
