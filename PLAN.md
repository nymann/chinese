# Mockingbird — Build Plan

Implementation plan for the tone trainer described in [IDEA.md](IDEA.md). Wider toolkit context in [VISION.md](VISION.md).

We build in phases. Each phase ships a usable slice of the product; later phases build on the modules of the earlier ones.

---

## Stack

- **Build tool:** Vite
- **UI:** React 18 + TypeScript
- **Audio:** Web Audio API (`AudioContext`, `AudioWorklet` for low-latency capture), [Pitchy](https://github.com/ianprime0509/pitchy) (YIN-based F0 detection) for the MVP; ONNX-Web + CREPE-tiny as a later upgrade if Pitchy isn't accurate enough on noisy mics
- **Rendering:** `<canvas>` (2D) for the real-time pitch line; React for everything else
- **Persistence:** IndexedDB (via [idb](https://github.com/jakearchibald/idb)) for calibration, mastery, drill history
- **Styling:** Tailwind CSS (utility-first, fast to iterate, easy to throw away)
- **Testing:** Vitest + React Testing Library; pure modules tested with Vitest alone
- **Deploy:** any static host (Cloudflare Pages / Vercel / Netlify). No server.

No backend, no auth, no analytics in the MVP. Everything is local to the browser. A user nukes their progress by clearing site data — that's fine for now.

---

## Architecture

Two architectural seams, stacked, both about isolating change.

### Seam 1 — Hexagonal (domain ↔ infrastructure)

Pure domain at the centre. Use cases compose the domain with **driven ports** (interfaces the domain declares). Real I/O lives in **adapters** that implement those ports. Outside callers — React, future CLI, tests — call **driving ports** (use case APIs).

- **Driving side** (left): React hooks today; a Node CLI or Tauri shell tomorrow.
- **Driven side** (right): WebAudio mic, Pitchy detector, IndexedDB repos, the static corpus, the system clock, a seedable RNG.
- **Composition root** (`src/composition/container.ts`) is the only place adapters meet ports — it instantiates adapters, hands them to use cases, exposes the use cases via React context. Tests build their own container with fakes.

Direction of dependency is one-way: `adapters/ → core/ports/ → core/{domain,usecases}/`. The domain never imports from `adapters/`.

### Seam 2 — Headless components (inside the React adapter)

Within the React driving adapter, logic lives in **hooks** (headless components) and rendering lives in **presentational JSX**. Components consume hooks; components don't own scoring, drill state, or audio. Reference: [Headless Component pattern (Juntao Qiu)](https://martinfowler.com/articles/headless-component.html).

- A drill screen calls `useEarTraining()` and renders. The hook owns scoring and adaptation by delegating to the `EarTrainingSession` use case.
- A pitch-mirror screen calls `usePitchMirror(target)` and renders the returned stream.

If a component imports `useState` to track drill scoring, that's a smell — push it into a hook. If a hook imports `Pitchy` directly, that's a smell — push it behind the `PitchDetector` port.

---

## Module layout

```
src/
  core/                                  # pure — no I/O, no React, no DOM
    domain/
      tones.ts                           # canonical shapes, log-Hz normalization
      calibration.ts                     # estimateRange()
      scoring.ts                         # DTW shape comparison
      adaptive/
        mastery.ts                       # beta-binomial per confusion pair
        sampler.ts                       # next-item selection
        rotation.ts                      # anti-camping (Step 2)
    ports/
      driven/                            # interfaces the use cases depend on
        Microphone.ts
        PitchDetector.ts
        AudioPlayer.ts
        CalibrationRepository.ts
        MasteryRepository.ts
        CorpusRepository.ts
        Clock.ts
        Random.ts
      driving/                           # use case APIs the UI calls
        CalibrationService.ts
        EarTrainingSession.ts
        PitchMirrorSession.ts
    usecases/                            # implement driving ports; compose domain + driven ports
      calibrationService.ts
      earTrainingSession.ts
      pitchMirrorSession.ts
  adapters/
    driven/
      webaudio/
        microphone.ts                    # implements Microphone
        audioPlayer.ts                   # implements AudioPlayer
        pitch-worklet.ts                 # AudioWorklet processor
      pitchy/
        pitchDetector.ts                 # implements PitchDetector
      indexeddb/
        calibrationRepository.ts
        masteryRepository.ts
      static/
        corpusRepository.ts              # bundled JSON + audio files
      system/
        clock.ts
        random.ts
    driving/
      react/
        hooks/                           # headless: logic + state
          useMicrophone.ts
          usePitchStream.ts
          useCalibration.ts
          useEarTraining.ts
          usePitchMirror.ts
        components/                      # presentational JSX
          PitchChart.tsx
          ToneButtons.tsx
          MicIndicator.tsx
        routes/                          # screens, one per phase
          Calibrate.tsx
          EarTraining.tsx
          PitchMirror.tsx
  composition/
    container.ts                         # wires adapters → use cases
    ReactContainer.tsx                   # React context provider over the container
  assets/
    corpus/                              # bundled native audio (Step 1)
  main.tsx
  App.tsx
```

---

## Phases

Each phase has its own plan file with detail.

| Phase | Step | Plan | Ships |
|-------|------|------|-------|
| **1 (MVP)** | Step 0 — Calibrate | [plans/step-0-calibrate.md](plans/step-0-calibrate.md) | Pitch range estimation, persisted |
| **2 (MVP)** | Step 1 — Ear training | [plans/step-1-ear-training.md](plans/step-1-ear-training.md) | Discrimination + identification drills with adaptive item selection |
| **3 (MVP)** | Step 2 — Pitch mirror | [plans/step-2-pitch-mirror.md](plans/step-2-pitch-mirror.md) | Real-time pitch line vs. ghost target, auto-rotation |
| 4 | Step 3 — Diagnostic coaching | *(sketch)* | Named-fault feedback. Biggest ML lift; planned after MVP usage data exists. |
| 5 | Step 4 — Meaning, with consequences | *(sketch)* | Word + character + visual consequence on error. |
| 6 | Step 5 — Tone pairs | *(sketch)* | 20-cell pair matrix, sandhi via imitation. |
| 7 | Step 6 — Phrases / shadowing | *(sketch)* | Sentence-level audio + intelligibility scoring. |
| 8 | Step 7 — Maintenance | *(sketch)* | Spaced review across everything above. |

The MVP is Phases 1–3. We don't plan beyond that in detail until we've used the MVP for real practice and can see what's actually missing.

---

## Conventions

- **TypeScript strict mode.** No `any` in `core/` or `adapters/driven/`.
- **`core/` never imports from `adapters/`.** If domain needs a clock, take a `Clock` port as an argument.
- **Hooks never instantiate adapters.** They receive use cases from the React container.
- **Components don't import from `core/` or `adapters/`.** They consume hooks.
- **Pure modules first.** A function that takes audio in and returns analysis out doesn't touch React.
- **No premature abstraction.** We don't need a generic `<Drill>` component until we have two concrete drills working.
- **Tests follow the seam.** Domain → Vitest (no mocks; pass fake ports as args). Use cases → Vitest with fake driven adapters. Hooks → React Testing Library + a `SimpleX` test component (per the headless pattern).
- **Pitch is log-Hz.** Always normalize to log scale before comparing or visualizing. Linear Hz is a trap for relative-pitch reasoning.

---

## Open questions to decide before Phase 1

- **Native audio corpus for Step 1.** Easiest options: (a) bundle a small CC-licensed corpus (Forvo, Tatoeba, OpenSLR), (b) generate with a TTS model. Decide in [plans/step-1-ear-training.md](plans/step-1-ear-training.md).
- **AudioWorklet vs. ScriptProcessor.** Worklet is the right call for latency but adds bundling complexity with Vite. Decide while spiking Step 0.
- **Tailwind vs. plain CSS.** Tailwind is the default above; happy to drop it if you'd rather hand-roll.
