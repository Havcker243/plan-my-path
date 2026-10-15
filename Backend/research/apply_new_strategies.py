"""
Applies the three new recovery strategies to tau_recovery.py.
Run ONLY after all matrix runs are finished (no active background tasks).
Rewrites tau_recovery.py in-place; the new adapter hash is printed.
"""
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ADAPTER = ROOT / "Backend/research/tau_recovery.py"
src = ADAPTER.read_text(encoding="utf-8")

# ── 1. Expand STRATEGIES tuple ────────────────────────────────────
old_strat = (
    'STRATEGIES = ("no_recovery", "restart", "visible_retry", '
    '"checkpoint", "source_rollback", "selective")'
)
new_strat = (
    'STRATEGIES = ("no_recovery", "restart", "visible_retry", '
    '"checkpoint", "source_rollback", "selective", '
    '"rollback_with_reflection", "verbal_correction", "adaptive")'
)
assert old_strat in src, "STRATEGIES line not found — already patched?"
src = src.replace(old_strat, new_strat, 1)

# ── 2. Expand recover() — replace the final else: branch ─────────
# The existing else covers source_rollback and selective together.
OLD_ELSE = """        else:
            target = self.snapshots[suspect["snapshot_index"]]
            invalidated = affected if self.strategy == "selective" else {
                n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
        self.invalidated.update(invalidated)
        for node in self.nodes:
            if node["id"] in invalidated:
                node["status"] = "invalidated"
        self.events.append({"kind": "recovery", "detected_at_attempt_step": self.total_steps,
                             "boundary_attempt_step": target["attempt_step"],
                             "strategy": self.strategy,
                             "state_restored": list(FIELDS) + ["retail_db"],
                             "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
        self.restore(target)
        self.recoveries += 1
        if self.strategy == "selective":
            self.verify_recovery_cache()
            self.events[-1]["verified_cache_entries"] = len(self.verified_cache)"""

NEW_BRANCHES = """        elif self.strategy in ("source_rollback", "selective"):
            target = self.snapshots[suspect["snapshot_index"]]
            invalidated = affected if self.strategy == "selective" else {
                n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
            self.invalidated.update(invalidated)
            for node in self.nodes:
                if node["id"] in invalidated:
                    node["status"] = "invalidated"
            self.events.append({"kind": "recovery", "detected_at_attempt_step": self.total_steps,
                                 "boundary_attempt_step": target["attempt_step"],
                                 "strategy": self.strategy,
                                 "state_restored": list(FIELDS) + ["retail_db"],
                                 "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
            self.restore(target)
            self.recoveries += 1
            if self.strategy == "selective":
                self.verify_recovery_cache()
                self.events[-1]["verified_cache_entries"] = len(self.verified_cache)

        elif self.strategy == "rollback_with_reflection":
            # Source: "Rollback the World, Keep the Reflection" (arXiv 2609.18304)
            # Same rollback target as source_rollback; adds a verbal note to the
            # restored trajectory so the agent knows why it is re-running.
            target = self.snapshots[suspect["snapshot_index"]]
            invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
            self.invalidated.update(invalidated)
            for node in self.nodes:
                if node["id"] in invalidated:
                    node["status"] = "invalidated"
            self.events.append({"kind": "recovery", "detected_at_attempt_step": self.total_steps,
                                 "boundary_attempt_step": target["attempt_step"],
                                 "strategy": self.strategy,
                                 "state_restored": list(FIELDS) + ["retail_db"],
                                 "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
            self.restore(target)
            try:
                from tau2.data_model.simulation import Message
                note = Message(
                    role="user",
                    content=(
                        "[System note: a tool call earlier in this conversation "
                        "returned invalid data. The conversation has been rolled "
                        "back to just before that call. Please continue normally.]"
                    )
                )
                self.o.trajectory.append(note)
                self.events[-1]["reflection_injected"] = True
            except Exception:
                self.events[-1]["reflection_injected"] = False
            self.recoveries += 1

        elif self.strategy == "verbal_correction":
            # Source: Reflexion / CRITIC / "Self-Healing Framework" (arXiv 2605.06737)
            # No deep rollback — roll back one step then pre-fetch the correct
            # result and cache it as verified so the agent sees corrected data.
            target = self.snapshots[-1]
            invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
            self.invalidated.update(invalidated)
            for node in self.nodes:
                if node["id"] in invalidated:
                    node["status"] = "invalidated"
            self.events.append({"kind": "recovery", "detected_at_attempt_step": self.total_steps,
                                 "boundary_attempt_step": target["attempt_step"],
                                 "strategy": self.strategy,
                                 "state_restored": list(FIELDS) + ["retail_db"],
                                 "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
            self.restore(target)
            fresh = self.original_response(suspect["call"])
            self.tool_executions += 1
            if not fresh.error:
                key = suspect["cache_key"]
                self.cache[key] = {"node_id": suspect["node_id"], "response": deepcopy(fresh),
                                   "call": suspect["call"], "db_hash": suspect["db_hash"]}
                self.verified_cache.add(key)
                self.events[-1]["verbal_correction_prefetched"] = True
            else:
                self.events[-1]["verbal_correction_prefetched"] = False
            self.recoveries += 1

        else:  # adaptive
            # Source: "Retry, Switch, or Abstain?" (arXiv 2608.11977)
            # Fault-type-aware meta-strategy: routes to the empirically best
            # rollback for each fault type based on Phases 1-3 results.
            fault_to_effective = {
                "empty_read":    "source_rollback",
                "wrong_user_id": "restart",
                "tool_error":    "selective",
            }
            effective = fault_to_effective.get(self.fault, "source_rollback")
            if effective == "restart":
                target = self.snapshots[0]
                invalidated = {n["id"] for n in self.nodes}
            elif effective == "selective":
                target = self.snapshots[suspect["snapshot_index"]]
                invalidated = affected
            else:
                target = self.snapshots[suspect["snapshot_index"]]
                invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
            self.invalidated.update(invalidated)
            for node in self.nodes:
                if node["id"] in invalidated:
                    node["status"] = "invalidated"
            self.events.append({"kind": "recovery", "detected_at_attempt_step": self.total_steps,
                                 "boundary_attempt_step": target["attempt_step"],
                                 "strategy": self.strategy, "effective_strategy": effective,
                                 "state_restored": list(FIELDS) + ["retail_db"],
                                 "pre_recovery_trace": [m.model_dump(mode="json") for m in self.o.trajectory]})
            self.restore(target)
            self.recoveries += 1
            if effective == "selective":
                self.verify_recovery_cache()
                self.events[-1]["verified_cache_entries"] = len(self.verified_cache)"""

assert OLD_ELSE in src, "recover() else block not found — structure may have changed"
src = src.replace(OLD_ELSE, NEW_BRANCHES, 1)

# ── 3. Expand --seed choices ──────────────────────────────────────
src = src.replace(
    "choices=(300, 301, 302), default=300",
    "choices=(300, 301, 302, 303, 304, 305), default=300",
    1
)

# ── 4. Expand --strategies choices ───────────────────────────────
src = src.replace(
    'choices=STRATEGIES, default=["no_recovery", "selective"]',
    'choices=STRATEGIES, default=["no_recovery", "selective"]',  # no change needed; STRATEGIES expanded
    1
)

# ── 5. Upgrade model ──────────────────────────────────────────────
src = src.replace(
    'model = "gemini/gemini-3.5-flash-lite"',
    'model = "gemini/gemini-3.5-flash-lite"',  # keep same model; 3.6-flash free tier is 20 req/day
    1
)

ADAPTER.write_text(src, encoding="utf-8")
new_hash = hashlib.sha256(ADAPTER.read_bytes()).hexdigest()
print(f"Patched {ADAPTER.relative_to(ROOT)}")
print(f"New adapter hash: {new_hash}")
print("Strategies now:", re.search(r'STRATEGIES = \(([^)]+)\)', src).group(1))
