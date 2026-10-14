# Next evaluation stage

## October 14, 2026 — current status

**Phase 4b attempt:** Matrix `tau-matrix-20261014T204529Z-81c4b6` launched for task 0, seeds 300–302, faults empty_read/wrong_user_id/tool_error, strategies rollback_with_reflection/verbal_correction/adaptive, 27 cells. All cells returning 503 UNAVAILABLE (Gemini free-tier under high demand at time of launch). Cells complete quickly with execution errors; matrix will finish with `status: finished_with_failures`. Results retained. **Re-run Phase 4b when API capacity recovers** using the same command:

```powershell
$main = "C:\Users\dolap\Desktop\Projects\plan-my-path"
$env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"
& "$main\Backend\.venv\Scripts\python.exe" "$main\Backend\research\tau_recovery_matrix.py" `
    --tasks 0 --seeds 300 301 302 `
    --faults empty_read wrong_user_id tool_error `
    --strategies rollback_with_reflection verbal_correction adaptive `
    --skip-unfaulted --execute
```

**After Phase 4b succeeds:** run `Backend\.venv\Scripts\python.exe Backend\research\build_results_table.py` to regenerate the summary table and dashboard.

**Phase 5 (tasks 1+2, seeds 300–302, all 9 strategies):** next after Phase 4b. 3 tasks × 3 seeds × 3 faults × 9 strategies = 162 cells (plus 18 unfaulted). Requires multiple days at 500 req/day quota. Run after Phase 4b.

**Completed as of October 14:** Protocol updated (4 amendments, 9 strategies, 6 seeds, 3 tasks). Research log, progress-report draft, and analysis script all updated. Results table and dashboard regenerated from Phases 1–3 data (165 cells, seeds 300–302, 6 original strategies). Three new strategies implemented in adapter with literature citations.

---

AgentRx update: [all six stages completed on one public sample](baselines/results/agentrx-full-20261009T093620Z-3eec32/findings.md) using clean pinned code and Copilot-auto substitution after the original model was rejected. The original run received no ground-truth file. A subsequent read-only comparison with the released task-39 annotation found the same root step (17), but different failure categories (predicted 2, annotated 5). This is one case, not full diagnosis accuracy or recovery-method reproduction. The site action is configured to the tested route; nine API integration tests passed.

Next comparison [predeclared here](v3-bounded-comparison-20261009.md): task 0 / seed 300 / empty_read, no-recovery, source rollback and selective under v3. Plan only while recent artifacts report daily quota exhaustion. Analysis now displays total tool invocations including validation, with measurement counts and missing-data handling; eight analysis tests passed. No v3 live outcome is claimed.

October 9 redesign: [verified recovery cache v3](verified-cache-redesign-20261009.md) is implemented and all 12 pinned integration tests plus three matrix-scheduling tests pass. It validates saved tool values, excludes source/error/version-mismatched entries and pre-recovery cache hits, and records total tool invocations including validation. No new live trial was launched for this change. Preserve the active campaign's versioned evidence; the source/protocol guard stops further old-version cells. Next live work should be one serialized bounded comparison, not an immediate full campaign. Earlier results remain preliminary and do not evaluate v3.

October 9 continuation: [six strategies have now been attempted for task 0 / empty_read / seed 300](evidence/recovery-six-strategies-20261009/findings.md). All six earned official reward 1.0, but visible retry never encountered the planned fault. Selective, source rollback and no-recovery used equal step/model/tool counts, with no cached-read reuse. Restart took about 196 seconds, exceeding the cooperative 180-second budget. Other workspace campaigns overlap these conditions; the [all-completed snapshot](evidence/recovery-all-completed-20261009/summary.md) retains duplicates and quota errors rather than choosing favorable pairs. Next, inspect why selective recovery reused no reads and specify strict timeout handling before a separate versioned expansion to other faults/tasks. No work-saving advantage is established.

Latest October 8 continuation: [the fresh seed-300 pair](evidence/recovery-current-adapter-20261008/findings.md) is complete under the current adapter. Both methods earned reward 1.0 with equal steps/model/tool counts. The combined analysis retains six current-adapter attempts, four graded and two quota errors, with one complete matched pair. The [graded-failure inspection](evidence/recovery-subset-20261008/failure-inspection.md) documents premature simulated-user STOP before the exchange write. Next, execute the four still-unattempted strategies for the same seed-300 condition, then expand faults/tasks without changing the protocol or selecting for favorable results. The full study and published-method reproductions remain incomplete.

October 8 continuation: four live cells for task 0 / empty_read / seeds 301 and 302 were executed with the current adapter. [Findings](evidence/recovery-subset-20261008/findings.md) and [analysis](evidence/recovery-subset-20261008/summary.md) preserve one graded selective failure, one graded reference success and two quota errors. There are no complete graded pairs. The current adapter differs from the older seed-300 pilot; that pilot cannot supply the third matched seed. The dated literature review is [here](literature-update-20261008.md). Further execution needs a predeclared continuation/pairing rule and provider-capacity check; the full matrix remains unfinished.

The first report demonstrates a prototype. The next stage must establish repeatable comparisons rather than add interface features or claim more benchmark coverage.

Completed October 8: implemented read-only saved-evidence analysis with provenance grouping, explicit graded/ungraded and fault-coverage counts, and reference/selective paired deltas. Five offline tests verify that null rewards, mismatched protocols, ambiguous repeated attempts, unexercised faults and incomplete cost records do not produce misleading comparisons. All three historical pilot artifacts are included in the generated all-attempts summary. No new live trial was executed in this stage.

Next execution order:

1. Check the current adapter/protocol against archived hashes before extending an existing comparison group. A changed implementation starts a separate versioned group.
2. Complete the remaining task-0/empty-read seed conditions (301 and 302) with both no-recovery and selective strategies under the frozen budgets. Rotate method order according to the recorded plan. Retain any execution failures; do not rerun merely to replace an unfavorable result.
3. Use the existing matrix plan to include restart, visible retry, checkpoint and source rollback under the same task/fault/seed conditions, then expand to the other faults and released tasks. Report completed and pending cells explicitly.
4. Analyze fault coverage, official grading and work overhead with sample counts. Keep unchanged task baselines, controlled extensions and synthetic demonstrations separate.
5. Resolve supported provider/dataset access for faithful AgentRx diagnosis. Until then, its preprocessing remains setup evidence, and our controller must not be relabeled as a published recovery method.

Academic work continues in parallel with source review: verify the Fisk Computer Science requirement mapping and document unresolved prerequisites, catalog edition applicability and non-course requirements before expanding the partial checker. Synthetic student records remain the evaluation inputs.
