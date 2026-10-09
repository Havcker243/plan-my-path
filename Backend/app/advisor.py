"""Gemini-backed academic planning agent, compatible with the advisor SSE route."""
from __future__ import annotations

import os
from pathlib import Path

from app.agent.runtime import run_agent
from app.agent.tools import PlanningTools

DEFAULT_MODEL = "gemini-3.6-flash"
_client = None


def _get_env_value(key: str, default: str | None = None) -> str | None:
    if os.environ.get(key):
        return os.environ[key]
    path = Path(__file__).resolve().parents[1] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == key:
                return value.strip().strip("'\"") or default
    return default


def _get_client():
    global _client
    if _client is None:
        from google import genai
        from google.genai import types

        key = _get_env_value("GEMINI_API_KEY") or _get_env_value("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("Set GEMINI_API_KEY in Backend/.env to enable the planning agent.")
        _client = genai.Client(api_key=key, http_options=types.HttpOptions(
            timeout=60000, retry_options=types.HttpRetryOptions(attempts=3)))
    return _client


def stream_advisor_reply(message: str, toolset: PlanningTools, history: list[dict] | None = None):
    try:
        yield from run_agent(_get_client(), _get_env_value("GEMINI_MODEL", DEFAULT_MODEL),
                             message, history or [], toolset)
    except Exception:
        yield {"agent_trace": toolset.state.trace()}
        raise
