set shell := ["bash", "-cu"]

COSYVOICE_DIR := "third_party/CosyVoice"
IMAGE         := "ghcr.io/nymann/mockingbird"
TAG           := `git rev-parse --short HEAD`

# Show the available recipes
default:
    @just --list

# Spin everything up: node deps + audio corpus (Edge TTS) + dev server
dev: _check-uv _check-node _ensure-node-deps _ensure-corpus
    npm run dev

test:
    npm test

typecheck:
    npm run typecheck

build:
    npm run build

# Typecheck + tests + production build
check: typecheck test build

# ──── Audio corpus ────

# Regenerate corpus with Edge TTS (no GPU, ~2 min, replaces existing audio)
corpus-edge: _check-uv
    uv run --with edge-tts scripts/generate_corpus.py --backend edge
    @echo "✓ Wrote public/audio/manifest.json"

# Clone CosyVoice + install its deps into a uv-managed venv. Run once.
cosyvoice-install: _check-uv
    @test -d {{ COSYVOICE_DIR }} || git clone --recursive https://github.com/FunAudioLLM/CosyVoice {{ COSYVOICE_DIR }}
    uv venv --python 3.10
    uv pip install -r {{ COSYVOICE_DIR }}/requirements.txt modelscope
    @echo
    @echo "Next:"
    @echo "  1. uv run modelscope download --model iic/CosyVoice2-0.5B"
    @echo "  2. drop reference clips into scripts/references/ (see scripts/README.md)"

# Regenerate corpus with CosyVoice 3 (best quality, needs GPU + setup above)
corpus-cosyvoice: _check-uv _check-cosyvoice
    PYTHONPATH=$(pwd)/{{ COSYVOICE_DIR }} uv run scripts/generate_corpus.py --backend cosyvoice
    @echo "✓ Wrote public/audio/manifest.json"

# Wipe generated audio + manifest (forces synthetic fallback in the app)
corpus-clean:
    rm -rf public/audio/*.mp3 public/audio/*.wav public/audio/manifest.json
    @echo "Cleared corpus."

# ──── Docker image ────

# Build the production image. Requires the audio corpus to exist locally.
image-build:
    @test -f public/audio/manifest.json || { echo "Missing audio corpus. Run 'just corpus-edge' first."; exit 1; }
    docker build -t {{IMAGE}}:{{TAG}} -t {{IMAGE}}:latest .

# Push to the registry. Run `docker login ghcr.io` first.
image-push: image-build
    docker push {{IMAGE}}:{{TAG}}
    docker push {{IMAGE}}:latest

# ──── Internal preflight checks ────

_check-uv:
    @command -v uv >/dev/null 2>&1 || { echo "uv not installed. → https://docs.astral.sh/uv/"; exit 1; }

_check-node:
    @command -v node >/dev/null 2>&1 || { echo "node not installed."; exit 1; }
    @command -v npm  >/dev/null 2>&1 || { echo "npm not installed."; exit 1; }

_ensure-node-deps:
    @if [ ! -d node_modules ]; then echo "→ Installing node deps..."; npm install; fi

_ensure-corpus:
    @if [ ! -f public/audio/manifest.json ]; then \
        echo "→ No audio corpus found — generating with Edge TTS (~2 min)..."; \
        just corpus-edge; \
    fi

_check-cosyvoice:
    @test -d {{ COSYVOICE_DIR }} || { echo "Run 'just cosyvoice-install' first."; exit 1; }
    @test -f scripts/references/v1.wav || { echo "Missing reference clips. See scripts/README.md"; exit 1; }
