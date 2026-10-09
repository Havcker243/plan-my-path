# Saved recovery evidence analysis

Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.

Attempts: 27; graded: 23; ungraded: 4; eligible pairs: 1; incomplete/ambiguous pairs: 5.

These are coverage counts across the listed groups, not pooled strategy scores.

## Comparison group 1

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 3 | 1 | 2 | 2 | 0 / 1 |
| restart | 1 | 1 | 0 | 1 | 1 / 1 |
| visible_retry | 1 | 1 | 0 | 1 | 1 / 1 |
| checkpoint | 1 | 1 | 0 | 1 | 0 / 1 |
| source_rollback | 1 | 1 | 0 | 1 | 1 / 1 |
| selective | 2 | 2 | 0 | 2 | 0 / 2 |

Task 0, fault none, seed 301: **missing_or_ambiguous_pair**.


Task 0, fault empty_read, seed 301: **missing_or_ambiguous_pair**.


## Comparison group 2

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 3 | 3 | 0 | 2 | 2 / 2 |
| visible_retry | 1 | 1 | 0 | 1 | 1 / 1 |
| checkpoint | 1 | 1 | 0 | 1 | 1 / 1 |
| source_rollback | 1 | 1 | 0 | 1 | 1 / 1 |
| selective | 2 | 1 | 1 | 2 | 1 / 1 |
| restart | 1 | 0 | 1 | 1 | 0 / 0 |

Task 0, fault none, seed 302: **missing_or_ambiguous_pair**.


Task 0, fault empty_read, seed 302: **missing_or_ambiguous_pair**.


## Comparison group 3

Protocol hash: `35e9cb0079c2050e59594c217312be416a11e733c0372b837f50613197f695e3`

| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |
| --- | ---: | ---: | ---: | ---: | ---: |
| no_recovery | 2 | 2 | 0 | 1 | 1 / 1 |
| selective | 1 | 1 | 0 | 1 | 1 / 1 |
| restart | 2 | 2 | 0 | 2 | 1 / 2 |
| visible_retry | 2 | 2 | 0 | 1 | 0 / 1 |
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

Task 0, fault none, seed 300: **missing_or_ambiguous_pair**.


## Limits

- Different protocol, adapter, input, upstream or configuration records are never pooled.
- Null rewards remain ungraded; reward zero is a graded failure.
- Repeated attempts within one task/fault/seed are retained but not arbitrarily paired.
- Pairs require recorded faults to be exercised and both rewards to be graded.
- Seeds do not guarantee identical provider outputs; these are descriptive comparisons, not causal or significance claims.
- No-recovery success may include ordinary model self-recovery; it is not controller recovery success.

## Input evidence

- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-000.json` — SHA-256 `05f71e52096cb5e37668610cec3ca39606c0bb541244e88b5405073d4a564e7c`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-001.json` — SHA-256 `98094dea77590982cf84a03bce7c982463b22db6c0f38a9041e44b8686f68e7a`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-002.json` — SHA-256 `4984ec3a274134ab7e9210e466bb5d9b5cc0c467084ac93dc6ef9619d9a9666f`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-003.json` — SHA-256 `33e1105100748e080f9548990acf48b7526d73854c76e8450db8a310b3ca647c`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-004.json` — SHA-256 `8acb08d3ec359d372181d5c5ee610cf955c36a51502d8e79704355eac257c13c`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-005.json` — SHA-256 `821466775b7a9e67ef695747580dcdf099bd5908fc706907075031d4c2ae9bcc`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-006.json` — SHA-256 `329d1f89a754c76074f509074f751638dbc759a21afcd220f8b2dcd4fd20af65`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-007.json` — SHA-256 `171a65ef84fa2dd52085067b627d39bc71c89dc404427200ca458762a236099d`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-008.json` — SHA-256 `59094ec7bf229bf0cce551f3abefc3380a85d8bdebd1403067f8775196379776`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-009.json` — SHA-256 `a5e39e973629da283f5490ccbe9b2156d477bfcfbfa09f6d437bc85f7d2351fe`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-010.json` — SHA-256 `c9fc9fbaf9f83bc9b7408fd3d6d8c88933438a013b2e53bc3e006d048f003c08`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-011.json` — SHA-256 `cf20e5455ce64632542956ab5a94829b06135359c5ffa9e18e9f33e4fd20f2e9`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-012.json` — SHA-256 `0acaa9a12e4696a21686a6f134c97da0a866afd2a6181b745aabe0a0713256f6`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044029Z-9f8be5\cell-013.json` — SHA-256 `1b41dda516edea2e7eef4f69409149b5aa5089106f149af22bd300c8daf81e2d`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-000.json` — SHA-256 `59b1ba3c80c649fdfd8e9d05962c7304f60bf6106441083a7dccd04b40134452`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-001.json` — SHA-256 `b2c979c32059d99252d87917fe7499b9cf9463f505338d52d1eb16a326e42411`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-002.json` — SHA-256 `33806bf4f825c91fe70364c84ad8c33298f3d5470c277760afc2b8966c1745f7`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T044036Z-e96b6c\cell-003.json` — SHA-256 `ad45403e902d3b2305d63f79b959e2574ace331fb6a7d3d7ef64f599251911ee`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-000.json` — SHA-256 `aadb44fb7acbd5aefd5a19bcaa9e706fa4245de7e19bdab7e285e89000e4e8dc`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T045409Z-eb491d\cell-001.json` — SHA-256 `7a74a11dfb6d444d22ab4c5e137b416fa876b219201501df0377815be7b76e23`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-000.json` — SHA-256 `8ddacd04d5480925d592265ca874b5a8319073aa0f95fe39eb144c87a873ba99`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-001.json` — SHA-256 `8c7c94dd12cc264dc6a0c238ed4a65bcd945af7a2ae9ed9e26187fc804192fb0`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-002.json` — SHA-256 `6d0cba036522044d9cc87da002278db22a97aee5a6ebe9ab3cd2d6aff03bc44e`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050612Z-2fe24d\cell-003.json` — SHA-256 `64016e3551c3e20e7cf3e719e873f86a2abe7c9a32cf16061e70e11f7713c125`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050946Z-4932e2\cell-000.json` — SHA-256 `f7e2a8923480d1dcd1fcaf82e11f053644288340230ea6a5eecb9c2bf73396bb`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050946Z-4932e2\cell-001.json` — SHA-256 `534c848753eb6e19c70237d231939fbaf426eb929be4ee8625102d489501e2d1`
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261009T050946Z-4932e2\cell-002.json` — SHA-256 `ada43277f314a71406e1dbf812dc3f2be3124fd15aa8a45bd268fba91906da39`
