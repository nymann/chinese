import type { AudioPlayer } from '../../../core/ports/driven/AudioPlayer.js';
import type { DebugBeacon } from '../../../core/ports/driven/DebugBeacon.js';

export function createCompositeAudioPlayer(
  synthetic: AudioPlayer,
  beacon: DebugBeacon,
): AudioPlayer {
  let current: HTMLAudioElement | null = null;
  let firstFilePlayReported = false;

  function isSynth(url: string): boolean {
    return url.startsWith('synth:');
  }

  function playFile(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const el = new Audio(url);
      el.preload = 'auto';
      let unlocked = false;
      el.addEventListener(
        'ended',
        () => {
          if (current === el) current = null;
          if (unlocked && !firstFilePlayReported) {
            firstFilePlayReported = true;
            beacon.report('file.play.first', {});
          }
          resolve(unlocked);
        },
        { once: true },
      );
      el.addEventListener(
        'error',
        () => {
          beacon.report('file.load.error', { url });
          reject(new Error(`audio load failed: ${url}`));
        },
        { once: true },
      );
      current = el;
      el.play().then(
        () => {
          unlocked = true;
        },
        (err: unknown) => {
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            beacon.report('file.play.blocked', {});
            if (current === el) current = null;
            resolve(false);
            return;
          }
          beacon.report('file.play.error', {
            name: (err as { name?: string } | null)?.name ?? 'unknown',
          });
          reject(err);
        },
      );
    });
  }

  return {
    async play(url) {
      if (isSynth(url)) return synthetic.play(url);
      return playFile(url);
    },
    async playSequence(urls, gapMs) {
      let allPlayed = true;
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        const played = isSynth(url) ? await synthetic.play(url) : await playFile(url);
        if (!played) allPlayed = false;
        if (i < urls.length - 1) {
          await new Promise((r) => setTimeout(r, gapMs));
        }
      }
      return allPlayed;
    },
    stop() {
      synthetic.stop();
      if (current) {
        current.pause();
        current.currentTime = 0;
        current = null;
      }
    },
  };
}
