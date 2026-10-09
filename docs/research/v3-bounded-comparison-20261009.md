# Next live comparison: verified-cache v3

Predeclared October 9, 2026, before these v3 trials are executed. Purpose: determine whether verified recovery memoization changes success or total work relative to an ordinary agent and source rollback. This is an initial condition, not a statistical study.

Use released retail task 0, seed 300, empty_read, once each in the existing protocol order: no_recovery, source_rollback, selective. Keep the current v3 protocol, adapter, prompts, official evaluator, model, pacing and nominal budgets frozen. Preserve all outcomes; do not replace a failed or unexercised attempt with a favorable one. Earlier adapter results remain separate.

Primary interpretation requires the fault to be exercised and grading to be available. Report official reward, detection/source accuracy, model calls, executed tools, validation calls, **total tool invocations**, reused reads, time and timeout overruns. Do not infer efficiency from cache hits alone. Seed equality does not ensure equal trajectories, and three trials in fixed order do not establish a general causal advantage.

## Execution status

Prepared only. Recent artifacts report Gemini daily quota exhaustion; the recorded reset delay is an estimate, not a verified capacity guarantee. Do not launch the full matrix or repeated requests while that condition persists. Confirm capacity and absence of competing campaigns before beginning. No automated retry or scheduled execution is installed.

Materialize the three-cell plan without API calls:

```powershell
Backend\.venv\Scripts\python.exe Backend/research/tau_recovery_matrix.py --tasks 0 --seeds 300 --faults empty_read --strategies no_recovery source_rollback selective --skip-unfaulted
```

After capacity is available, the same command with `--execute` creates a fresh campaign. The runner preserves source/protocol copies and stops remaining cells on version changes. It does not stop automatically on a quota error; if quota exhaustion recurs, retain that attempt and halt further launches rather than running repeated campaigns. Record any continuation before observing its outcome.

## Analysis readiness

The saved-evidence analyzer now includes total tool invocations in matched reference/selective deltas and shows execution/validation/total measurements for every method, including source rollback. It reports sample counts and unrecorded values separately; ungraded or unexercised rows do not contribute to the graded-fault work means. Source rollback is displayed descriptively, not silently treated as another reference/selective pair. Eight analysis tests pass, including a case with fewer executed tools but greater total work after validation. Test inputs are artificial software checks, not benchmark results.
