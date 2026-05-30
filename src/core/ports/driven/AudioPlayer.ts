export interface AudioPlayer {
  /** Resolves with `true` when audio actually played, `false` when the browser blocked it (e.g. mobile autoplay before a user gesture). */
  play(url: string): Promise<boolean>;
  playSequence(urls: string[], gapMs: number): Promise<boolean>;
  stop(): void;
}
