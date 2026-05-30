# Corpus generation

Generates the ear-training audio corpus and a manifest the browser app
consumes. Managed by `uv` — no manual venv juggling.

The app falls back to a synthetic WebAudio corpus when the manifest
isn't present, so this step is optional — but the drill is meaningful
only with real Mandarin audio.

## Quick start

```bash
just dev
```

That's it. The `dev` recipe:
1. Confirms `uv` and `node` are installed.
2. Runs `npm install` if `node_modules/` is missing.
3. Generates the corpus with Edge TTS if `public/audio/manifest.json` is missing.
4. Starts the Vite dev server.

## Edge TTS backend (default)

Free, fixed Microsoft neural voices, runs anywhere. ~2 minutes for the
current 12-syllable list (144 clips).

```bash
just corpus-edge
```

Under the hood: `uv run --with edge-tts scripts/generate_corpus.py --backend edge`.
No venv to manage — uv spins up an ephemeral env for the run.

## CosyVoice 3 backend (best quality, needs a GPU)

Alibaba's open Mandarin TTS — Chinese CER 0.81%, speaker similarity
78% (above the human reference of 75.5%). Zero-shot voice cloning, so
you pick the speakers.

### 1. Install

```bash
just cosyvoice-install
```

This clones CosyVoice to `third_party/CosyVoice` and installs its
`requirements.txt` plus `modelscope` into a uv-managed `.venv/`.

### 2. Download the model weights

```bash
uv run modelscope download --model iic/CosyVoice2-0.5B
```

### 3. Provide three reference WAVs

CosyVoice clones the voice of whatever speaker you give it. You need
**three** ~5-second reference clips of clean Mandarin speech, plus the
exact transcript of each clip (already in `scripts/syllables.json`
under `voices`).

Place them at:

```
scripts/references/v1.wav   # transcript: "今天天气真好，我们一起去公园散步吧。"
scripts/references/v2.wav   # transcript: "学习中文需要不断练习，特别是声调。"
scripts/references/v3.wav   # transcript: "你好，很高兴认识你，请多多指教。"
```

Sources for clips:
- **Mozilla Common Voice (zh-CN)** — CC-0, thousands of native speakers
- **AISHELL-3** — academic dataset, well-curated
- Record three native speakers yourself reading the lines above

If you change the reference transcripts, update
`voices[*].reference_text` in `scripts/syllables.json` to match.

### 4. Generate

```bash
just corpus-cosyvoice
```

~1–2 seconds per clip on a 4090; the full 12 × 4 × 3 batch finishes in
~5 minutes.

## Output

- `public/audio/{pinyin}-{tone}-{voice}.{mp3,wav}`
- `public/audio/manifest.json` — the browser fetches this on startup

Both are gitignored by default.

## Expanding the syllable list

Edit `scripts/syllables.json`. Each entry needs `pinyin` and the
character for each of the four tones. Add a few hundred — the bundle
stays trivial.
