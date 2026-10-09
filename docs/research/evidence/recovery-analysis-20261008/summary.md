# Saved recovery evidence analysis

Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.

## Comparison group 1

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 1 | 1 | 0 | 1 | 1 / 1 |
| selective | 1 | 1 | 0 | 1 | 1 / 1 |

Task 0, fault empty_read, seed 300: **eligible**.

- reward: +0
- total_attempt_steps: +4
- model_calls: +2
- tool_executions: +2
- validation_tool_calls: +0
- cached_reads_reused: +0
- duration: +1.56215
- estimated_attempt_cost_usd: +0.00186668

## Limits

- Different protocol, adapter, input, upstream or configuration records are never pooled.
- Null rewards remain ungraded; reward zero is a graded failure.
- Repeated attempts within one task/fault/seed are retained but not arbitrarily paired.
- Pairs require recorded faults to be exercised and both rewards to be graded.
- Seeds do not guarantee identical provider outputs; these are descriptive comparisons, not causal or significance claims.
- No-recovery success may include ordinary model self-recovery; it is not controller recovery success.

## Input evidence

- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-recovery-pilot-paced-20261007\recovery-results.json` — SHA-256 `203a384d46b5b62b2836180d4eb781c788c0f23bfe0924f18a4893225784b452`
