export type AudioChunk = {
  samples: Float32Array;
  sampleRate: number;
  timestamp: number;
};

export type MicStatus = 'idle' | 'requesting' | 'streaming' | 'denied' | 'error';

export type MicError =
  | { kind: 'denied'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'unknown'; message: string };

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Microphone {
  status(): MicStatus;
  start(onChunk: (c: AudioChunk) => void): Promise<Result<void, MicError>>;
  stop(): void;
}
