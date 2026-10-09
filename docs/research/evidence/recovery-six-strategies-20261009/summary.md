# Saved recovery evidence analysis

Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.

Attempts: 6; graded: 6; ungraded: 0; eligible pairs: 1; incomplete/ambiguous pairs: 0.

These are coverage counts across the listed groups, not pooled strategy scores.

## Comparison group 1

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 1 | 1 | 0 | 1 | 1 / 1 |
| selective | 1 | 1 | 0 | 1 | 1 / 1 |
| restart | 1 | 1 | 0 | 1 | 1 / 1 |
| visible_retry | 1 | 1 | 0 | 0 | 0 / 0 |
| checkpoint | 1 | 1 | 0 | 1 | 1 / 1 |
| source_rollback | 1 | 1 | 0 | 1 | 1 / 1 |

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

- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-000.json` — SHA-256 `aadb44fb7acbd5aefd5a19bcaa9e706fa4245de7e19bdab7e285e89000e4e8dc`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-001.json` — SHA-256 `7a74a11dfb6d444d22ab4c5e137b416fa876b219201501df0377815be7b76e23`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-000.json` — SHA-256 `8ddacd04d5480925d592265ca874b5a8319073aa0f95fe39eb144c87a873ba99`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-001.json` — SHA-256 `8c7c94dd12cc264dc6a0c238ed4a65bcd945af7a2ae9ed9e26187fc804192fb0`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-002.json` — SHA-256 `6d0cba036522044d9cc87da002278db22a97aee5a6ebe9ab3cd2d6aff03bc44e`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-003.json` — SHA-256 `64016e3551c3e20e7cf3e719e873f86a2abe7c9a32cf16061e70e11f7713c125`
