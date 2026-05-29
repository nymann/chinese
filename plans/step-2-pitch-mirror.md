# Step 2 — Pitch mirror

> You speak; your voice draws a glowing line in real time against a ghost target contour, normalized to your range. Karaoke for pitch. Built-in ceiling so you can't camp on one syllable.

This is the showcase screen of the MVP. If it feels good, the whole product feels good. The technical bar is real-time pitch capture with low enough latency that "what I sing" and "what I see" feel like the same event.

---

## Goal

A drill loop:

1. Tool picks the next syllable (single tone, e.g. *má*).
2. Ghost contour appears: the canonical tone shape on a log-Hz canvas, normalized to the user's range from Step 0.
3. User taps → starts capturing → speaks the syllable.
4. Live pitch line is drawn over the ghost in real time.
5. On end-of-utterance (silence detected), the line is scored:
   - **Pass:** brief ✓ flash, queue advances after a short delay.
   - **Retry:** the trace stays visible, user can tap to try again.
6. After **N consecutive passes** on the syllable, the tool **rotates** to something else — the "built-in ceiling" preventing camping.

No percent scores on screen. Pass/retry only. Diagnostic feedback ("your T2 doesn't rise steeply enough") is Step 3 — for now the line is the feedback.

---

## User flow

1. **Pre-flight check.** First time on the screen, confirm calibration is recent (< 30 days). If stale or missing, route back to Step 0.
2. **Drill screen.**
   - Top: the syllable (large) and its character (small).
   - Middle: the pitch chart. Ghost contour drawn faintly. Mic indicator overlaid.
   - Bottom: a single big "🎙 Hold to speak" button OR auto-VAD (voice activity detection) mode toggle.
3. **Capture.** While capturing, the live line is drawn left-to-right. Once we detect end-of-voicing for ~300ms, capture stops.
4. **Score + feedback.** Pass → ✓, line stays for 600ms, next item. Retry → trace stays, user re-taps.
5. **Rotation.** After 3 consecutive passes on the same syllable (within last 5 attempts), the syllable changes. The user does not get to choose to repeat the same one indefinitely.
6. **Session end.** After N items or M minutes, summary: which syllables were practiced, how many passes vs. retries, what to try next session.

---

## Modules

Extends the Step 0/1 architecture. No new driven ports — the `Microphone` and `PitchDetector` ports from Step 0 carry over; the streaming path is an adapter-internal optimisation. One new driving port (the use case) and adapter extensions for low-latency capture.

### Domain extensions — `src/core/domain/`

**`tones.ts`** — add canonical contours:

```ts
type ToneShape = { points: Array<{ t: number; pitch: number }> };  // t in [0,1], pitch in [0,1]

const TONE_SHAPES: Record<Tone, ToneShape> = {
  1: { points: [{ t: 0, pitch: 0.85 }, { t: 1, pitch: 0.85 }] },             // flat high
  2: { points: [{ t: 0, pitch: 0.40 }, { t: 1, pitch: 0.90 }] },             // rising
  3: { points: [{ t: 0, pitch: 0.45 }, { t: 0.5, pitch: 0.10 }, { t: 1, pitch: 0.55 }] }, // dipping
  4: { points: [{ t: 0, pitch: 0.95 }, { t: 1, pitch: 0.20 }] },             // sharp fall
  0: { points: [{ t: 0, pitch: 0.50 }, { t: 1, pitch: 0.45 }] },             // neutral
};

function targetContour(tone: Tone, durationMs: number, cal: Calibration): ContourPoint[];
```

Pitch values are normalized `[0,1]` in the user's log-Hz range. The renderer maps them into pixels.

**`scoring.ts`** (new):

```ts
type Verdict = {
  pass: boolean;
  shapeDistance: number;     // normalized DTW distance against target
  voicedRatio: number;       // fraction of voiced frames
  durationMs: number;
};

function scoreAttempt(samples: PitchSample[], target: ContourPoint[], cal: Calibration): Verdict;
```

Algorithm:
1. Drop unvoiced frames from the head/tail.
2. Map each voiced frame's Hz to normalized `[0,1]` via `normalize(hz, cal)`.
3. Resample target and observed to the same length.
4. Compute **DTW distance** on the normalized values (shape, not absolute pitch).
5. Pass when: shapeDistance < threshold AND voicedRatio > 0.7 AND durationMs in [200, 1500].

Tunable thresholds; constants now, dev-mode slider later. Pure — takes a `Calibration`, returns a `Verdict`.

**`adaptive/rotation.ts`** (new):

```ts
type RotationState = {
  syllableQueue: SyllableKey[];
  recentResults: Record<SyllableKey, Verdict[]>;  // bounded ring buffer per syllable
};

function shouldRotate(syllable: SyllableKey, state: RotationState): boolean;
function nextSyllable(state: RotationState, mastery: Mastery, rng: Random): SyllableKey;
```

Rotation rule: rotate when last 5 attempts contain ≥ 3 passes. Next syllable picked via Step 1's sampler, biased toward weak tones.

### Driving port — `src/core/ports/driving/PitchMirrorSession.ts`

```ts
type CurrentItem = { syllable: SyllableKey; tone: Tone; character: string };
type Unsubscribe = () => void;

interface PitchMirrorSession {
  current(): CurrentItem;
  start(): Promise<Result<void, MicError>>;                // open mic, begin capture
  stop(): Verdict;                                         // end capture, score
  onLiveSample(cb: (s: PitchSample) => void): Unsubscribe; // for live pitch line
  advance(): void;                                         // commit verdict, apply rotation, queue next
  stats(): { attempts: number; passes: number; rotations: number };
  end(): Promise<SessionSummary>;
}
```

### Use case — `src/core/usecases/pitchMirrorSession.ts`

Implements `PitchMirrorSession`. Constructor takes `Microphone`, `PitchDetector`, `CalibrationRepository`, `MasteryRepository`, `CorpusRepository`, `Clock`, `Random`. On `start`: loads calibration (errors if missing/stale), opens mic, forwards each chunk through `PitchDetector`, pushes the resulting `PitchSample` to subscribers + the attempt buffer. On `stop`: runs `scoreAttempt`, returns the verdict. On `advance`: updates `RotationState`, updates per-syllable mastery, persists, picks the next syllable.

### Driven adapter extensions

| Path | Notes |
|---|---|
| `src/adapters/driven/webaudio/microphone.ts` | From Step 0. Now gains an internal `AudioWorkletNode` path for low-latency chunking when available. |
| `src/adapters/driven/webaudio/pitch-worklet.ts` | The `AudioWorkletProcessor`. Runs `PitchDetector` off the main thread and `postMessage`s `PitchSample` events. Vite-bundled as a separate entry (`?worker&url` or the `@vitejs/plugin-react` worker config). |
| `src/adapters/driven/pitchy/pitchDetector.ts` | From Step 0. Same chunk-by-chunk `detect()` reused inside the worklet. |

The use case sees a clean `Microphone` + `PitchDetector` pair; the worklet plumbing is invisible above the port boundary.

---

## Hooks

Live in `src/adapters/driving/react/hooks/`. Receive ports and the `PitchMirrorSession` use case from the React container; never import adapters directly.

### `usePitchMirror(syllable: SyllableKey, tone: Tone)`

```ts
{
  target: ContourPoint[],
  state: 'idle' | 'recording' | 'scoring' | 'pass' | 'retry',
  liveSample: PitchSample | null,      // for the live line
  liveBuffer: PitchSample[],           // accumulating attempt
  start: () => void,
  stop: () => void,
  lastVerdict: Verdict | null,
}
```

### `usePitchMirrorSession()`
The screen-level hook. Wraps `usePitchMirror`, owns rotation, decides the next syllable, persists results.

```ts
{
  current: { syllable: SyllableKey; tone: Tone; character: string },
  mirror: ReturnType<typeof usePitchMirror>,
  endSession: () => void,
  stats: { attempts: number; passes: number; rotations: number },
}
```

---

## Components

Live in `src/adapters/driving/react/`. Consume hooks; never import from `core/` or `adapters/driven/`.

- `routes/PitchMirror.tsx` — screen. Consumes `usePitchMirrorSession`.
- `components/PitchChart.tsx` — full version. Draws:
  - Ghost target contour (low-opacity layer).
  - Live pitch line (high-opacity, glowing trail).
  - Y-axis: normalized log-Hz, labelled with the user's low/mid/high markers.
  - X-axis: time, ~1500ms window.
  - Renders directly to a `<canvas>` from `requestAnimationFrame`; receives data via ref, not React state, to keep frame timing tight.
- `components/CaptureButton.tsx` — hold-to-speak with VAD-mode toggle.
- `components/VerdictFlash.tsx` — ✓ or ↺ overlay.

---

## Latency budget

End-to-end (mic → screen) target: **< 60ms perceived**.

| Stage | Budget | Notes |
|---|---|---|
| Mic + getUserMedia buffer | ~15ms | OS-controlled. Use latency hint `'interactive'`. |
| AudioWorklet chunk size | ~10ms | 480 samples @ 48kHz. |
| Pitch detection (Pitchy YIN) | < 5ms | Per chunk, plenty of headroom. |
| Worklet → main thread postMessage | < 5ms | |
| Canvas redraw (rAF) | ~16ms | One frame at 60Hz. |

Above ~60ms feels laggy; below ~30ms feels instantaneous. We aim between.

---

## Acceptance criteria

- [ ] First-run on the screen routes to calibration if missing/stale.
- [ ] Ghost contour renders correctly for each tone, normalized to the user's range.
- [ ] Live pitch line follows the voice with no perceptible lag on a desktop browser.
- [ ] Pass/retry verdict appears within 300ms of utterance end.
- [ ] Rotation rule fires after 3-of-last-5 passes; user can't camp.
- [ ] Session attempts are logged to IndexedDB.
- [ ] Works in Chrome, Firefox, Safari (test on each).
- [ ] No clipping or crash on a deep voice (~80Hz fundamental) or a high voice (~350Hz).

---

## Out of scope

- Diagnostic explanations ("your T2 doesn't rise steeply enough"). Step 3.
- Meaning-attached drilling with character consequences. Step 4.
- Tone pairs / two-syllable contours. Step 5.
- Sentence-level prosody. Step 6.
- Better pitch model than Pitchy/YIN. Revisit if shapeDistance is noisy in practice.

---

## Open questions

- **Hold-to-speak vs. VAD-only.** Hold gives the user control; VAD feels more natural. Ship both, default to VAD, let users toggle.
- **Visualisation aesthetic.** "Glowing line" vs. a vertical particle column vs. a simple thick line. Start with a thick line; iterate on feel.
- **Per-tone pass thresholds.** T3 is harder to score because its dip is fragile; we may need looser shapeDistance for T3 than T4. Decide after first real-use data.
