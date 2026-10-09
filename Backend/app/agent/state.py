"""Per-run dependency graph. Only successful, still-valid results are reused."""
from __future__ import annotations

import copy
import hashlib
import json
import time
import uuid
from dataclasses import asdict, dataclass
from typing import Any, Callable


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


@dataclass
class Step:
    id: str
    name: str
    inputs: dict
    dependencies: list[str]
    output: Any
    status: str
    elapsed_ms: float
    error: str | None = None


class RunState:
    def __init__(self):
        self.run_id = str(uuid.uuid4())
        self.steps: list[Step] = []
        self.cache: dict[str, str] = {}
        self.events: list[dict] = []
        self.started = time.monotonic()
        self.usage = {"model_calls": 0, "input_tokens": 0, "output_tokens": 0, "thought_tokens": 0}

    def step(self, step_id: str) -> Step:
        return next(s for s in self.steps if s.id == step_id)

    def execute(self, name: str, inputs: dict, dependencies: list[str], fn: Callable[[], Any]):
        if any(self.step(dep).status != "ok" for dep in dependencies):
            raise ValueError("Cannot execute against invalid dependencies")
        key = digest([name, inputs, dependencies])
        cached = self.cache.get(key)
        if cached and self.step(cached).status == "ok":
            self.events.append({"event": "reuse", "step_id": cached})
            return copy.deepcopy(self.step(cached).output), cached
        start = time.monotonic()
        step = Step(str(len(self.steps) + 1), name, copy.deepcopy(inputs), list(dependencies), None, "running", 0)
        self.steps.append(step)
        try:
            output = fn()
            step.output = copy.deepcopy(output)
            step.status = "ok"
            self.cache[key] = step.id
            return copy.deepcopy(output), step.id
        except Exception as exc:
            step.status = "error"
            step.error = type(exc).__name__
            raise
        finally:
            step.elapsed_ms = round((time.monotonic() - start) * 1000, 2)

    def invalidate(self, source_ids: list[str], reason: str) -> list[str]:
        for source_id in source_ids:
            self.step(source_id)
        affected = set(source_ids)
        for step in self.steps:
            if any(dep in affected for dep in step.dependencies):
                affected.add(step.id)
        for step in self.steps:
            if step.id in affected:
                step.status = "invalidated"
        self.events.append({"event": "invalidate", "sources": source_ids, "affected": sorted(affected), "reason": reason})
        return sorted(affected)

    def trace(self, include_data: bool = False) -> dict:
        steps = []
        for step in self.steps:
            row = asdict(step)
            if not include_data:
                row["inputs"] = {"sha256": digest(step.inputs)}
                row["output"] = {"sha256": digest(step.output)}
            steps.append(row)
        return {
            "run_id": self.run_id, "steps": steps, "events": self.events,
            "usage": self.usage, "elapsed_ms": round((time.monotonic() - self.started) * 1000, 2),
        }
