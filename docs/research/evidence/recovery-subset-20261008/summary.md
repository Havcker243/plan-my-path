# Saved recovery evidence analysis

Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.

## Comparison group 1

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| selective | 1 | 1 | 0 | 1 | 0 / 1 |
| no_recovery | 1 | 0 | 1 | 1 | 0 / 0 |

Task 0, fault empty_read, seed 301: **ungraded_or_fault_not_exercised**.


## Comparison group 2

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| selective | 1 | 0 | 1 | 1 | 0 / 0 |
| no_recovery | 1 | 1 | 0 | 1 | 1 / 1 |

Task 0, fault empty_read, seed 302: **ungraded_or_fault_not_exercised**.


## Limits

- Different protocol, adapter, input, upstream or configuration records are never pooled.
- Null rewards remain ungraded; reward zero is a graded failure.
- Repeated attempts within one task/fault/seed are retained but not arbitrarily paired.
- Pairs require recorded faults to be exercised and both rewards to be graded.
- Seeds do not guarantee identical provider outputs; these are descriptive comparisons, not causal or significance claims.
- No-recovery success may include ordinary model self-recovery; it is not controller recovery success.

## Input evidence

- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-000.json` — SHA-256 `59b1ba3c80c649fdfd8e9d05962c7304f60bf6106441083a7dccd04b40134452`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-001.json` — SHA-256 `b2c979c32059d99252d87917fe7499b9cf9463f505338d52d1eb16a326e42411`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-002.json` — SHA-256 `33806bf4f825c91fe70364c84ad8c33298f3d5470c277760afc2b8966c1745f7`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-003.json` — SHA-256 `ad45403e902d3b2305d63f79b959e2574ace331fb6a7d3d7ef64f599251911ee`
