# Current-adapter recovery findings — October 8, 2026

## Fresh matched pair

The [predeclared seed-300 continuation](../../seed300-continuation-20261008.md) ran once per strategy, reference first then selective, using the existing v2 protocol and unchanged current adapter. Both tasks exercised the injected empty-read fault and received official reward 1.0. Campaign: [recorded matrix](../../baselines/results/tau-matrix-20261009T045409Z-eb491d/matrix.json).

| Measure | No recovery controller | Selective recovery |
| --- | ---: | ---: |
| Official reward | 1.0 | 1.0 |
| Attempt steps | 23 | 23 |
| Model calls | 16 | 16 |
| Tool executions | 7 | 7 |
| Validation calls | 9 | 9 |
| Cached reads reused | 0 | 0 |
| Duration, seconds | 121.54 | 121.34 |

The 0.20-second duration difference is one descriptive observation, not evidence of a speed advantage. Equal call counts also do not imply equal token usage or estimated cost; the recorded estimated selective cost is approximately $0.001184 greater. These are estimates, not verified bills. No recovery controller does not mean the model cannot correct itself.

## All current-adapter attempts

[Generated analysis](summary.md) includes all six attempts from the two campaigns: four graded, two quota errors/ungraded, one eligible matched pair and two incomplete pairs. Both earlier quota errors remain in coverage counts; the seed-301 selective reward-zero case remains a graded failure. The older seed-300 pilot used different adapter bytes and is not included as an additional matched replication.

The current evidence establishes integration and one successful comparison, not general reliability or improvement. This is six attempted cells from the current 171-cell design, including only four graded cells; 165 cells have not been attempted under this adapter. These counts include no unfaulted reference trials. The fault protocol is our controlled extension, not an official recovery benchmark.

## Failure investigation completed

The earlier [failure inspection](../recovery-subset-20261008/failure-inspection.md) found simulated-user STOP at exchange confirmation before the required write. Raw reward remains zero. A scripted, no-fault test reproduced that termination mechanism; it is not counted as a live performance trial and does not prove that recovery caused the premature stop.

## Next research work

Complete first attempts for the other four strategies on task 0 / empty_read / seed 300 under the same current adapter/protocol; then add fault types and tasks according to the frozen matrix. Do not select cases because they make selective recovery look better. Any continuation of provider-failed cells needs new attempt identities and a pairing rule declared before execution. Separately continue faithful published-method reproduction when supported access is available. Keep comprehensive Fisk validation pending until unresolved catalog rules are reviewed.

Checks in this stage: seven pinned-controller integration tests and six saved-analysis tests passed. These are software checks, not 13 additional research trials. Both fresh cells are visible in the backend's saved-run history.
