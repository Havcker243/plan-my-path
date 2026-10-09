"""Controlled recovery extension around pinned tau retail code (not a paper reproduction).

Run using the upstream isolated interpreter; upstream files are never edited.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Backend"))
from research.official_baselines import BASELINES, verify_checkout, redact

STRATEGIES = ("no_recovery", "restart", "visible_retry", "checkpoint", "source_rollback", "selective")
FAULTS = ("none", "empty_read", "wrong_user_id", "tool_error")
FIELDS = ("agent_state", "user_state", "trajectory", "message", "from_role", "to_role", "step_count", "num_errors", "done", "termination_reason")


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def closure(nodes: list[dict], roots: set[str]) -> set[str]:
    affected = set(roots)
    for node in nodes:  # Nodes are appended in topological execution order.
        if affected.intersection(node["depends_on"]):
            affected.add(node["id"])
    return affected


class RecoveryController:
    """Retail-only snapshots, trace DAG, read revalidation, and bounded recovery.

    Detection has no access to injection labels. It re-executes observed reads
    only against the identical database version and compares canonical content.
    All model/user generations conservatively depend on the observed prefix.
    """

    def __init__(self, orchestrator, strategy: str, fault: str, max_steps: int = 60, provider_interval: float = 0):
        if strategy not in STRATEGIES or fault not in FAULTS:
            raise ValueError("Unknown method or fault")
        if orchestrator.environment.get_domain_name() != "retail" or orchestrator.environment.user_tools is not None:
            raise ValueError("Adapter supports isolated retail environments only")
        self.o = orchestrator
        self.strategy, self.fault, self.max_steps = strategy, fault, max_steps
        self.nodes, self.context, self.reads, self.events, self.snapshots = [], [], [], [], []
        self.cache = {}
        self.verified_cache = set()
        self.total_steps = self.tool_executions = self.validation_calls = self.cache_hits = 0
        self.total_errors = 0
        self.recoveries = 0
        self.invalidated = set()
        self.injection = None  # Scoring only; never read by detect().
        self.detected = None
        self.original_response = self.o.environment.get_response
        self.o.environment.get_response = self.response
        self.current_step = 0
        self.provider_interval = provider_interval

    def node(self, kind: str, dependencies: list[str], **data) -> str:
        node_id = str(len(self.nodes) + 1)
        self.nodes.append({"id": node_id, "kind": kind, "depends_on": list(dependencies),
                           "attempt_step": self.total_steps, "status": "active", **data})
        return node_id

    def snapshot(self):
        state = {name: getattr(self.o, name) for name in FIELDS}
        # Copy in one operation to retain aliases between pending messages and states.
        return {"state": deepcopy(state), "db": deepcopy(self.o.environment.tools.db),
                "context": list(self.context), "reads": deepcopy(self.reads),
                "attempt_step": self.total_steps}

    def restore(self, snapshot):
        for name, value in deepcopy(snapshot["state"]).items():
            setattr(self.o, name, value)
        self.o.environment.tools.db = deepcopy(snapshot["db"])
        self.o.environment.sync_tools()
        self.context, self.reads = list(snapshot["context"]), deepcopy(snapshot["reads"])
        # Global steps, wall time, injection, evidence, and usage are never reset.

    @staticmethod
    def canonical(message):
        try:
            content = json.loads(message.content)
        except (ValueError, TypeError):
            content = message.content
        return {"content": content, "error": bool(message.error)}

    def response(self, call):
        env = self.o.environment
        before = env.get_db_hash()
        mutates = env._is_mutating_tool(call.name)
        key = digest([call.name, call.arguments, call.requestor, before])
        dependencies = [self.step_node]
        # Every call also depends on prior mutations; hashes guard cached read reuse.
        dependencies += [n["id"] for n in self.nodes if n["kind"] == "write" and n["status"] == "active"]
        cached = self.cache.get(key) if self.strategy == "selective" and not mutates and self.recoveries else None
        # Recovery memoization requires an exact request/version match and a
        # separately verified response. It does not prove reasoning independence.
        cache_safe = (cached and key in self.verified_cache
                      and cached["node_id"] != self.detected and not cached["response"].error)
        if cache_safe:
            from tau2.utils.utils import get_now
            result = cached["response"].model_copy(update={"id": call.id, "timestamp": get_now()}, deep=True)
            self.cache_hits += 1
            reused = True
        else:
            result = self.original_response(call)
            self.tool_executions += 1
            reused = False
        injected_now = False
        if self.fault != "none" and self.injection is None and call.name == "get_user_details" and not result.error:
            injected_now = True
            if self.fault == "empty_read":
                result = result.model_copy(update={"content": "{}"}, deep=True)
            elif self.fault == "wrong_user_id":
                payload = json.loads(result.content)
                payload["user_id"] = "__controlled_invalid_user__"
                result = result.model_copy(update={"content": json.dumps(payload)}, deep=True)
            else:
                result = result.model_copy(update={"content": '{"error":"controlled transient tool timeout"}', "error": True}, deep=True)
        node_id = self.node("write" if mutates else "read", dependencies, tool=call.model_dump(mode="json"),
                            output=self.canonical(result), db_before=before, db_after=env.get_db_hash(),
                            cache_hit=reused, snapshot_index=self.current_step)
        if injected_now:
            self.injection = {"source_node": node_id, "fault": self.fault, "attempt_step": self.total_steps}
        self.total_errors += int(bool(result.error))
        self.context.append(node_id)
        if not mutates:
            self.reads.append({"node_id": node_id, "call": deepcopy(call), "response": deepcopy(result),
                               "db_hash": before, "attempt_step": self.total_steps,
                               "snapshot_index": self.current_step, "cache_key": key})
            self.cache[key] = {"node_id": node_id, "response": deepcopy(result),
                               "call": deepcopy(call), "db_hash": before}
            if result.error or injected_now:
                self.verified_cache.discard(key)
            elif self.recoveries:
                # Fresh post-recovery reads use the trusted local tool. An
                # already verified cache hit keeps that verification status.
                self.verified_cache.add(key)
        return result

    def verify_recovery_cache(self):
        """Check saved read values against the restored DB; count all overhead."""
        self.verified_cache.clear()
        current = self.o.environment.get_db_hash()
        for key, cached in self.cache.items():
            if (cached["node_id"] == self.detected or cached["response"].error
                    or cached["db_hash"] != current):
                continue
            fresh = self.original_response(cached["call"])
            self.validation_calls += 1
            if not fresh.error and self.canonical(fresh) == self.canonical(cached["response"]):
                self.verified_cache.add(key)

    def detect(self):
        """Wait until at least one subsequent orchestrator step, then revalidate.

        Read versions that no longer match the current DB are not compared.
        The source is the earliest observed mismatch, not injection metadata.
        """
        current = self.o.environment.get_db_hash()
        for read in self.reads:
            if self.total_steps - read["attempt_step"] < 2 or read["db_hash"] != current:
                continue
            fresh = self.original_response(read["call"])
            self.validation_calls += 1
            if self.canonical(fresh) != self.canonical(read["response"]):
                return read
        return None

    def recover(self, suspect):
        source = suspect["node_id"]
        affected = closure(self.nodes, {source})
        if self.strategy == "restart":
            target = self.snapshots[0]
            invalidated = {n["id"] for n in self.nodes}
        elif self.strategy == "visible_retry":
            target = self.snapshots[-1]
            invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
        elif self.strategy == "checkpoint":
            # Fixed periodic checkpoint rule, deliberately independent of source.
            target = next(s for s in reversed(self.snapshots) if s["attempt_step"] % 4 == 0)
            invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
        else:
            target = self.snapshots[suspect["snapshot_index"]]
            invalidated = affected if self.strategy == "selective" else {
                n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
        self.invalidated.update(invalidated)
        for node in self.nodes:
            if node["id"] in invalidated:
                node["status"] = "invalidated"
        self.events.append({"detected_at_attempt_step": self.total_steps, "predicted_source_node": source,
                            "boundary_attempt_step": target["attempt_step"], "invalidated_nodes": sorted(invalidated, key=int),
                            "dependency_affected_nodes": sorted(affected, key=int),
                            "db_hash_restored": target["db"].get_hash(),
                            "state_restored": list(FIELDS) + ["retail_db"],
                            "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
        self.restore(target)
        self.recoveries += 1
        if self.strategy == "selective":
            self.verify_recovery_cache()
            self.events[-1]["verified_cache_entries"] = len(self.verified_cache)

    def run(self):
        from tau2.data_model.simulation import TerminationReason
        from tau2.evaluator.evaluator import evaluate_simulation, EvaluationType
        from tau2.utils.utils import get_now

        self.invalidated = set()
        self.o._run_start_time, self.o._run_start_perf = get_now(), time.perf_counter()
        self.o.initialize()
        finalized = False
        try:
            while not self.o.done:
                if self.total_steps >= self.max_steps:
                    self.o.done, self.o.termination_reason = True, TerminationReason.MAX_STEPS
                    # Official finalization expects a delivery role, not a pending tool call.
                    if self.o.to_role.value == "env":
                        from tau2.orchestrator.orchestrator import Role
                        self.o.to_role = Role.AGENT
                    break
                if self.detected is None and (suspect := self.detect()):
                    self.detected = suspect["node_id"]
                    if self.strategy != "no_recovery":
                        self.recover(suspect)
                        continue
                self.current_step = len(self.snapshots)
                self.snapshots.append(self.snapshot())
                self.step_node = self.node("dispatch", list(self.context), recipient=str(self.o.to_role))
                before = len(self.o.trajectory)
                if self.o.to_role.value in ("agent", "user") and self.provider_interval:
                    # Same fixed pacing for both participants and every strategy.
                    time.sleep(self.provider_interval)
                    self.o._check_timeout()
                    if self.o.done:
                        break
                self.o.step()
                added = self.o.trajectory[before:]
                self.nodes[int(self.step_node) - 1]["messages"] = [m.model_dump(mode="json") for m in added]
                self.context.append(self.step_node)
                self.total_steps += 1
                self.o._check_termination()
                if self.total_errors >= self.o.max_errors and self.o.to_role.value != "env":
                    self.o.done, self.o.termination_reason = True, TerminationReason.TOO_MANY_ERRORS
            simulation = self.o._finalize()
            finalized = True
            simulation.policy = self.o.environment.get_policy()
            simulation.reward_info = evaluate_simulation(simulation, self.o.task, EvaluationType.ALL,
                                                        solo_mode=False, domain="retail")
            # Sum attempted generation messages, including branches discarded on recovery.
            messages = [m for n in self.nodes if n["kind"] == "dispatch" for m in n.get("messages", [])
                        if m.get("role") in ("assistant", "user")]
            true_source = (self.injection or {}).get("source_node")
            return {"strategy": self.strategy, "task_id": self.o.task.id, "seed": self.o.seed, "fault": self.fault,
                    "reward": simulation.reward_info.reward, "fault_exercised": self.injection is not None,
                    "recovery_success": None if true_source is None or self.strategy == "no_recovery" else simulation.reward_info.reward == 1,
                    "exact_source_accuracy": None if true_source is None or self.detected is None else self.detected == true_source,
                    "source_scoring_only": self.injection, "predicted_source_node": self.detected,
                    "total_attempt_steps": self.total_steps, "tool_executions": self.tool_executions,
                    "total_tool_errors": self.total_errors,
                    "validation_tool_calls": self.validation_calls, "cached_reads_reused": self.cache_hits,
                    "total_tool_invocations": self.tool_executions + self.validation_calls,
                    "model_calls": len(messages), "attempted_usage": [m.get("usage") for m in messages],
                    "estimated_attempt_cost_usd": sum(m.get("cost") or 0 for m in messages),
                    "cost_usage_complete": all(m.get("cost") is not None and m.get("usage") is not None for m in messages),
                    "duration": time.perf_counter() - self.o._run_start_perf,
                    "termination_reason": simulation.termination_reason.value,
                    "events": self.events, "trace": self.nodes, "simulation": simulation.model_dump(mode="json")}
        finally:
            self.o.environment.get_response = self.original_response
            if not finalized:
                self.o._cleanup()


def main():
    os.environ.setdefault("LOGURU_LEVEL", "ERROR")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", choices=("0", "1", "2"), default="0")
    parser.add_argument("--seed", type=int, choices=(300, 301, 302), default=300)
    parser.add_argument("--fault", choices=FAULTS, default="empty_read")
    parser.add_argument("--strategies", nargs="+", choices=STRATEGIES, default=["no_recovery", "selective"])
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    lock = json.loads((BASELINES / "upstream-lock.json").read_text())
    verify_checkout(lock["tau_bench"])
    from dotenv import dotenv_values
    config = dotenv_values(ROOT / "Backend/.env")
    key = os.environ.get("GEMINI_API_KEY") or config.get("GEMINI_API_KEY") or config.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Configure Gemini API key locally")
    os.environ["GEMINI_API_KEY"] = key
    os.environ["GOOGLE_API_KEY"] = key
    from tau2.data_model.simulation import TextRunConfig
    from tau2.run import build_orchestrator, load_tasks
    task = next(t for t in load_tasks("retail", "base") if t.id == args.task)
    model = "gemini/gemini-3.5-flash-lite"
    configuration = TextRunConfig(domain="retail", llm_agent=model, llm_user=model,
                                  llm_args_agent={"temperature": 0, "timeout": 45, "num_retries": 0},
                                  llm_args_user={"temperature": 0, "timeout": 45, "num_retries": 0},
                                  max_steps=60, max_errors=10, timeout=180, seed=args.seed)
    output = Path(args.output)
    if output.exists():
        raise FileExistsError("Preserve existing evidence; choose a new output path")
    output.parent.mkdir(parents=True, exist_ok=True)
    record = {"schema_version": 1, "action": "tau-recovery", "started_at": datetime.now(timezone.utc).isoformat(),
              "upstream": lock["tau_bench"], "configuration": configuration.model_dump(mode="json"),
              "protocol": "docs/research/tau-recovery-protocol.json", "task": task.model_dump(mode="json"),
              "protocol_sha256": hashlib.sha256((ROOT / "docs/research/tau-recovery-protocol.json").read_bytes()).hexdigest(),
              "adapter_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "adapter_source": Path(__file__).read_text(encoding="utf-8"),
              "protocol_definition": json.loads((ROOT / "docs/research/tau-recovery-protocol.json").read_text()),
              "input_sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in (ROOT / ".research-upstream/tau-bench/data/tau2/domains/retail").glob("*")
                               if p.name in ("tasks.json", "split_tasks.json", "db.json", "policy.md")},
              "limitations": "Controlled-fault extension on released tasks; not unchanged suite scores or a published recovery implementation. Conservative dependencies may yield no selective advantage.",
              "results": []}
    output.write_text(redact(json.dumps(record, indent=2), os.environ), encoding="utf-8")
    for strategy in args.strategies:
        print(f"Task {args.task}, seed {args.seed}, fault {args.fault}, strategy {strategy}", flush=True)
        controller = None
        try:
            orch = build_orchestrator(configuration, task, seed=args.seed)
            controller = RecoveryController(orch, strategy, args.fault, provider_interval=6)
            row = controller.run()
        except Exception as exc:
            row = {"strategy": strategy, "task_id": args.task, "seed": args.seed, "fault": args.fault,
                   "reward": None, "execution_error": redact(f"{type(exc).__name__}: {exc}", os.environ)}
            if controller:
                row.update(trace=controller.nodes, events=controller.events, source_scoring_only=controller.injection,
                           fault_exercised=controller.injection is not None, total_attempt_steps=controller.total_steps,
                           cost_usage_complete=False)
        record["results"].append(row)
        record["ended_at"] = datetime.now(timezone.utc).isoformat()
        output.write_text(redact(json.dumps(record, indent=2), os.environ), encoding="utf-8")
        print(f"Reward: {row.get('reward')}; fault exercised: {row.get('fault_exercised')}; error: {bool(row.get('execution_error'))}", flush=True)
    if any(r.get("execution_error") for r in record["results"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
