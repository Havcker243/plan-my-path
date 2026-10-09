"""A deterministic delayed-error demonstration, not a model-quality benchmark."""
from __future__ import annotations

import argparse
import json
import time
from copy import deepcopy
from pathlib import Path
from typing import Callable

from app.agent.state import RunState
from app.agent.validation import completed_courses
from research.fixtures import STUDENT, CATALOG, REQUIREMENTS


STRATEGIES = ("restart", "visible_retry", "checkpoint", "source_rollback", "selective")


def missing_courses(student, requirements):
    completed = completed_courses(student)
    return sorted(c for c in requirements["labels"] if c.replace("-", "") not in completed)


def dependency_closure(state: RunState, source_ids: list[str], allowed_ids: set[str]) -> set[str]:
    affected = set(source_ids)
    for step in state.steps:
        if step.id in allowed_ids and any(dep in affected for dep in step.dependencies):
            affected.add(step.id)
    return affected


def failure_observation(state: RunState, ids: dict[str, str]) -> dict:
    return {
        "task": "Find the earliest step whose output is inconsistent with its inputs and caused the final validation failure.",
        "failure_step_id": ids["validate"],
        "steps": [
            {
                "id": step.id,
                "name": step.name,
                "dependencies": step.dependencies,
                "inputs": step.inputs,
                "output": step.output,
                "status": step.status,
            }
            for step in state.steps
            if step.id in set(ids.values())
        ],
    }


def experiment(strategy: str, locator: Callable[[dict], dict] | None = None) -> dict:
    state = RunState()
    fault_pending = True

    def workflow():
        nonlocal fault_pending
        student, a = state.execute("student", {}, [], lambda: deepcopy(STUDENT))
        requirements, b = state.execute("requirements", {}, [], lambda: deepcopy(REQUIREMENTS))
        def calculate():
            nonlocal fault_pending
            result = missing_courses(student, requirements)
            if fault_pending:
                fault_pending = False
                return []  # An intermediate result incorrectly reports no outstanding courses.
            return result
        remaining, c = state.execute("remaining", {}, [a, b], calculate)
        catalog, d = state.execute("catalog", {}, [], lambda: deepcopy(CATALOG))
        _, e = state.execute("sections", {}, [d], lambda: {row["course_code"]: [] for row in catalog})
        proposal, f = state.execute("proposal", {}, [c, d], lambda: list(remaining))
        def check():
            expected = missing_courses(student, requirements)
            return {
                "valid": set(proposal) == set(expected),
                "violation": None if set(proposal) == set(expected) else {
                    "rule": "proposal_covers_remaining_requirements",
                    "message": "The proposal does not cover the independently recomputed remaining requirements.",
                    "expected_courses": expected,
                    "proposal_courses": proposal,
                },
            }
        validation, g = state.execute("validate", {}, [a, b, f], check)
        return validation["valid"], {"student": a, "requirements": b, "remaining": c, "catalog": d, "sections": e, "proposal": f, "validate": g}

    initial_valid, ids = workflow()
    assert not initial_valid
    initial_steps = len(state.steps)
    initial_ids = set(ids.values())
    true_source = ids["remaining"]
    true_affected = dependency_closure(state, [true_source], initial_ids)
    recovery_start = time.monotonic()
    diagnosis_steps = 0
    predicted_source = None
    if strategy == "restart":
        invalidated = state.invalidate(list(ids.values()), "Restart all work after failure")
    elif strategy == "visible_retry":
        invalidated = state.invalidate([ids["validate"]], "Retry where the failure became visible")
    elif strategy == "checkpoint":
        # Latest checkpoint precedes proposal generation, but already contains the bad audit.
        invalidated = state.invalidate([ids["proposal"]], "Restore latest checkpoint before proposal")
    else:
        observation = failure_observation(state, ids)
        if locator is None:
            # Deterministic locator baseline; it does not receive injection metadata.
            def diagnose():
                expected = missing_courses(state.step(ids["student"]).output, state.step(ids["requirements"]).output)
                source = ids["remaining"] if state.step(ids["remaining"]).output != expected else ids["proposal"]
                return {"source_step_id": source, "confidence": 1.0, "rationale": "Compared the recorded computation with its source inputs."}
        else:
            diagnose = lambda: locator(observation)
        diagnosis, _ = state.execute("diagnose", {"failure_step_id": ids["validate"]}, list(ids.values()), diagnose)
        diagnosis_steps = 1
        predicted_source = str(diagnosis["source_step_id"])
        if predicted_source not in initial_ids:
            raise ValueError("Locator selected a step outside the observed trajectory")
        usage = diagnosis.get("usage") or {}
        state.usage["model_calls"] += int(usage.get("model_calls") or 0)
        for key in ("input_tokens", "output_tokens", "thought_tokens"):
            state.usage[key] += int(usage.get(key) or 0)
        sources = [predicted_source]
        if strategy == "source_rollback":
            sources = [step.id for step in state.steps[:initial_steps] if int(step.id) >= int(predicted_source)]
        invalidated = state.invalidate(sources, "Recovery from localized inconsistency")
    invalidated_initial = set(invalidated) & initial_ids
    recovered, _ = workflow()
    repeated = sum(1 for s in state.steps[initial_steps:] if s.name != "diagnose")
    # The corrupted result and its proposal/validation descendants were never valid work.
    valid_initial = [ids[n] for n in ("student", "requirements", "catalog", "sections")]
    preserved = sum(state.step(s).status == "ok" for s in valid_initial)
    true_positive = len(invalidated_initial & true_affected)
    precision = true_positive / len(invalidated_initial) if invalidated_initial else 0.0
    recall = true_positive / len(true_affected) if true_affected else 1.0
    invalidation_f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "strategy": strategy, "success": recovered, "repeated_steps": repeated,
        "diagnostic_steps": diagnosis_steps, "preserved_valid_steps": preserved,
        "predicted_source_step": predicted_source,
        "true_source_step": true_source,
        "exact_source_accuracy": None if predicted_source is None else predicted_source == true_source,
        "safe_boundary": None if predicted_source is None else true_source in invalidated_initial,
        "true_affected_steps": sorted(true_affected),
        "invalidated_steps": sorted(invalidated_initial),
        "invalidation_precision": round(precision, 4),
        "invalidation_recall": round(recall, 4),
        "invalidation_f1": round(invalidation_f1, 4),
        "recovery_ms": round((time.monotonic() - recovery_start) * 1000, 3),
        "model_calls": state.usage["model_calls"],
        "tokens": state.usage["input_tokens"] + state.usage["output_tokens"] + state.usage["thought_tokens"],
        "estimated_model_cost_usd": None,
        "trace": state.trace(include_data=True),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="../logs/recovery-benchmark.json")
    args = parser.parse_args()
    rows = [experiment(strategy) for strategy in STRATEGIES]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "scenario": "Synthetic delayed incorrect remaining-course result",
        "limitations": "One deterministic scenario, known graph and rule-based localization. No Gemini calls. Timing is local Python overhead; this is not statistical evidence of agent recovery superiority.",
        "results": rows,
    }, indent=2), encoding="utf-8")
    print("Strategy          Success  Repeated  Diagnosis  Valid work preserved")
    for r in rows:
        print(f"{r['strategy']:17} {str(r['success']):7} {r['repeated_steps']:8} {r['diagnostic_steps']:10} {r['preserved_valid_steps']:21}")
    print(f"Results: {output.resolve()}")


if __name__ == "__main__":
    main()
