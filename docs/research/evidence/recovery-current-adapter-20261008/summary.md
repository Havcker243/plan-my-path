# Saved recovery evidence analysis

Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.

Attempts: 6; graded: 4; ungraded: 2; eligible pairs: 1; incomplete/ambiguous pairs: 2.

These are coverage counts across the listed groups, not pooled strategy scores.

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


## Comparison group 3

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 1 | 1 | 0 | 1 | 1 / 1 |
| selective | 1 | 1 | 0 | 1 | 1 / 1 |

Task 0, fault empty_read, seed 300: **eligible**.

- reward: +0
- total_attempt_steps: +0
- model_calls: +0
- tool_executions: +0
- validation_tool_calls: +0
- cached_reads_reused: +0
- duration: -0.198933
- estimated_attempt_cost_usd: +0.00118385

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
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-000.json` — SHA-256 `aadb44fb7acbd5aefd5a19bcaa9e706fa4245de7e19bdab7e285e89000e4e8dc`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-001.json` — SHA-256 `7a74a11dfb6d444d22ab4c5e137b416fa876b219201501df0377815be7b76e23`
