# Selective Recovery Demo Plan

October 7 update: the user requires reproduction of published methods on released benchmarks before custom developments. This file's custom Demo 1 plan is historical and superseded as the primary evaluation. Demo 0 remains a mechanism illustration. Current targets, commands, access limitations, and evidence are in [baselines/README.md](baselines/README.md); decisions are in [assumptions.md](assumptions.md).

Last updated: September 15, 2026

## Purpose

The demo should make the research question visible without pretending that one successful run is evidence. It will show a delayed academic-planning error, the execution dependencies that carried the error forward, and the different amounts of work repeated by competing recovery strategies.

## Demo 0: Existing Deterministic Prototype

The current `Backend/research/benchmark.py` creates one synthetic workflow:

1. Read a synthetic student record.
2. Read synthetic degree requirements.
3. Compute remaining courses, injecting an incorrect empty result on the first run.
4. Read the catalog and sections on an independent branch.
5. Create a proposal from the corrupted result.
6. Detect the problem during final deterministic validation.
7. Apply restart, visible-step retry, checkpoint, source-suffix rollback, or selective dependency recovery.

This demo is useful for explaining the mechanism. It is not a research result because there is only one hand-built fault, the graph is known, localization is deterministic, and no Gemini call is measured.

Run it from `Backend` with:

```powershell
.\.venv\Scripts\python -m research.benchmark --output ../logs/recovery-benchmark.json
```

## Live Agent and Recovery Checks

`Backend/research/demo.py` runs the real Gemini planning loop against synthetic student, requirement, and catalog tools. The fixture data and rules are fixed, but the expected course plan is not stored in the demo: Gemini selects tools and submits its proposal at runtime, then ordinary code validates it.

`Backend/research/agent_recovery_demo.py` tests the missing recovery step. The harness injects an incorrect intermediate result and keeps the true source label outside the model input. Gemini receives only the observable execution steps, dependencies, values, and final validator violation. It returns a typed source-step prediction; the graph computes the invalidation closure and reruns affected work. Scores are calculated against the hidden source and affected set.

Run three recovery attempts from `Backend` with:

```powershell
.\.venv\Scripts\python -m research.agent_recovery_demo --runs 3 --delay-seconds 20 --model gemini-3.5-flash-lite --output ../logs/agent-recovery-runs.json
```

The September 15 smoke test completed three of three calls. All predictions selected step `3`, exactly matching the hidden source. Each recovery repeated three steps, preserved four valid steps, achieved invalidation precision/recall/F1 of `1.0`, and produced a valid result. The runs used 868, 856, and 852 recorded tokens.

This verifies the live localization-to-recovery path for one controlled trace. It is not a general accuracy result because the same fault and graph were repeated. Demo 1 must vary fault class, location, trajectory length, and dependency shape.

## Demo 1: Minimum Research Demo

The next implementation should contain a small frozen benchmark rather than a live database experiment.

### Workflow

- Parse a synthetic transcript JSON document into completed-course records.
- Load a versioned requirement snapshot.
- Compute completed and remaining requirement groups.
- Load catalog facts for two independent subject branches.
- Ask Gemini to produce a two-semester proposal through the typed `propose_plan` tool.
- Run deterministic prerequisite, duplication, completed-course, credit-load, and supported requirement checks.

### Controlled faults

Start with four fault classes and at least three scenarios per class:

- Corrupt one parsed transcript course or status.
- Omit or alter one requirement mapping.
- Return stale or malformed catalog information.
- Make the planning step misinterpret a correct tool result.

The experiment harness records the injected source and true affected closure. The recovery method must not receive those labels.

### Recovery conditions

- Full restart.
- Retry only the visible validator step.
- Restore the most recent checkpoint.
- Replay the complete suffix from a predicted source.
- Selectively recompute the predicted dependency closure.
- Selective recomputation with an oracle source, to isolate planner quality.

### Required output

For each run, show:

- a step timeline with model and tool nodes;
- explicit dependency edges;
- the injected source, predicted source, and visible failure;
- invalidated, recomputed, and reused nodes;
- final validator result;
- exact-source and safe-boundary accuracy;
- invalidation precision, recall, and F1;
- repeated steps, valid work preserved, model/tool calls, tokens, latency, and estimated cost.

## Demonstration Story

The clearest live presentation is one branching example:

1. The transcript and requirements are correct.
2. The remaining-requirements step incorrectly omits `CSCI-201`.
3. A separate catalog/section lookup remains correct and independent.
4. The proposal contains `CSCI-301` too early.
5. The validator exposes the prerequisite violation several steps after its source.
6. Retrying validation fails, checkpoint recovery retains the bad intermediate result, and suffix rollback repeats the independent branch.
7. Selective recovery invalidates the bad result and its descendants while reusing the independent catalog work.

The UI or CLI must label the injected source only after the recovery prediction is recorded, so the audience can see that the method was not given the answer.

## Information and Artifacts

- [AgentRx code](https://github.com/microsoft/AgentRx): trajectory normalization, guarded constraints, validation logs, and localization reports.
- [AgentRx dataset](https://huggingface.co/datasets/microsoft/AgentRx): JSON trajectories and ground-truth failure annotations; access currently requires accepting its terms.
- [Dependency-Guided Rollback Repair](https://arxiv.org/html/2608.10502v1): typed provenance, independent support, affected closure, and recovery metrics. No clearly linked public implementation was found in the September 15 search.
- [AgentRewind](https://arxiv.org/html/2608.14380): aligned agent/environment checkpoints and partial-progress evaluation.
- [ReflectAgent](https://openreview.net/pdf?id=hV2YxBlo0g): anomaly scoring, post-hoc dependency construction, root localization, and suffix rollback.
- [FiskGrad literature notes](literature-notes.md): claim-level comparisons, limitations, and the novelty audit.

## Two-Hour Build Order

1. Freeze 12 synthetic scenarios and a JSON schema for fault metadata.
2. Refactor the existing one-off benchmark into a scenario runner without changing the production agent.
3. Add exact-source, closure precision/recall/F1, repeated-work, and preservation metrics.
4. Run all deterministic baselines and export one JSONL result per run.
5. Add Gemini only to the proposal/localization conditions after deterministic scoring works.
6. Produce a compact terminal table and retain every sanitized trace for later analysis.

## Stop Conditions

Do not use real student data, call this an official degree audit, or report the synthetic timings as meaningful performance results. Do not claim algorithmic novelty unless the proposed method beats a straightforward combination of constraint evidence and an existing dependency-closure planner.
