# Step 1 — Ear training

> Adaptive *discrimination* and *identification* drills, using many native voices, with the engine hunting the learner's specific blind spot. **Gate:** no production until perception is reliable.

This is where the app's "diagnostic intelligence" thesis first earns its keep. Even a simple adaptive sampler is dramatically better than the typical "drill every tone evenly" pattern.

---

## Goal

Two drill types, both adaptive:

1. **Discrimination** — "same or different?" Play two syllables; user picks SAME or DIFFERENT.
2. **Identification** — "which tone?" Play one syllable; user picks tone 1/2/3/4 (and neutral, optional in MVP).

A per-tone-pair mastery model decides what to play next. The screen does not unlock Step 2 until identification accuracy on the user's weakest tone-pair crosses a threshold (target: 85% over the last 20 trials on that pair).

---

## User flow

1. **Drill picker.** Two cards: "Same or different?" and "Which tone?" with a small mastery dial on each. The screen also shows the gate status to Step 2.
2. **Discrimination drill.**
   - Audio plays automatically (single 🔁 replay button).
   - Two big buttons: SAME / DIFFERENT.
   - On answer: brief flash (✓ or ✗) + the next item starts in ~600ms.
   - No score on screen. Diagnostic feedback (later: "you're missing T2 vs T3 specifically") shows after every ~10 items.
3. **Identification drill.** Same rhythm, tone-1/2/3/4 buttons.
4. **Session end.** After N items or M minutes (user choice on the drill picker), show: items completed, mastery delta per tone-pair, and the next recommended drill.
5. **Gate to Step 2** unlocks silently once threshold is met — surface a "Pitch mirror unlocked" toast.

No streaks, no XP, no celebratory animations. The reward is hearing yourself improve.

---

## Modules

Builds on Step 0's architecture. New ports: `AudioPlayer`, `MasteryRepository`, `CorpusRepository`, `Random`.

### Domain — `src/core/domain/`

**`tones.ts`** (extends Step 0). Add:
- `type Tone = 1 | 2 | 3 | 4 | 0;` (0 = neutral, optional in MVP)
- `type SyllableKey = string;` (pinyin without tone, e.g. `"ma"`)
- `type CorpusItem = { id: string; syllable: SyllableKey; tone: Tone; voice: VoiceId; url: string; }`

**`adaptive/mastery.ts`** — per-confusion-pair model. Not full IRT; a simple beta-binomial per `(played, perceived)`:

```ts
type ConfusionKey = `${Tone}->${Tone}`;  // played -> what user said
type Mastery = {
  identification: Record<ConfusionKey, { trials: number; correct: number }>;
  discrimination: Record<`${Tone}|${Tone}`, { trials: number; correct: number }>;
  updatedAt: number;
};

function posteriorAccuracy(m: { trials: number; correct: number }): number;
function weakestPair(mastery: Mastery): { tones: [Tone, Tone]; confidence: number };
function gatePassed(mastery: Mastery, threshold = 0.85, minTrials = 20): boolean;
```

**`adaptive/sampler.ts`** — selects the next item. Takes a `Random` port for testability with seeded RNGs:

```ts
function nextDiscriminationItem(corpus: CorpusItem[], mastery: Mastery, rng: Random): {
  a: CorpusItem;
  b: CorpusItem;
  isSame: boolean;
};
function nextIdentificationItem(corpus: CorpusItem[], mastery: Mastery, rng: Random): CorpusItem;
```

Sampling policy for MVP:
- 70% of items target the **weakest pair** (lowest posterior accuracy with ≥ 5 trials).
- 20% random across all pairs (keep the model honest; avoid over-fitting to one confusion).
- 10% the user's **strongest pair** (confirm retention).

Always vary **voice** between trials so the user can't memorise speaker artifacts.

### Ports — `src/core/ports/`

New for this phase:

**`driven/AudioPlayer.ts`**

```ts
interface AudioPlayer {
  play(url: string): Promise<void>;                       // resolves on playback end
  playSequence(urls: string[], gapMs: number): Promise<void>;
  stop(): void;
}
```

**`driven/MasteryRepository.ts`**

```ts
interface MasteryRepository {
  load(): Promise<Mastery>;                               // returns empty mastery if absent
  save(m: Mastery): Promise<void>;
  appendTrial(t: TrialRecord): Promise<void>;             // append-only log; mined later for Step 3
}
```

**`driven/CorpusRepository.ts`**

```ts
interface CorpusRepository {
  load(): Promise<CorpusItem[]>;                          // bundled JSON manifest + audio URLs
}
```

**`driven/Random.ts`** — `next(): number` in `[0, 1)`. Seedable adapter for tests.

**`driving/EarTrainingSession.ts`** — use case API:

```ts
type Mode = 'discrimination' | 'identification';

interface EarTrainingSession {
  start(mode: Mode): Promise<void>;
  current(): CurrentItem | null;
  replay(): void;
  answer(choice: Choice): Promise<void>;                  // records trial, updates mastery, advances
  stats(): SessionStats;
  end(): Promise<SessionSummary>;
  gateToStep2Unlocked(): boolean;
}
```

### Use case — `src/core/usecases/earTrainingSession.ts`

Implements `EarTrainingSession`. Constructor takes `AudioPlayer`, `MasteryRepository`, `CorpusRepository`, `Clock`, `Random`. Loads corpus on `start`, loads mastery, picks the first item via `sampler.next*`, plays through `AudioPlayer`. `answer` updates the per-confusion-pair beta-binomial, appends a `TrialRecord` for later diagnostic mining, persists mastery on `end`.

### Driven adapters

| Path | Implements | Notes |
|---|---|---|
| `src/adapters/driven/webaudio/audioPlayer.ts` | `AudioPlayer` | `HTMLAudioElement` or `AudioBufferSourceNode` (decide on the spike — buffer source gives precise gap timing). |
| `src/adapters/driven/indexeddb/masteryRepository.ts` | `MasteryRepository` | Two stores: a single-row `mastery` and an append-only `trials` log. |
| `src/adapters/driven/static/corpusRepository.ts` | `CorpusRepository` | Loads `assets/corpus/manifest.json` and resolves clip URLs relative to it. |
| `src/adapters/driven/system/random.ts` | `Random` | `Math.random()` in prod; `mulberry32(seed)` in tests. |

---

## Hooks

Live in `src/adapters/driving/react/hooks/`. Receive ports and the `EarTrainingSession` use case from the React container; never import adapters directly.

### `useCorpus()`
Loads and caches the corpus index (JSON manifest + audio URLs). Returns `{ corpus, status }`.

### `useEarTraining(mode: 'discrimination' | 'identification')`
The headless engine for a session.

```ts
{
  current: CurrentItem | null,         // what to play / what buttons mean
  isPlaying: boolean,
  replay: () => void,
  answer: (choice: Choice) => void,    // records, updates mastery, advances
  sessionStats: { trials: number; correct: number; perPair: ... },
  gateToStep2Unlocked: boolean,
}
```

Internals: holds session-local mastery deltas, flushes to IndexedDB on session end (and on unmount, debounced).

---

## Components

Live in `src/adapters/driving/react/`. Consume hooks; never import from `core/` or `adapters/driven/`.

- `routes/EarTraining.tsx` — the drill picker and gate status.
- `routes/Discrimination.tsx` — drill screen for discrimination.
- `routes/Identification.tsx` — drill screen for identification.
- `components/ToneButtons.tsx` — four (or five) big tappable tone buttons with the tone diacritic and a tiny shape glyph (→ ↗ ↘↗ ↘).
- `components/SameDifferentButtons.tsx`
- `components/MasteryDial.tsx` — a small donut showing per-tone-pair confidence; reused on the picker.
- `components/FeedbackFlash.tsx` — the ✓/✗ flash; intentionally minimal.

---

## Corpus

This is the load-bearing decision for the phase. Options:

**Option A — Bundle a small curated CC-licensed corpus.**
- Source candidates: [Forvo](https://forvo.com/) (mixed licenses, manual curation needed), [Tatoeba](https://tatoeba.org/), [OpenSLR](https://www.openslr.org/) (e.g., AISHELL but it's sentences not syllables), [MDBG](https://www.mdbg.net/) audio.
- Scope: ~50 high-frequency syllables × 4 tones × 3 voices = ~600 clips. ~30–60 MB.
- Pro: real native voices, attaches the skill to real human variation.
- Con: licensing legwork; finding clean per-syllable audio at scale is annoying.

**Option B — Generate with TTS, offline.**
- Run a small TTS model in the browser via ONNX-Web (e.g., Kokoro, or a Mandarin-capable Piper voice).
- Pro: zero licensing, unlimited variation, can generate on the fly.
- Con: TTS voices may not produce the cleanly distinguishable tones we need for *perception training* — risk of training the ear on a TTS artifact, not on real Mandarin.

**Option C — TTS bootstrap, replace with real audio as we go.**
- Ship MVP with TTS-generated audio (probably Piper); add a "real voices" toggle once we've curated some.

**Recommendation:** Option A. The whole point of this step is exposing the ear to real human variation. TTS for perception drills risks teaching the wrong distinctions. Spend the legwork.

If A is too slow to bootstrap, fall back to C — but flag clearly in the UI that you're hearing synthetic audio.

---

## Acceptance criteria

- [ ] Both drill types are playable end to end on a clean install (post-calibration).
- [ ] At least 3 distinct voices per syllable.
- [ ] Sampler verifiably biases toward the weakest pair (assert in a unit test with a seeded RNG).
- [ ] Mastery persists across reloads.
- [ ] Gate to Step 2 unlocks when identification accuracy on every adjacent pair ≥ 85% over the last 20 trials.
- [ ] No score-as-percentage shown to the user; only mastery dials and item flashes.
- [ ] Replay is one tap.

---

## Out of scope

- Per-voice or per-region difficulty modelling.
- Full IRT or Bayesian knowledge tracing.
- Explanatory feedback ("you're confusing T2 and T3 specifically"). That's Step 3 territory; we just need the data trail in `logTrial` to support it later.
- Sandhi-aware items (Step 5).

---

## Open questions

- **Threshold of 85% / 20 trials** — does that gate let people through too easily? Too slow? We won't know until we use it. Plan to make it adjustable in dev.
- **Neutral tone (T0)** — include in MVP or skip? Skip in MVP; add when we reach Step 5.
- **Inter-stimulus gap** in discrimination — 500ms? 700ms? Short enough that the comparison is immediate, long enough that it isn't a single percept. Default 600ms, expose a dev slider.
