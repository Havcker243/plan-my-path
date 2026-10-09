# Six-strategy continuation: task 0, seed 300

Recorded October 9, 2026. These are custom recovery controllers on released retail data and the unchanged official evaluator. They are not reproductions of named published recovery methods.

This table follows the predeclared fresh seed-300 pair and four-strategy continuation. Other attempts remain in the all-completed snapshot; they are not silently replaced by this table.

| Strategy | Official reward | Fault exercised | Steps | Model calls | Tool executions | Duration (s) | Cached reads reused |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 1.0 | True | 23 | 16 | 7 | 121.54 | 0 |
| restart | 1.0 | True | 33 | 23 | 10 | 196.29 | 0 |
| visible_retry | 1.0 | False | 17 | 12 | 5 | 92.95 | 0 |
| checkpoint | 1.0 | True | 25 | 17 | 8 | 130.33 | 0 |
| source_rollback | 1.0 | True | 23 | 16 | 7 | 125.09 | 0 |
| selective | 1.0 | True | 23 | 16 | 7 | 121.34 | 0 |

Interpretation:

- A reward of 1.0 indicates official task success. Visible retry did not exercise the planned fault, so its success is not recovery evidence.
- No-recovery and selective used equal steps/model/tool counts; zero cached-read reuse does not demonstrate selective work savings.
- Restart exceeded the nominal 180-second budget. Upstream checking is cooperative and skips already-done conversations. Preserve the score, but do not claim success within a hard 180-second deadline.
- The seed does not guarantee identical model outputs or fault positions. Concurrent campaigns were found during execution; provider traffic was not isolated.
- This is one task/fault/seed condition. Do not infer statistical superiority or general recovery reliability.

Evidence:

- [no_recovery raw record](../../baselines/results/tau-matrix-20261009T045409Z-eb491d/cell-000.json)
- [selective raw record](../../baselines/results/tau-matrix-20261009T045409Z-eb491d/cell-001.json)
- [restart raw record](../../baselines/results/tau-matrix-20261009T050612Z-2fe24d/cell-000.json)
- [visible_retry raw record](../../baselines/results/tau-matrix-20261009T050612Z-2fe24d/cell-001.json)
- [checkpoint raw record](../../baselines/results/tau-matrix-20261009T050612Z-2fe24d/cell-002.json)
- [source_rollback raw record](../../baselines/results/tau-matrix-20261009T050612Z-2fe24d/cell-003.json)
- [Predeclared continuation and limitations](../../four-strategy-continuation-20261009.md)
- [All completed current-adapter attempts](../recovery-all-completed-20261009/summary.md)
