import type {
  BeaconValue,
  DebugBeacon,
} from '../../../core/ports/driven/DebugBeacon.js';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function encodeValue(v: BeaconValue): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function createHttpDebugBeacon(endpoint = '/debug/'): DebugBeacon {
  if (import.meta.env.DEV) {
    return {
      report(event, data) {
        // eslint-disable-next-line no-console
        console.debug('[beacon]', event, data ?? {});
      },
    };
  }

  const sessionId = randomId();
  let counter = 0;

  return {
    report(event, data) {
      const params = new URLSearchParams();
      params.set('s', sessionId);
      params.set('n', String(++counter));
      params.set('e', event);
      if (data) {
        for (const [k, v] of Object.entries(data)) {
          if (v === undefined) continue;
          params.set(k, encodeValue(v));
        }
      }
      const url = `${endpoint}?${params.toString()}`;
      try {
        void fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          keepalive: true,
          credentials: 'omit',
        }).catch(() => {});
      } catch {
        // never propagate beacon failures
      }
    },
  };
}
