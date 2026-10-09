# Controlled recovery on released tau retail tasks

This is our external recovery controller around pinned upstream code, not AgentRx, AgentRewind, AgentDebugX or DGRR. The official task, policy, tools, agent, user simulator and evaluator remain unchanged on disk. Instrumented task execution is a custom controlled-fault extension and is reported separately from unchanged official baseline scores.

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
| Selective recovery | Restore that same safe snapshot, invalidate the source and its dependency descendants, and retain independent validated read-cache entries keyed by tool, arguments, requestor and DB hash. |

Snapshots copy agent state, user state, pending message, routing, conversation, local counters and the complete isolated retail database together. Restoring them never resets global attempt count, wall-clock budget, observed usage, total tool errors or the one-shot injector. Cached messages receive the current call ID and timestamp so official evaluator replay remains well formed. Mutation replay occurs only after restoring the isolated simulated database; production databases/external side effects are unsupported.

Only one recovery event is allowed. Conservative dependencies can make selective and sequential rollback equivalent; the ordinary policy usually requests one tool call at a time, so cache reuse may be zero. The tests exercise independent batch reuse for software correctness, not as an official performance claim.

## Protocol and evidence

[Frozen matrix](tau-recovery-protocol.json): three released task IDs, three fault types, three seeds and six strategies = 162 controlled executions, plus nine unfaulted references. This is a **planned 171-cell matrix**, not completed evaluation. Each live cell has an identical 60-attempt-step, 10-tool-error and 180-second wall budget, at most one recovery, Gemini agent/user at temperature zero, and bounded provider calls. Requested seeds are recorded but do not guarantee identical model output. Hardware/time and user/model nondeterminism remain confounders.

The initial v1 pilot hit the provider per-minute quota on its selective attempt. v2 adds the same six-second delay before every agent/user generation for every strategy; this time counts against the budget. v1 source/protocol and failed outcomes are preserved. Protocol and adapter hashes distinguish versions; do not pool them into one matched comparison.

Save all attempts, partial failed traces, task/configuration, input/source/protocol hashes, final official grading, discarded branches, model usage/cost estimates and validation call counts. Cost estimates are not verified billing. Incomplete usage is marked incomplete. A null reward is an execution/evaluation failure, not an evaluated reward of zero. A run that never reaches the eligible tool is marked fault not exercised, not successful recovery. Report both coverage and the relevant denominators.

## Reproduction commands

From the repository root, materialize the full matrix without model calls:

```powershell
Backend\.venv\Scripts\python Backend/research/tau_recovery_matrix.py
```

Run the two-method pilot, choosing a new output location each time:

```powershell
.research-upstream\tau-bench\.venv\Scripts\python.exe Backend/research/tau_recovery.py --output logs/my-pilot/recovery-results.json
```

Choose any implemented strategy, fixed task/fault/seed through the CLI, or use the **Official-task recovery pilot** site button for the fixed two-method pilot. A complete matrix run is available with `--execute` on the matrix script and invokes 171 live simulations. It is deliberately not an automatic page-load action; budget/quota capacity must support the recorded campaign. The runner writes a fresh plan before execution, retains failed cells and stops if adapter code changes during the campaign.

Official integration tests use scripted speakers and real released tools/evaluator:

```powershell
.research-upstream\tau-bench\.venv\Scripts\python.exe Backend/tests/test_tau_recovery.py
```

These offline software tests are not counted as live research trials. The primary backend test discovery skips them when the optional pinned tau environment is absent.
