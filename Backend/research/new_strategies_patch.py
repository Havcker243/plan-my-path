"""
Patch for tau_recovery.py — three new recovery strategies.
Apply after Phase 3 completes (never while a matrix is running).

Changes required in tau_recovery.py:
  1. Line 22: expand STRATEGIES tuple
  2. Lines 180-211: expand recover() with new branches
  3. Line 288: expand --seed choices (also done by launch_phase4.ps1)
  4. Line 290: expand --strategies parser choices

───────────────────────────────────────────────────────────────────
STRATEGY DESIGNS
───────────────────────────────────────────────────────────────────

1. rollback_with_reflection
   Source: "Rollback the World, Keep the Reflection" (arXiv 2609.18304)
   Mechanism: Identical state rollback to source_rollback, then append a
   short correction note to the restored trajectory so the agent understands
   why it is re-running, rather than silently continuing on a truncated trace.
   Hypothesis: explicit reflection reduces repeated mistakes when the agent's
   reasoning was contaminated by seeing the bad result before rollback.

2. verbal_correction
   Source: Reflexion / CRITIC / "Self-Healing Framework" (arXiv 2605.06737)
   Mechanism: No state rollback. When fault detected, roll back only one step
   (to just before the bad dispatch), then inject a "correction" tool result
   that returns the fresh correct data for the failed call. The agent sees the
   corrected data in-place and continues without knowing a failure occurred.
   Hypothesis: minimal-intervention correction avoids the conversational-budget
   cost of rollback while giving the agent accurate information.

3. adaptive
   Source: "Retry, Switch, or Abstain?" (arXiv 2608.11977)
   Mechanism: Meta-controller — picks the empirically best strategy per fault:
     empty_read    → source_rollback  (1.00 across all seeds in Phases 1-3)
     wrong_user_id → restart          (uniform 1.00 when exercised)
     tool_error    → selective        (1.00 when exercised, seed 300)
   Hypothesis: fault-type-aware routing achieves near-oracle performance.

───────────────────────────────────────────────────────────────────
EXACT CODE CHANGES
───────────────────────────────────────────────────────────────────
"""

# ── Change 1 ──────────────────────────────────────────────────────
# OLD (line 22):
OLD_STRATEGIES = (
    "STRATEGIES = (\"no_recovery\", \"restart\", \"visible_retry\", "
    "\"checkpoint\", \"source_rollback\", \"selective\")"
)
# NEW:
NEW_STRATEGIES = (
    "STRATEGIES = (\"no_recovery\", \"restart\", \"visible_retry\", "
    "\"checkpoint\", \"source_rollback\", \"selective\", "
    "\"rollback_with_reflection\", \"verbal_correction\", \"adaptive\")"
)

# ── Change 2 ──────────────────────────────────────────────────────
# In recover(), after the existing 'else:' block (lines 193-196),
# replace with these branches:
RECOVER_NEW_BRANCHES = '''
        elif self.strategy == "rollback_with_reflection":
            # Identical rollback target to source_rollback.
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
            # Inject reflection note so agent knows context when it continues.
            # Appended to the restored trajectory BEFORE the next agent step.
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
                # Record that a reflection message was injected.
                self.events[-1]["reflection_injected"] = True
            except Exception:
                self.events[-1]["reflection_injected"] = False
            self.recoveries += 1

        elif self.strategy == "verbal_correction":
            # No state rollback. Roll back one step (to just before the bad
            # dispatch) and then serve a pre-fetched correct result for the
            # failed call so the agent sees corrected data in-place.
            target = self.snapshots[-1]  # one step back — last dispatch boundary
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
            # Pre-fetch the correct result for the detected bad call and cache it
            # as a verified entry so the next response() call serves it directly.
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

        elif self.strategy == "adaptive":
            # Fault-type-aware meta-strategy: select the empirically best
            # rollback type for this fault and apply it.
            fault_to_effective = {
                "empty_read":    "source_rollback",
                "wrong_user_id": "restart",
                "tool_error":    "selective",
            }
            effective = fault_to_effective.get(self.fault, "source_rollback")
            if effective == "restart":
                target = self.snapshots[0]
                invalidated = {n["id"] for n in self.nodes}
            elif effective == "source_rollback":
                target = self.snapshots[suspect["snapshot_index"]]
                invalidated = {n["id"] for n in self.nodes if n["attempt_step"] >= target["attempt_step"]}
            else:  # selective
                target = self.snapshots[suspect["snapshot_index"]]
                invalidated = affected  # noqa: F821 — computed above from closure()
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
                self.events[-1]["verified_cache_entries"] = len(self.verified_cache)
'''

# ── How to apply (after Phase 3 finishes) ─────────────────────────
APPLY_INSTRUCTIONS = """
After Phase 3 completes:

1. Run: python Backend/research/apply_new_strategies.py
   (This script reads tau_recovery.py, applies the patches, and writes it back.)

2. OR apply manually:
   a. Line 22: replace STRATEGIES tuple as shown above
   b. In recover(): replace the final 'else:' block (source_rollback/selective)
      with the new if/elif chain above, keeping source_rollback and selective
      as the first two cases, then adding the three new ones
   c. Line 288: add 303, 304, 305 to --seed choices (done by launch_phase4.ps1)
   d. Line 290: add three new strategy names to --strategies choices

3. Verify the new adapter hash and record it.
4. Run Phase 4 with --strategies including new ones:
   python tau_recovery_matrix.py --tasks 0 --seeds 303 304 305
     --faults empty_read wrong_user_id tool_error
     --strategies no_recovery restart visible_retry checkpoint
       source_rollback selective rollback_with_reflection verbal_correction adaptive
     --execute
"""

if __name__ == "__main__":
    print("New strategy designs for tau_recovery.py.")
    print("Apply after Phase 3 finishes — never while a matrix is running.")
    print(APPLY_INSTRUCTIONS)
