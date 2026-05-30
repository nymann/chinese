#!/usr/bin/env python3
"""Generate the ear-training audio corpus.

Reads scripts/syllables.json and emits one audio file per
(syllable, tone, voice) combination plus a manifest.json the
browser corpus repository reads.

Two backends:
  - cosyvoice (default): Alibaba CosyVoice2/3 with zero-shot voice
    cloning from reference WAVs in scripts/references/. Best quality.
    Requires a GPU and the CosyVoice repo installed.
  - edge: Microsoft Edge TTS via the `edge-tts` package. CPU-only,
    one pip install, quality is good but voices are fixed.

Usage:
    # Edge TTS (5-minute start, no GPU needed)
    pip install edge-tts
    python scripts/generate_corpus.py --backend edge

    # CosyVoice 3 (best quality, needs GPU + reference clips)
    pip install modelscope torchaudio
    git clone https://github.com/FunAudioLLM/CosyVoice
    # ... see scripts/README.md
    python scripts/generate_corpus.py --backend cosyvoice
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SYLLABLES_PATH = ROOT / "scripts" / "syllables.json"
OUT_DIR = ROOT / "public" / "audio"
MANIFEST_PATH = OUT_DIR / "manifest.json"

PINYIN_TONE_MARKS = {
    ("a", 1): "ā", ("a", 2): "á", ("a", 3): "ǎ", ("a", 4): "à",
    ("o", 1): "ō", ("o", 2): "ó", ("o", 3): "ǒ", ("o", 4): "ò",
    ("e", 1): "ē", ("e", 2): "é", ("e", 3): "ě", ("e", 4): "è",
    ("i", 1): "ī", ("i", 2): "í", ("i", 3): "ǐ", ("i", 4): "ì",
    ("u", 1): "ū", ("u", 2): "ú", ("u", 3): "ǔ", ("u", 4): "ù",
}

EDGE_VOICES = {
    "v1": "zh-CN-XiaoxiaoNeural",
    "v2": "zh-CN-YunxiNeural",
    "v3": "zh-CN-YunjianNeural",
}

# Carrier phrase wraps the target character so TTS produces natural
# sentence prosody. {X} is sentence-final to keep the target tone
# clearly articulated, and the preceding 说 (T1) shields against
# sandhi colouring the target.
DEFAULT_CARRIER = "请说{X}。"


def mark(pinyin: str, tone: int) -> str:
    """Attach the tone mark to the correct vowel of a pinyin syllable."""
    priority = ["a", "o", "e", "i", "u"]
    for v in priority:
        if v in pinyin:
            return pinyin.replace(v, PINYIN_TONE_MARKS[(v, tone)], 1)
    return pinyin


def load_spec() -> dict:
    return json.loads(SYLLABLES_PATH.read_text())


def write_manifest(items: list[dict]) -> None:
    MANIFEST_PATH.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2))


# ─── Edge TTS backend ───────────────────────────────────────────────

async def run_edge(spec: dict, carrier: str) -> list[dict]:
    import edge_tts  # type: ignore

    items: list[dict] = []
    for syl in spec["syllables"]:
        pinyin = syl["pinyin"]
        for tone_str, char in syl["tones"].items():
            tone = int(tone_str)
            text = carrier.format(X=char)
            for voice_id, edge_voice in EDGE_VOICES.items():
                out = OUT_DIR / f"{pinyin}-{tone}-{voice_id}.mp3"
                print(f"[edge] {pinyin}{tone} ({char}) → {voice_id}  «{text}»")
                tts = edge_tts.Communicate(text, edge_voice)
                await tts.save(str(out))
                items.append({
                    "id": f"{pinyin}-{tone}-{voice_id}",
                    "syllable": pinyin,
                    "tone": tone,
                    "voice": voice_id,
                    "character": char,
                    "url": f"/audio/{out.name}",
                })
    return items


# ─── CosyVoice backend ──────────────────────────────────────────────

def run_cosyvoice(spec: dict, carrier: str) -> list[dict]:
    try:
        import torchaudio  # type: ignore
        from cosyvoice.cli.cosyvoice import CosyVoice2  # type: ignore
        from cosyvoice.utils.file_utils import load_wav  # type: ignore
    except ImportError as e:
        sys.exit(
            f"CosyVoice import failed: {e}\n"
            "Install: see scripts/README.md → CosyVoice setup.\n"
            "Quick start: --backend edge"
        )

    cosy = CosyVoice2("iic/CosyVoice2-0.5B", load_jit=False, load_trt=False)
    voices_by_id = {v["id"]: v for v in spec["voices"]}

    # Pre-load reference clips
    prompts: dict[str, tuple] = {}
    for vid, v in voices_by_id.items():
        ref_path = ROOT / "scripts" / v["reference"]
        if not ref_path.exists():
            sys.exit(f"Missing reference clip: {ref_path}\nSee scripts/README.md")
        prompts[vid] = (load_wav(str(ref_path), 16000), v["reference_text"])

    items: list[dict] = []
    for syl in spec["syllables"]:
        pinyin = syl["pinyin"]
        for tone_str, char in syl["tones"].items():
            tone = int(tone_str)
            text = carrier.format(X=char)
            for vid, (prompt_audio, prompt_text) in prompts.items():
                out = OUT_DIR / f"{pinyin}-{tone}-{vid}.wav"
                print(f"[cosy] {pinyin}{tone} ({char}/{mark(pinyin, tone)}) → {vid}  «{text}»")
                results = list(cosy.inference_zero_shot(
                    text, prompt_text, prompt_audio, stream=False,
                ))
                if not results:
                    print(f"  ! no output for {pinyin}-{tone}-{vid}", file=sys.stderr)
                    continue
                torchaudio.save(str(out), results[0]["tts_speech"], cosy.sample_rate)
                items.append({
                    "id": f"{pinyin}-{tone}-{vid}",
                    "syllable": pinyin,
                    "tone": tone,
                    "voice": vid,
                    "character": char,
                    "url": f"/audio/{out.name}",
                })
    return items


# ─── main ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", choices=["edge", "cosyvoice"], default="cosyvoice")
    parser.add_argument(
        "--carrier",
        default=DEFAULT_CARRIER,
        help=(
            "Carrier phrase containing {X} as a placeholder for the target "
            f"character. Default: {DEFAULT_CARRIER!r}. "
            "Pass --carrier '{X}' to revert to bare-character clips."
        ),
    )
    args = parser.parse_args()

    if "{X}" not in args.carrier:
        sys.exit("--carrier must contain the {X} placeholder")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    spec = load_spec()

    if args.backend == "edge":
        items = asyncio.run(run_edge(spec, args.carrier))
    else:
        items = run_cosyvoice(spec, args.carrier)

    write_manifest(items)
    print(f"\nWrote {len(items)} clips and manifest to {OUT_DIR}")


if __name__ == "__main__":
    main()
