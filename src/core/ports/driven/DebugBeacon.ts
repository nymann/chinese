export type BeaconValue = string | number | boolean | null | undefined;

export interface DebugBeacon {
  report(event: string, data?: Record<string, BeaconValue>): void;
}
