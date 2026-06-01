#!/usr/bin/env python3
"""Generate the single-syllable minimal-pair corpus for the discrimination
drill ("Same or different?"). One clip per (syllable, tone, voice).

Same Qwen3-TTS/MLX pipeline + guards/normalization as generate_words.py;
feeds the unambiguous character (e.g. 妈) so the tone is determined.
Emits public/audio/syllables-manifest.json (separate from the word manifest).

    .venv-tts/bin/python scripts/generate_syllables.py
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from mlx_audio.tts.utils import load_model

from generate_words import synth, trim, fade, normalize, MODEL

ROOT = Path(__file__).resolve().parent.parent
SYLLABLES_PATH = ROOT / "scripts" / "syllables.json"
VOICES_PATH = ROOT / "scripts" / "voices.json"
OUT_DIR = ROOT / "public" / "audio"
MANIFEST_PATH = OUT_DIR / "syllables-manifest.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", help="comma-separated voice ids; default all")
    ap.add_argument("--limit", type=int, help="only first N syllables (smoke test)")
    ap.add_argument(
        "--takes",
        type=int,
        default=2,
        help="distinct recordings per (syllable,tone,voice) so 'same' trials "
        "play two different clips of the same tone, not an identical one",
    )
    args = ap.parse_args()

    syllables = json.loads(SYLLABLES_PATH.read_text())["syllables"]
    voices = json.loads(VOICES_PATH.read_text())["voices"]
    if args.voices:
        keep = set(args.voices.split(","))
        voices = [v for v in voices if v["id"] in keep]
    if args.limit:
        syllables = syllables[: args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"loading {MODEL} ...", flush=True)
    model = load_model(MODEL)
    sr = model.sample_rate

    items: list[dict] = []
    for syl in syllables:
        pinyin = syl["pinyin"]
        for tone_str, char in syl["tones"].items():
            tone = int(tone_str)
            for v in voices:
                for take in range(args.takes):
                    a = normalize(fade(trim(synth(model, char, v["speaker"]), sr), sr))
                    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
                    name = f"{pinyin}-{tone}-{v['id']}-{take}.wav"
                    wavfile.write(str(OUT_DIR / name), sr, pcm)
                    items.append({
                        "id": f"{pinyin}-{tone}-{v['id']}-{take}",
                        "syllable": pinyin,
                        "tone": tone,
                        "character": char,
                        "voice": v["id"],
                        "take": take,
                        "url": f"/audio/{name}",
                    })
                    print(f"  {char} {pinyin}{tone} {v['id']:9} take{take} {len(a)/sr:.2f}s", flush=True)

    MANIFEST_PATH.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2))
    print(f"\nWrote {len(items)} syllable clips and manifest to {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
