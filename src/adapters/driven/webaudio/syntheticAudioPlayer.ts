import type { AudioPlayer } from '../../../core/ports/driven/AudioPlayer.js';

const VOICE_BASE_HZ: Record<string, number> = {
  v1: 180,
  v2: 220,
  v3: 140,
};

const TONE_SHAPE: Record<number, Array<{ t: number; mult: number }>> = {
  1: [
    { t: 0, mult: 1.25 },
    { t: 1, mult: 1.25 },
  ],
  2: [
    { t: 0, mult: 0.85 },
    { t: 1, mult: 1.4 },
  ],
  3: [
    { t: 0, mult: 0.9 },
    { t: 0.5, mult: 0.55 },
    { t: 1, mult: 1.0 },
  ],
  4: [
    { t: 0, mult: 1.45 },
    { t: 1, mult: 0.75 },
  ],
};

const DURATION_SEC = 0.6;

type ParsedUrl = { syllable: string; tone: number; voice: string };

function parseUrl(url: string): ParsedUrl | null {
  const m = /^synth:([a-z]+):([1-4]):([a-z0-9]+)$/.exec(url);
  if (!m) return null;
  return { syllable: m[1]!, tone: Number(m[2]!), voice: m[3]! };
}

export function createSyntheticAudioPlayer(): AudioPlayer {
  let ctx: AudioContext | null = null;
  let active: { stop: () => void } | null = null;

  function getCtx(): AudioContext {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    return ctx;
  }

  async function ensureRunning(audio: AudioContext): Promise<boolean> {
    if (audio.state === 'suspended') {
      try {
        await audio.resume();
      } catch {
        /* user gesture missing; will retry next call */
      }
    }
    return audio.state === 'running';
  }

  function playOne(url: string, startAt: number): Promise<void> {
    const parsed = parseUrl(url);
    if (!parsed) return Promise.resolve();
    const audio = getCtx();
    const base = VOICE_BASE_HZ[parsed.voice] ?? 180;
    const knots = TONE_SHAPE[parsed.tone] ?? TONE_SHAPE[1]!;
    const t0 = Math.max(audio.currentTime, startAt);
    const t1 = t0 + DURATION_SEC;

    const osc = audio.createOscillator();
    osc.type = 'sawtooth';

    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 4;

    const formant = audio.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 850;
    formant.Q.value = 5;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.03);
    gain.gain.linearRampToValueAtTime(0.18, t1 - 0.06);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc.frequency.setValueAtTime(base * knots[0]!.mult, t0);
    for (const k of knots.slice(1)) {
      osc.frequency.linearRampToValueAtTime(
        base * k.mult,
        t0 + k.t * DURATION_SEC,
      );
    }

    osc.connect(filter);
    filter.connect(formant);
    formant.connect(gain);
    gain.connect(audio.destination);

    osc.start(t0);
    osc.stop(t1 + 0.05);

    const handle = { stop: () => osc.stop() };
    active = handle;

    return new Promise<void>((resolve) => {
      const remainingMs = (t1 - audio.currentTime) * 1000 + 20;
      setTimeout(() => {
        if (active === handle) active = null;
        resolve();
      }, Math.max(0, remainingMs));
    });
  }

  return {
    async play(url) {
      const audio = getCtx();
      const running = await ensureRunning(audio);
      if (!running) return false;
      await playOne(url, audio.currentTime);
      return true;
    },
    async playSequence(urls, gapMs) {
      const audio = getCtx();
      const running = await ensureRunning(audio);
      if (!running) return false;
      let cursor = audio.currentTime;
      for (let i = 0; i < urls.length; i++) {
        await playOne(urls[i]!, cursor);
        cursor = audio.currentTime + gapMs / 1000;
        if (i < urls.length - 1) {
          await new Promise((r) => setTimeout(r, gapMs));
        }
      }
      return true;
    },
    stop() {
      active?.stop();
      active = null;
    },
  };
}
