import type { AudioPlayer } from '../../../core/ports/driven/AudioPlayer.js';

export function createCompositeAudioPlayer(synthetic: AudioPlayer): AudioPlayer {
  let current: HTMLAudioElement | null = null;

  function isSynth(url: string): boolean {
    return url.startsWith('synth:');
  }

  function playFile(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const el = new Audio(url);
      el.preload = 'auto';
      const done = () => {
        if (current === el) current = null;
        resolve();
      };
      el.addEventListener('ended', done, { once: true });
      el.addEventListener('error', () => reject(new Error(`audio load failed: ${url}`)), {
        once: true,
      });
      current = el;
      void el.play().catch(reject);
    });
  }

  return {
    async play(url) {
      if (isSynth(url)) return synthetic.play(url);
      await playFile(url);
    },
    async playSequence(urls, gapMs) {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        if (isSynth(url)) {
          await synthetic.play(url);
        } else {
          await playFile(url);
        }
        if (i < urls.length - 1) {
          await new Promise((r) => setTimeout(r, gapMs));
        }
      }
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
