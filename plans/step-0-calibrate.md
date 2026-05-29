# Step 0 — Calibrate

> Record a few sustained sounds, map the learner's pitch range. Everything downstream is scored relative to *their* register.

This is the foundation for every later step. If we get calibration wrong, the pitch mirror in Step 2 will punish deep or high voices — exactly the failure mode we said we'd avoid.

---

## Goal

Produce a `Calibration` value for the user and persist it. Downstream code uses it to map any incoming F0 to a normalized `[0, 1]` position in the user's range.

```ts
type Calibration = {
  // F0 percentiles in Hz, from sustained-tone samples
  lowHz: number;       // 10th percentile of low samples
  highHz: number;      // 90th percentile of high samples
  midHz: number;       // 50th percentile of comfortable speech
  // Derived log-Hz scale used for all comparisons downstream
  logLow: number;
  logHigh: number;
  recordedAt: number;  // epoch ms
};
```

---

## User flow

1. **Intro screen.** Explain in two sentences why we're doing this; ask for mic permission.
2. **Three short recordings**, each ~3 seconds:
   - "Say *ahh* at the lowest comfortable pitch you can hold."
   - "Say *ahh* at the highest comfortable pitch you can hold."
   - "Read this sentence at your normal speaking pitch." (one English or pinyin sentence; we just need voiced audio)
3. **Live pitch readout** during each recording (the same `PitchChart` we'll use in Step 2, simplified). User sees the line; this builds trust.
4. **Result screen.** Show their range as a labelled bar (low–mid–high in Hz). One-tap "redo any" option.
5. **Persist** and route to the next phase.

---

## Modules

Organized by hexagonal layer. New ports introduced here; reused later.

### Domain — `src/core/domain/`

**`calibration.ts`**
- `estimateRange(samples: PitchSample[]): Calibration`
  - Drops unvoiced frames (`hz === null`) and frames with clarity < 0.9.
  - Computes percentiles on the **log-Hz** scale (median + 10th/90th).
  - Returns a `Calibration`.
- `normalize(hz: number, cal: Calibration): number`
  - Maps Hz to `[0, 1]` in log-space. Clamps outside the range.

Pure. No I/O, no React, no `Date.now()`.

### Ports — `src/core/ports/`

**`driven/Microphone.ts`**

```ts
type AudioChunk = { samples: Float32Array; sampleRate: number; timestamp: number };
type MicStatus = 'idle' | 'requesting' | 'streaming' | 'denied' | 'error';

interface Microphone {
  status(): MicStatus;
  start(onChunk: (c: AudioChunk) => void): Promise<Result<void, MicError>>;
  stop(): void;
}
```

**`driven/PitchDetector.ts`**

```ts
type PitchSample = { hz: number | null; clarity: number; timestamp: number };

interface PitchDetector {
  detect(chunk: Float32Array, sampleRate: number): PitchSample;
}
```

**`driven/CalibrationRepository.ts`**

```ts
interface CalibrationRepository {
  load(): Promise<Calibration | null>;
  save(cal: Calibration): Promise<void>;
}
```

**`driven/Clock.ts`** — `now(): number`. Even this is a port; keeps domain free of `Date.now()`.

**`driving/CalibrationService.ts`** — use case API consumed by the React adapter:

```ts
interface CalibrationService {
  beginStep(step: 'low' | 'high' | 'speech'): Promise<Result<void, MicError>>;
  endStep(): void;
  draft(): CalibrationDraft;
  finalise(): Promise<Calibration>;
  reset(): void;
}
```

### Use case — `src/core/usecases/calibrationService.ts`

Implements `CalibrationService`. Constructor takes `Microphone`, `PitchDetector`, `CalibrationRepository`, `Clock`. Orchestrates the three recordings: routes each mic chunk through `PitchDetector`, accumulates samples per step, calls `estimateRange` once all three steps have data, persists via the repository.

### Driven adapters

| Path | Implements | Notes |
|---|---|---|
| `src/adapters/driven/webaudio/microphone.ts` | `Microphone` | `getUserMedia` + `AudioContext` (`latencyHint: 'interactive'`). AudioWorkletNode for chunking; ScriptProcessor fallback during the Step 0 spike. Typed `Result` for permission denial — no exceptions in the happy path. |
| `src/adapters/driven/pitchy/pitchDetector.ts` | `PitchDetector` | Stateless wrapper over Pitchy's YIN detector. |
| `src/adapters/driven/indexeddb/calibrationRepository.ts` | `CalibrationRepository` | Single-object store via `idb`. No migrations yet. |
| `src/adapters/driven/system/clock.ts` | `Clock` | `Date.now()`. |

---

## Hooks (headless layer)

Live in `src/adapters/driving/react/hooks/`. Receive ports and the `CalibrationService` use case from the React container; never import adapters directly.

### `useMicrophone()`
Manages permission state and a single shared `AudioContext`. Returns:
```ts
{ status: 'idle' | 'requesting' | 'ready' | 'denied', error?: string, requestAccess: () => void }
```

### `usePitchStream(active: boolean)`
When `active`, captures from the mic and yields a rolling buffer of `PitchSample`. Cleans up on unmount or when `active` flips to `false`.
```ts
{ samples: PitchSample[], currentHz: number | null, reset: () => void }
```

### `useCalibration()`
The orchestrating hook for this screen. Owns the three-recording flow.
```ts
{
  step: 'low' | 'high' | 'speech' | 'done',
  isRecording: boolean,
  livePitchHz: number | null,
  result: Calibration | null,
  startRecording: () => void,
  stopRecording: () => void,
  redoStep: (s: Step) => void,
  save: () => Promise<void>,
}
```

A test component `SimpleCalibration.tsx` (per the headless pattern's testing approach) drives this hook with plain HTML for unit tests.

---

## Components (presentational)

Live in `src/adapters/driving/react/`. Consume hooks; never import from `core/` or `adapters/driven/`.

- `routes/Calibrate.tsx` — the screen. Consumes `useCalibration`. Layout, copy, styling. No logic.
- `components/MicIndicator.tsx` — animated dot showing input level (RMS from raw chunks).
- `components/PitchChart.tsx` — minimal version: just a horizontal scrolling line showing live F0. Will grow into the Step 2 mirror.
- `components/RangeBar.tsx` — the result visualisation; a horizontal bar with low/mid/high markers in Hz.

---

## Algorithms / decisions

- **YIN over autocorrelation.** Pitchy's YIN handles octave errors better at the price of CPU; for a single-syllable voice signal it's plenty fast.
- **Log-Hz scale everywhere.** Humans hear pitch logarithmically; `log2(hz)` makes the rest of the math (intervals, normalization, distances) sane.
- **Reject by clarity, not by RMS.** Whisper-quiet but clean signal is fine; loud breath noise isn't.
- **Percentiles, not min/max.** A single squeak or octave error shouldn't define the user's range. 10th/90th percentile is robust.

---

## Acceptance criteria

- [ ] Fresh user with no calibration is routed to this screen on app open.
- [ ] Mic permission denial shows a clear message with a "try again" button; doesn't crash.
- [ ] Each recording shows a live pitch line while active.
- [ ] After all three recordings, the user sees their range in Hz on a labelled bar.
- [ ] "Redo" on any step works and updates the result.
- [ ] Calibration persists across reloads (IndexedDB).
- [ ] Re-running calibration overwrites cleanly.
- [ ] `estimateRange` is covered by unit tests with synthetic pitch arrays (low voice, high voice, signal with octave errors, mostly-unvoiced signal).

---

## Out of scope (for now)

- Multiple users / profiles.
- Periodic re-calibration prompts (Step 7 territory).
- Detecting that someone is in a noisy environment and bailing out.

---

## Open questions

- **Where to render `PitchChart`?** During recording it should feel immediate. We'll need to decide whether to drive the canvas from a React effect (fine at 60fps for one line) or hand the canvas ref directly to `usePitchStream` and bypass React on the render path. Decide while building.
- **One sentence or a few sustained vowels for the "speech" sample?** A sentence catches more realistic register variation; a sustained vowel gives a cleaner median. We can start with the sentence and see.
