# Four-cell live recovery subset — October 8, 2026

This stage executed four cells, not the full 171-cell plan. These are custom controlled-fault executions on the unchanged released retail task/evaluator, not unchanged benchmark scores or reproduction of a published recovery method.

Campaign: [matrix and exact commands](../../baselines/results/tau-matrix-20261009T044036Z-e96b6c/matrix.json). The directory timestamp is UTC October 9; execution occurred October 8 in America/Chicago. [Generated analysis](summary.md) keeps both requested seeds and all attempts.

| Seed | Strategy | Official reward | Fault exercised | Outcome |
| --- | --- | ---: | --- | --- |
| 301 | Selective | 0.0 | Yes | Graded task failure; exact source localized |
| 301 | No recovery | Ungraded | Yes | Provider RateLimitError (HTTP 429) |
| 302 | Selective | Ungraded | Yes | Provider RateLimitError (HTTP 429) |
| 302 | No recovery | 1.0 | Yes | Graded task success; ordinary agent completed task |

The graded selective run recorded 19 attempt steps, 12 model calls and approximately 91.09 seconds. Its evaluator recorded a database mismatch and a failed required exchange-action match, despite a correct source prediction. This establishes that correct fault localization alone did not ensure task completion in this attempt; it does not establish why all downstream decisions failed.

Follow-up inspection: the final simulated user response combined exchange confirmation with the STOP marker. The pinned official runner terminated before another agent dispatch, and the required exchange write was absent. See the [trace inspection and scripted mechanism test](failure-inspection.md). This explains the observed endpoint without changing reward zero or establishing a counterfactual live outcome.

The graded reference run recorded 21 attempt steps, 15 model calls and approximately 115.51 seconds. Because it used a different seed, its work/time must not be directly subtracted from the seed-301 selective run as a paired comparison.

Neither requested seed has two graded partners. Two of four attempts were graded, all four reached the injected fault, and two stopped with provider errors. There are **zero eligible graded pairs**. No strategy ranking, significance claim or benefit estimate follows from this subset. Null rewards are not task failures with reward zero.

The adapter hash differs from the older seed-300 paced pilot because monotonic tool-error accounting was added after that pilot. That older pilot remains a separate group even though the v2 protocol hash matches. The selected cells preserve the full protocol's method order; both selected seeds put selective before no recovery, so this subset is not order-balanced.

## Next experiment

First establish provider capacity without competing site experiments. Preserve the current four attempts. Any later continuation/retry campaign must be predeclared, assign distinct attempt identities and keep quota failures in the analysis; never replace these records. Record any pacing/budget amendment before executing it and analyze that protocol separately. Finish the current adapter's seed-300 condition and missing partners only with a recorded attempt/pairing rule, then expand methods/faults/tasks. More evidence is needed before modifying the recovery method itself.

## Software checks

Six pinned-environment controller tests, three matrix-selection tests and nine research API tests passed. These scripted/offline checks verify code paths, not live strategy effectiveness. The backend was restarted with saved campaign-cell support; all four cells are present in its history, with reward-zero completion and ungraded provider failures distinct. Frontend /research and backend /api/health checks returned HTTP 200. Signed-in visual inspection was unavailable.
