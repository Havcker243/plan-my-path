# Recovery evidence snapshot

Created: 2026-10-23T06:24:08.061732+00:00

Attempts: 444; graded: 187; ungraded: 257; condition groups: 20.

[Interactive results](results_dashboard.html), [report and source hashes](report.json), [attempts](results_table.csv), [summaries](summary_table.csv), [contrasts](matched_comparisons.csv).

## Limits

- Only completed cell artifacts are included; excluded/in-progress files are listed explicitly.
- Full protocol, adapter, input, configuration and upstream identity, and task identity remain separate.
- Missing or inconsistent provenance cannot establish a matched comparison.
- Null rewards are ungraded, never reward zero. A fired fault need not affect downstream behavior.
- Unfaulted references are summarized separately and never enter recovery contrasts.
- Descriptive means retain repetitions; repeated identities cannot be arbitrarily paired.
- Each contrast needs exactly one attempt per method, both graded with the fault exercised.
- Positive deltas mean candidate minus reference. Contrasts share attempts and are not independent samples.
- Seeds do not guarantee identical model/user trajectories; no causal or significance claim is made.
- Work means use graded covered attempts with measurements; missing overhead is never zero.

## Excluded files

- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261021T034127Z-1a0699\cell-035.json`: unfinished_artifact
- `C:\Users\dolap\Desktop\Projects\plan-my-path\docs\research\baselines\results\tau-matrix-20261022T053348Z-ffed13\cell-013.json`: unfinished_artifact
