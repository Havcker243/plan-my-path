"""Audit saved live traces without executing model calls or changing agent code."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "evidence"
recovery_path = OUT / "live-recovery-network-retry-2026-10-07.json"
recovery = json.loads(recovery_path.read_text())
row = recovery["results"][0]
steps = row["trace"]["steps"]
by_id = {s["id"]: s for s in steps}
diagnosis = next(s for s in steps if s["name"] == "diagnose")
validations = [s for s in steps if s["name"] == "validate"]
reused = {e["step_id"] for e in row["trace"]["events"] if e["event"] == "reuse"}
checks = {
    "live_model_call_recorded": row["model_calls"] == 1 and row["tokens"] > 0,
    "initial_validator_exposes_failure": validations[0]["output"]["valid"] is False,
    "diagnosis_has_source_confidence_rationale": all(k in diagnosis["output"] for k in ("source_step_id", "confidence", "rationale")),
    "diagnosis_matches_hidden_source": row["predicted_source_step"] == row["true_source_step"],
    "affected_task_nodes_are_invalidated": set(row["invalidated_steps"]) == {"3", "6", "7"},
    "correct_source_and_branch_nodes_reused": reused == {"1", "2", "4", "5"},
    "exactly_three_task_nodes_replayed": row["repeated_steps"] == 3,
    "final_validation_passes": validations[-1]["output"]["valid"] is True,
    "dependencies_exist_and_precede_consumer": all(
        p in by_id and int(p) < int(s["id"]) for s in steps for p in s["dependencies"]),
}
planning_files = sorted(OUT.glob("live-planning*2026-10-07.json"))
planning = []
for path in planning_files:
    data = json.loads(path.read_text())
    events = data.get("events", [])
    trace = data.get("trace", {})
    proposals = [e for e in events if "proposal" in e]
    planning.append({
        "file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "model": data.get("model"), "success": data.get("success"),
        "model_calls": trace.get("usage", {}).get("model_calls"),
        "tool_calls": [e["name"] for e in trace.get("events", []) if e.get("event") == "tool_call"],
        "valid_proposal_emitted": any(e.get("validation", {}).get("valid") for e in proposals),
        "final_response_emitted": any(e.get("chunk") for e in events),
        "final_trace_emitted": any("agent_trace" in e for e in events),
        "errors": [{k: e.get(k) for k in ("error_type", "provider_code", "provider_status")}
                   for e in events if "error_type" in e],
    })
audit = {
    "audit_date": "2026-10-07", "recovery_source": recovery_path.name,
    "recovery_source_sha256": hashlib.sha256(recovery_path.read_bytes()).hexdigest(),
    "recovery_checks": checks, "recovery_checks_all_pass": all(checks.values()),
    "recovery_metrics": {k: row[k] for k in ("success", "repeated_steps", "preserved_valid_steps", "tokens", "recovery_ms", "invalidation_f1")},
    "planning_attempts": planning,
    "limitations": [
        "Planning and recovery are separate harnesses, not one integrated live recovery session.",
        "Recovery uses Gemini for diagnosis; replayed computation and proposal are deterministic.",
        "One synthetic fault, not verified Fisk catalog rules or a multi-scenario evaluation.",
        "Checkpoint baseline is a simulated boundary, not durable environment restoration.",
        "Model cost is not calculated; estimated_model_cost_usd is null.",
        "Source/rule versions, full generation settings, and collection timestamps are not embedded consistently in the current harness outputs.",
        "Retained node count includes a sections lookup unused by the final proposal.",
        "The diagnosis node is also marked invalidated because it depends on the old trace; its output is preserved as evidence.",
    ],
}
(OUT / "live-flow-audit-2026-10-07.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
print(json.dumps(audit, indent=2))
if not all(checks.values()):
    raise SystemExit(1)
