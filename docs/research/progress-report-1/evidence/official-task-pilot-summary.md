# Live controlled-fault pilot — October 7, 2026

[Raw paired trial](../../baselines/results/tau-recovery-pilot-paced-20261007/recovery-results.json) includes the exact adapter source, protocol definition/hashes, task, configuration, inputs, attempts, discarded branches, official grading and usage. Public retail task 0, seed 300, first successful user-details read replaced with `{}` once. Both speakers use Gemini 3.5 Flash Lite. Equal six-second generation pacing, 60-attempt-step/180-second budgets and at most one recovery.

| Observed metric | Reference: no added recovery | Selective recovery |
|---|---:|---:|
| Official reward | 1.0 | 1.0 |
| Fault exercised | Yes | Yes |
| Detector matched injected source | Yes | Yes |
| Attempt steps, including discarded work | 21 | 25 |
| Model calls, including discarded work | 15 | 17 |
| Task tool executions | 6 | 8 |
| Validation tool calls | 9 | 9 |
| Cached reads reused | 0 | 0 |
| Estimated attempted model cost, USD | 0.02614170 | 0.02800838 |
| Duration including pacing, seconds | 127.20 | 128.76 |

This is one paired cell. The ordinary model recovered without added rollback. Selective recovery located the earlier inconsistent read and restored the pre-source state, but used more work and did not improve reward. It does not establish general recovery superiority or statistical significance. Cost estimates were not checked against billing.

Earlier sandbox connection failures and the v1 selective quota failure remain in the archive. Their null rewards are ungraded execution failures, not zeros. v1 and paced v2 have different protocols and must not be pooled. The original unchanged official baseline's reward 0.0 is a separate run under different conditions.

The 171-cell matrix is planned; it has not been completed. Full AgentRx diagnosis and signed-in visual browser verification remain blocked/pending. These results support a progress demonstration of implemented recovery mechanics on released tasks with unchanged grading, not completion of the entire research study.
