export interface AudioPlayer {
  play(url: string): Promise<void>;
  playSequence(urls: string[], gapMs: number): Promise<void>;
  stop(): void;
}
