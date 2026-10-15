#!/usr/bin/env bash
# Render build script — installs Python deps + research upstream checkouts.
# Runs from Backend/ (rootDir in render.yaml); repo root is one level up.
set -euo pipefail

echo "=== Installing Python dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

# ── Research upstream ────────────────────────────────────────────────────────
REPO_ROOT="$(cd .. && pwd)"
UPSTREAM="$REPO_ROOT/.research-upstream"
mkdir -p "$UPSTREAM"

# ── tau-bench ────────────────────────────────────────────────────────────────
TAU_DIR="$UPSTREAM/tau-bench"
if [ ! -f "$TAU_DIR/.venv/bin/tau2" ]; then
  echo "=== Installing tau-bench ==="
  rm -rf "$TAU_DIR"
  git clone --no-local https://github.com/sierra-research/tau2-bench.git "$TAU_DIR"
  cd "$TAU_DIR"
  git checkout 4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699
  python -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -e ".[tool,voice]" --quiet
  cd -
  echo "tau-bench installed: $(.venv/bin/tau2 --version 2>/dev/null || echo ok)"
else
  echo "=== tau-bench already installed, skipping ==="
fi

# ── AgentRx (main checkout) ──────────────────────────────────────────────────
ARX_DIR="$UPSTREAM/AgentRx"
if [ ! -f "$ARX_DIR/.venv/bin/python" ]; then
  echo "=== Installing AgentRx ==="
  rm -rf "$ARX_DIR"
  git clone --no-local https://github.com/microsoft/AgentRx.git "$ARX_DIR"
  cd "$ARX_DIR"
  git checkout 7a18c79708e7671be15124460f4f7296107c2a55
  python -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt --quiet
  cd -
  echo "AgentRx installed"
else
  echo "=== AgentRx already installed, skipping ==="
fi

# ── AgentRx clean checkout (for agentrx-full run) ───────────────────────────
ARX_CLEAN="$UPSTREAM/AgentRx-clean-20261009"
if [ ! -f "$ARX_CLEAN/run.py" ]; then
  echo "=== Creating clean AgentRx checkout ==="
  rm -rf "$ARX_CLEAN"
  git clone --no-local https://github.com/microsoft/AgentRx.git "$ARX_CLEAN"
  cd "$ARX_CLEAN"
  git checkout 7a18c79708e7671be15124460f4f7296107c2a55
  cd -
  echo "AgentRx clean checkout ready"
else
  echo "=== AgentRx clean checkout already present, skipping ==="
fi

echo "=== Build complete ==="
