# CLAUDE.md

Guide for Claude when working in this repo. Read this before editing code.

## What this is

**Mockingbird** — a Mandarin tone trainer (web app). It's the first tool in a wider toolkit described in [VISION.md](VISION.md). The product design is [IDEA.md](IDEA.md). The build plan is [PLAN.md](PLAN.md), with per-phase plans in [plans/](plans/).

MVP scope: Steps 0–2 (calibrate, ear training, pitch mirror). No backend, no auth, no analytics — everything runs in the browser, persisted to IndexedDB.

## Stack

- Vite + React 18 + TypeScript (strict)
- WebAudio API (AudioWorklet) + [Pitchy](https://github.com/ianprime0509/pitchy) for F0 detection
- `<canvas>` 2D for the real-time pitch line
- IndexedDB via [idb](https://github.com/jakearchibald/idb) for local persistence
- Tailwind CSS for styling
- Vitest + React Testing Library

## Architecture — two seams

Both seams exist to isolate change. Keep them clean.

### Seam 1 — Hexagonal (ports & adapters)

```
adapters/  →  core/ports/  →  core/{domain,usecases}/
   ▲                                 │
   │ implement                       │ define
   └─────────────────────────────────┘
```

- **`core/domain/`** — pure functions and types. Tone shapes, log-Hz normalization, DTW scoring, mastery/sampler/rotation. No I/O. No React. No DOM. No Date.now or Math.random.
- **`core/ports/driven/`** — interfaces the domain calls outward through: `Microphone`, `PitchDetector`, `AudioPlayer`, `CalibrationRepository`, `MasteryRepository`, `CorpusRepository`, `Clock`, `Random`.
- **`core/ports/driving/`** — use case APIs the outside world calls inward: `CalibrationService`, `EarTrainingSession`, `PitchMirrorSession`.
- **`core/usecases/`** — implementations of driving ports that compose domain with driven ports. The application's behaviour lives here.
- **`adapters/driven/`** — one folder per technology: `webaudio/`, `pitchy/`, `indexeddb/`, `static/`, `system/`. Each implements one or more driven ports.
- **`adapters/driving/react/`** — the React app. Hooks consume use cases (or ports directly, for thin wrappers like `useMicrophone`); components consume hooks.
- **`composition/container.ts`** — the *only* place adapters meet ports. Constructs adapters, hands them to use case factories, exposes use cases. `ReactContainer.tsx` wraps it in a React context. Tests build their own container with fake adapters.

**One-way dependency rule:** `core/` never imports from `adapters/` or `composition/`. If a domain function needs the current time, it takes a `Clock` argument — it does not call `Date.now()`.

### Seam 2 — Headless components (UI only)

Inside `adapters/driving/react/`, split logic from rendering. Reference: [Headless Component pattern (Juntao Qiu)](https://martinfowler.com/articles/headless-component.html).

- **Hooks** (`hooks/`) own state and lifecycle. They wrap a use case (or a port, for thin wrappers) for React's render model — subscribe, cleanup, expose stateful values.
- **Components** (`components/`, `routes/`) consume hooks. They're presentational: layout, copy, styling, event handlers that call hook-returned functions. They do not own audio, scoring, drill state, mastery, or rotation.

A `SimpleX.tsx` fake component drives each hook in tests, per the headless pattern.

## Rules — what to do / not do

✅ **Do:**
- Start with the domain. Write the pure function before the hook.
- Define a port as soon as the use case needs an external thing. Don't reach for `localStorage` from a use case.
- Pass `Clock` and `Random` as ports. Never call `Date.now()` or `Math.random()` in `core/`.
- Test domain code with synthetic input. No mocks needed.
- Test use cases with hand-written fake adapters (`InMemoryCalibrationRepository`, etc.).
- Test hooks with React Testing Library through a `SimpleX` driving component.
- Keep log-Hz for all pitch comparisons.

🚫 **Don't:**
- Import `pitchy` from a hook. → Use the `PitchDetector` port.
- Import `idb` from a use case. → Use the repository port.
- Put `useState` in a component to track drill state. → Move it into a hook.
- Add `try/catch` in a domain function for I/O it doesn't perform. → I/O failures live in adapters and surface through Result-style return types from use cases.
- Add features, abstractions, or "future-proofing" beyond what the current phase requires. Three similar lines beats a premature abstraction.
- Add backwards-compatibility shims for removed code. Just delete it.
- Add `// removed X` comments or rename unused vars to `_x`. Delete cleanly.
- Write comments that describe what the code does. Names do that. Comments are for the non-obvious *why* — a hidden constraint, a workaround, a subtle invariant.

## Smell checks

If any of these are true, the layering is off:

- A change touches files in three unrelated directories → bad seam.
- A test needs to mock something → the dependency should be a port, passed in.
- The same logic appears in two hooks → push it into `core/`.
- A domain test needs `vi.useFakeTimers()` → time should be a `Clock` port.
- A component file is over ~150 lines and most of it is `useState`/`useEffect` → the hook hasn't been extracted yet.

## Phase status

| Phase | Step | Status |
|-------|------|--------|
| 1 | Step 0 — Calibrate | planned (see [plans/step-0-calibrate.md](plans/step-0-calibrate.md)) |
| 2 | Step 1 — Ear training | planned (see [plans/step-1-ear-training.md](plans/step-1-ear-training.md)) |
| 3 | Step 2 — Pitch mirror | planned (see [plans/step-2-pitch-mirror.md](plans/step-2-pitch-mirror.md)) |
| 4–8 | Steps 3–7 | sketched in PLAN.md only |

No code has been written yet. Update this table when phases start/ship.

## When uncertain

- Read [PLAN.md](PLAN.md) for the canonical module layout.
- Read the relevant phase plan in [plans/](plans/) for that step's hook contracts, modules, and acceptance criteria.
- If the design genuinely doesn't fit, propose a change to the plan before coding around it.
