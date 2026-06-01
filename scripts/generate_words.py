#!/usr/bin/env python3
"""Generate the ear-training WORD corpus with Qwen3-TTS via mlx-audio.

Native Apple-Silicon (MLX) — no GPU, no reference clips (built-in voices).
Reads scripts/words.json and scripts/voices.json, emits one WAV per
(word, voice) into public/audio/ plus a word-format manifest.json.

Each clip is: clip-guarded generation (reject takes the model saturated),
silence-trimmed, edge-faded, and loudness-normalized to a shared target
under a true-peak ceiling so nothing clips and levels match across voices.

Run inside the tooling venv:
    .venv-tts/bin/python scripts/generate_words.py            # all voices
    .venv-tts/bin/python scripts/generate_words.py --voices vivian,uncle_fu
    .venv-tts/bin/python scripts/generate_words.py --limit 3  # smoke test
"""
from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from pypinyin import pinyin, Style
from mlx_audio.tts.utils import load_model

ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "scripts" / "words.json"
VOICES_PATH = ROOT / "scripts" / "voices.json"
OUT_DIR = ROOT / "public" / "audio"
MANIFEST_PATH = OUT_DIR / "manifest.json"

MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
RMS_TARGET = 0.12        # ~-18 dBFS RMS
PEAK_CEIL = 0.89         # -1 dBFS true-peak ceiling
TRIM_DB = 0.01           # silence gate for edge trimming
PAD_MS = 30
FADE_MS = 5
MAX_RETRIES = 4
MAX_DUR_S = 2.2          # reject rambling takes (a bisyllabic word is ~0.5-1.6s)


def slug(pinyin: str, tones: list[int]) -> str:
    ascii_ = unicodedata.normalize("NFD", pinyin)
    ascii_ = "".join(c for c in ascii_ if not unicodedata.combining(c))
    ascii_ = ascii_.replace("ü", "u").lower()
    ascii_ = "".join(c for c in ascii_ if c.isalnum())
    return f"{ascii_}-{''.join(str(t) for t in tones)}"


def trim(a: np.ndarray, sr: int) -> np.ndarray:
    loud = np.abs(a) > TRIM_DB
    if not loud.any():
        return a
    lo, hi = np.argmax(loud), len(loud) - np.argmax(loud[::-1])
    pad = int(PAD_MS / 1000 * sr)
    return a[max(0, lo - pad): min(len(a), hi + pad)]


def fade(a: np.ndarray, sr: int) -> np.ndarray:
    n = int(FADE_MS / 1000 * sr)
    if len(a) > 2 * n:
        ramp = np.linspace(0, 1, n)
        a[:n] *= ramp
        a[-n:] *= ramp[::-1]
    return a


def normalize(a: np.ndarray) -> np.ndarray:
    rms = float(np.sqrt(np.mean(a ** 2)))
    peak = float(np.abs(a).max())
    return a * min(RMS_TARGET / (rms + 1e-9), PEAK_CEIL / (peak + 1e-9))


def synth(model, text: str, speaker: str) -> np.ndarray:
    """Generate, rejecting takes the model clipped or rambled on."""
    max_len = MAX_DUR_S * model.sample_rate
    best = None
    for _ in range(MAX_RETRIES):
        a = np.concatenate([
            np.array(r.audio, copy=False)
            for r in model.generate(text=text, voice=speaker, lang_code="chinese")
        ]).astype(np.float64)
        if best is None or len(a) < len(best):
            best = a                       # keep shortest as the fallback
        if np.abs(a).max() < 0.999 and len(a) <= max_len:
            return a
    return best  # give up after retries; ship the least-bad (shortest) take


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", help="comma-separated voice ids; default all")
    ap.add_argument("--limit", type=int, help="only first N words (smoke test)")
    args = ap.parse_args()

    words = json.loads(WORDS_PATH.read_text())["words"]
    voices = json.loads(VOICES_PATH.read_text())["voices"]
    if args.voices:
        keep = set(args.voices.split(","))
        voices = [v for v in voices if v["id"] in keep]
    if args.limit:
        words = words[: args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"loading {MODEL} ...", flush=True)
    model = load_model(MODEL)
    sr = model.sample_rate

    items: list[dict] = []
    for w in words:
        sid = slug(w["pinyin"], w["tones"])
        for v in voices:
            a = synth(model, w["chars"], v["speaker"])
            a = normalize(fade(trim(a, sr), sr))
            pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
            name = f"{sid}-{v['id']}.wav"
            wavfile.write(str(OUT_DIR / name), sr, pcm)
            items.append({
                "id": f"{sid}-{v['id']}",
                "kind": "word",
                "word": w["chars"],
                "pinyin": w["pinyin"],
                "syllables": [s[0] for s in pinyin(w["chars"], style=Style.NORMAL)],
                "tones": w["tones"],
                "gloss": w["gloss"],
                "voice": v["id"],
                "url": f"/audio/{name}",
            })
            print(f"  {w['chars']:4} {sid:14} {v['id']:9} {len(a)/sr:.2f}s", flush=True)

    MANIFEST_PATH.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2))
    print(f"\nWrote {len(items)} clips ({len(words)} words x {len(voices)} voices) "
          f"and manifest to {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
