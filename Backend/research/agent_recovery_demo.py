"""Use Gemini to localize a hidden synthetic fault, then apply graph recovery."""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from google.genai import types
from pydantic import BaseModel, Field

from app.advisor import DEFAULT_MODEL, _get_client, _get_env_value
from research.benchmark import experiment


class Diagnosis(BaseModel):
    source_step_id: str = Field(description="ID of the earliest faulty step in the supplied trace")
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(description="Brief evidence-based reason for selecting the step")


def gemini_locator(observation: dict, model: str | None = None) -> dict:
    configured = model or _get_env_value("GEMINI_MODEL", DEFAULT_MODEL)
    response = _get_client().models.generate_content(
        model=configured,
        contents=json.dumps(observation, sort_keys=True),
        config=types.GenerateContentConfig(
            system_instruction=(
                "You diagnose a failed tool-using agent from observable execution evidence. "
                "Select the earliest step whose output is inconsistent with its recorded inputs "
                "and causally explains the final validator violation. Do not assume the final "
                "validator is the source merely because it exposes the failure."
            ),
            response_mime_type="application/json",
            response_schema=Diagnosis,
            temperature=0,
            max_output_tokens=512,
        ),
    )
    diagnosis = response.parsed
    if not isinstance(diagnosis, Diagnosis):
        diagnosis = Diagnosis.model_validate_json(response.text or "")
    usage = response.usage_metadata
    result = diagnosis.model_dump()
    result["usage"] = {
        "model_calls": 1,
        "input_tokens": getattr(usage, "prompt_token_count", 0) or 0,
        "output_tokens": getattr(usage, "candidates_token_count", 0) or 0,
        "thought_tokens": getattr(usage, "thoughts_token_count", 0) or 0,
    }
    return result


def safe_provider_error(exc: Exception) -> dict:
    message = str(exc)
    message = re.sub(r"AIza[0-9A-Za-z_-]+", "[REDACTED_API_KEY]", message)
    message = re.sub(
        r"(?i)(authorization|api[_-]?key|token)(\s*[:=]\s*)[^\s,}&]+",
        r"\1\2[REDACTED]",
        message,
    )
    return {
        "error_type": type(exc).__name__,
        "provider_code": getattr(exc, "code", None),
        "provider_status": getattr(exc, "status", None),
        "provider_message": message[:600],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--delay-seconds", type=float, default=10)
    parser.add_argument("--output", default="../logs/agent-recovery-runs.json")
    parser.add_argument("--model")
    args = parser.parse_args()
    if not 1 <= args.runs <= 20:
        parser.error("--runs must be between 1 and 20")
    configured = args.model or _get_env_value("GEMINI_MODEL", DEFAULT_MODEL)
    rows = []
    for index in range(args.runs):
        try:
            result = experiment(
                "agent_selective",
                locator=lambda observation: gemini_locator(observation, configured),
            )
            result["run"] = index + 1
            result["provider_error"] = None
        except Exception as exc:
            result = {
                "run": index + 1,
                "strategy": "agent_selective",
                "success": False,
                "provider_error": safe_provider_error(exc),
            }
        rows.append(result)
        print(
            f"Run {index + 1}: recovery={result.get('success')}, "
            f"exact_source={result.get('exact_source_accuracy')}, "
            f"prediction={result.get('predicted_source_step')}, "
            f"error={(result.get('provider_error') or {}).get('provider_status')}",
            flush=True,
        )
        if index + 1 < args.runs and args.delay_seconds:
            time.sleep(args.delay_seconds)
    completed = [row for row in rows if not row.get("provider_error")]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "synthetic": True,
        "agent_in_loop": True,
        "model": configured,
        "attempted_runs": len(rows),
        "completed_runs": len(completed),
        "recovery_successes": sum(bool(row.get("success")) for row in completed),
        "exact_source_matches": sum(bool(row.get("exact_source_accuracy")) for row in completed),
        "limitations": "One controlled synthetic fault. Results measure a smoke test, not general recovery effectiveness.",
        "results": rows,
    }, indent=2), encoding="utf-8")
    print(f"Results: {output.resolve()}")
    if len(completed) != len(rows) or not all(row.get("success") for row in completed):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
