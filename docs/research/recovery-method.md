# Controlled recovery on released tau retail tasks

This is our external recovery controller around pinned upstream code, not AgentRx, AgentRewind, AgentDebugX or DGRR. The official task, policy, tools, agent, user simulator and evaluator remain unchanged on disk. Instrumented task execution is a custom controlled-fault extension and is reported separately from unchanged official baseline scores.

October 9 redesign: the current protocol is **v3 verified recovery cache**. The previous v2 protocol and all results remain archived. See [design and verification](verified-cache-redesign-20261009.md). The change has offline correctness evidence; earlier live outcomes do not evaluate this version.

## Detection and dependency algorithm

Each agent/user dispatch creates a trace node depending on the full currently observed prefix. Each tool result depends on the dispatch that produced its call and prior writes. Tool calls from the same batch share a producing dispatch; their results do not automatically depend on each other. Unknown semantic independence is treated conservatively.

After at least one downstream orchestrator step, re-execute recorded read calls against the **identical database hash**. Compare canonical JSON content and the error flag. Select the earliest inconsistent observed read as the suspected source. Reads from an older database version are skipped; ordinary legitimate database changes are not treated as corruption. This deterministic consistency detector does not read the injected source label, expected task actions or final evaluator answer. The injector's source node is stored separately for scoring. The detector assumes read determinism and a trustworthy local tool implementation; it does not detect a wrong but internally consistent database or policy.

Compute the transitive descendants of the suspected source by scanning the append-only DAG in topological order. Unknown dependencies over-invalidate rather than claim a minimal boundary. The method finds a conservative safe candidate under these recorded dependencies; global minimality is not established.

## Recovery boundaries

| Strategy | Rule |
|---|---|
| No added recovery | Record detector outcome but continue the ordinary official agent. The model may recover by itself. |
| Full restart | Restore the initial snapshot and discard all observed task outputs. |
| Visible retry | Restore the most recent pre-dispatch snapshot, even if earlier context contains the corruption. |
| Periodic checkpoint | Restore the latest snapshot whose global attempt-step index is a multiple of four, independent of source location. |
| Source rollback | Restore immediately before the suspected source's tool batch and invalidate all later executed nodes. |
| Selective recovery | Restore that same safe snapshot and invalidate the source and its dependency descendants. Separately validate saved non-source, non-error reads against the restored matching DB version; reuse their values only for matching tool/arguments/requestor/DB hash after recovery. This is verified memoization, not proof of independent reasoning. |

Snapshots copy agent state, user state, pending message, routing, conversation, local counters and the complete isolated retail database together. Restoring them never resets global attempt count, wall-clock budget, observed usage, total tool errors or the one-shot injector. Cached messages receive the current call ID and timestamp so official evaluator replay remains well formed. Mutation replay occurs only after restoring the isolated simulated database; production databases/external side effects are unsupported.

Only one recovery event is allowed. Conservative dependencies can make selective and sequential rollback equivalent; the ordinary policy usually requests one tool call at a time, so cache reuse may be zero. The tests exercise independent batch reuse for software correctness, not as an official performance claim.

Pre-recovery reads always execute normally to avoid giving selective recovery an unrelated memoization advantage. Validation overhead is counted, and `total_tool_invocations` includes execution plus validation. A reused value can avoid a replay call while still offering no net savings after validation. These tools execute locally; cache reuse is not itself a saved model/API call.

## Protocol and evidence

[Recorded matrix](tau-recovery-protocol.json): three released task IDs, three fault types, three seeds and six strategies = 162 controlled executions, plus nine unfaulted references. This is a **planned 171-cell matrix**, not completed evaluation. Each live cell has an identical 60-attempt-step, 10-tool-error and nominal 180-second cooperative timeout, at most one recovery, Gemini agent/user at temperature zero, and bounded provider calls. The timeout is not a hard deadline; report overruns alongside preserved official scores. Requested seeds are recorded but do not guarantee identical model output. Hardware/time and user/model nondeterminism remain confounders.

The initial v1 pilot hit the provider per-minute quota on its selective attempt. v2 adds the same six-second delay before every agent/user generation for every strategy; this time counts against the budget. v1 source/protocol and failed outcomes are preserved. Protocol and adapter hashes distinguish versions; do not pool them into one matched comparison.

Save all attempts, partial failed traces, task/configuration, input/source/protocol hashes, final official grading, discarded branches, model usage/cost estimates and validation call counts. Cost estimates are not verified billing. Incomplete usage is marked incomplete. A null reward is an execution/evaluation failure, not an evaluated reward of zero. A run that never reaches the eligible tool is marked fault not exercised, not successful recovery. Report both coverage and the relevant denominators.

## Reproduction commands

Analyze preserved pilot attempts without new model calls:

```powershell
Backend\.venv\Scripts\python Backend/research/analyze_recovery.py --inputs docs/research/baselines/results/tau-recovery-pilot-network-20261007/recovery-results.json docs/research/baselines/results/tau-recovery-pilot-paced-20261007/recovery-results.json docs/research/baselines/results/tau-recovery-pilot-sandbox-20261007/recovery-results.json --output-dir logs/new-recovery-analysis
```

The output directory must be new. The analyzer separates recorded protocol, adapter, configuration, upstream and input versions, reports graded/ungraded and fault-coverage denominators, and only computes paired deltas when there is exactly one graded, fault-exercised reference and selective attempt for a task/fault/seed. Duplicate attempts remain visible rather than choosing a favorable pair. These provenance checks are necessary for comparison but do not control unrecorded provider or hardware differences. See the [all-attempts analysis](evidence/recovery-analysis-all-attempts-20261008/summary.md). The single eligible paced pair has equal reward and greater selective work; no advantage or statistical significance is established.

From the repository root, materialize the full matrix without model calls:

```powershell
Backend\.venv\Scripts\python Backend/research/tau_recovery_matrix.py
```

Run the two-method pilot, choosing a new output location each time:

```powershell
.research-upstream\tau-bench\.venv\Scripts\python.exe Backend/research/tau_recovery.py --output logs/my-pilot/recovery-results.json
```

Choose any implemented strategy, fixed task/fault/seed through the CLI, or use the **Official-task recovery pilot** site button for the fixed two-method pilot. A complete matrix run is available with `--execute` on the matrix script and invokes 171 live simulations. It is deliberately not an automatic page-load action; budget/quota capacity must support the recorded campaign. The runner writes a fresh plan before execution, retains failed cells and stops if adapter code changes during the campaign.

The matrix runner also accepts a bounded selection while preserving the full protocol's seed ordering. Materialize the next four-cell subset without API calls:

```powershell
Backend\.venv\Scripts\python Backend/research/tau_recovery_matrix.py --tasks 0 --seeds 301 302 --faults empty_read --strategies no_recovery selective --skip-unfaulted
```

Add `--execute` only to execute that selection. The generated manifest distinguishes selected cells from the 171-cell full plan and freezes source/protocol copies and hashes. An adapter or protocol change stops remaining cells. Existing outputs are preserved. Subset selection does not create a new official benchmark; the two-method subset's ordering is not balanced even though it follows the full six-method rotation. Completed CLI cells become available as saved runs in the Research Lab after backend reload; incomplete files are excluded.

Official integration tests use scripted speakers and real released tools/evaluator:

```powershell
.research-upstream\tau-bench\.venv\Scripts\python.exe Backend/tests/test_tau_recovery.py
```

These offline software tests are not counted as live research trials. The primary backend test discovery skips them when the optional pinned tau environment is absent.
