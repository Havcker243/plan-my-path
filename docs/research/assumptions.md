# Research Assumptions and Decisions

Started October 7, 2026. Record assumptions before coding against them. Every entry identifies its status, evidence, consequence, and a condition that would require revision. A working implementation does not validate an assumption automatically.

| ID | Status | Assumption or decision | Evidence and consequence | Revisit when |
| --- | --- | --- | --- | --- |
| A01 | User requirement | Reproduce a published method on released, recognized benchmark data before evaluating our own modifications. | User instruction, October 7. Existing custom demonstrations are mechanism checks only, not the primary research benchmark. | User/instructor changes the evaluation requirement. |
| A02 | Selected reproduction target | AgentRx is the initial diagnosis baseline. Use its official implementation unchanged and pin the revision. | [Official code](https://github.com/microsoft/AgentRx), [paper v2](https://arxiv.org/abs/2602.02475v2). Preprocessing alone is not a diagnosis reproduction. | Full pipeline or annotated dataset is inaccessible. |
| A03 | Verified access limitation | The full AgentRx dataset requires accepting contact-sharing/access conditions. | [Dataset card](https://huggingface.co/datasets/microsoft/AgentRx), checked October 7. Public GitHub samples are a setup subset, not the full 170-trajectory paper benchmark. Do not accept terms on the user's behalf. | User obtains authorized dataset access. |
| A04 | Evaluation boundary | Failure-localization data cannot alone establish selective recovery success. | AgentRx supplies trajectories and failure annotations, not a resettable academic environment. Report diagnosis accuracy separately from environment-graded recovery. | A released artifact provides faithful replay and state reset. |
| A05 | Selected environment candidate | Use maintained official tau-bench text tasks for an executable tool-agent baseline; preserve task definitions, policies, and evaluator. | [Maintained repository](https://github.com/sierra-research/tau2-bench). Legacy tau-bench README directs users to the maintained version. Pin code/data together; never mix scores between versions. | Compatibility, grading issues, or task access prevent a faithful run. |
| A06 | Explicit deviation | Gemini on an upstream benchmark is a model substitution, not reproduction of the paper's reported model scores. | Local project has Gemini access. Keep model IDs, agent/user models, settings, and provider failures in run artifacts. | Matching paper-model access becomes available. |
| A07 | Scope decision | No custom fault injection, recovery modification, or academic-domain port in the initial official baseline. | Establish an unmodified reference first. Modified-task scores must later be labeled a derived benchmark condition. | Baseline has been verified and extension protocol frozen. |
| A08 | Metric boundary | Official task reward and benchmark aggregation remain authoritative; custom recovery metrics are secondary. | Do not replace the released evaluator with the prototype validator. One task/trial is installation evidence, not a benchmark-wide score. | A preregistered extension needs additional metrics. |
| A09 | Unverified capability | Arbitrary tool calls can safely be replayed after selective invalidation. | Not established. Existing prototype only replays pure/read-only fixture work. Writes require environment restoration or proven replay semantics before extension. | Reset/replay behavior is tested against the official environment. |
| A10 | Research claim boundary | Minimal safe recovery and novelty are hypotheses, not established results. | Existing dependency-aware recovery literature overlaps with the design. A safe conservative closure is not proof of globally minimal replay. | Direct comparisons and a technical argument support a stronger claim. |
| A11 | Isolation decision | Keep upstream source and dependencies isolated from FiskGrad production code. | Checkouts live in ignored `.research-upstream/`; tracked manifests record revisions, commands, hashes, and outputs. | Integration is explicitly required. |
| A12 | Pending protocol | Task selection, repeated trials, models, budgets, and exclusions for the comparative study are not frozen. | Initial public samples and a first task are setup checks only. Do not select final cases based on favorable outcomes. | Official baseline is runnable and an experiment protocol is approved. |

## October 7 access/implementation notes

The current AgentRx source adds a Copilot endpoint and defaults to it; its README still emphasizes Azure/TRAPI. Offline IR normalization can be run without invoking a model. Any use of Copilot or Azure for full diagnosis needs verified access and a recorded model configuration. No Gemini adapter is silently substituted into AgentRx.

The maintained tau-bench checkout identifies itself as package version 1.0.1 / tau3-era code, while retaining the repository name `tau2-bench` and CLI `tau2`. Record the exact commit rather than relying on the product name alone.

Offline data verification and all 15 official retail-tool tests passed. The first official retail task-0 Gemini run completed but earned reward 0.0 with database mismatch; retain this outcome as the first baseline observation. Do not redefine task success or replace the task to obtain a favorable result. No root-cause diagnosis or selective-recovery improvement has yet been measured on that official task.

Python 3.13 setup required official voice/knowledge dependency extras plus `audioop-lts==0.2.2`; these are environment deviations from a core-only install. The benchmark source remained unchanged. Upstream-reported costs are estimates and have not been checked against provider billing.

# Site integration assumptions — October 7, 2026

- A13: The site is an experiment interface, not a new benchmark. Official setup stages, official evaluated tasks, and synthetic recovery trials retain distinct evidence scopes and comparison groups. No cross-suite ranking is valid. Revisit after adapting selective recovery to the same released tasks and evaluator as the baseline.
- A14: Initial research execution is local, Windows, single-worker, and restricted to verified Fisk login emails explicitly listed by the backend operator. One process-local lock serializes runs; persistent job files are not a distributed scheduler. Keep public execution disabled until a worker queue, durable storage, quotas and deployment dependencies are implemented.
- A15: Live site controls use one fixed Gemini 3.5 Flash Lite trial. This is a reproducibility/smoke-test choice, not a power analysis or paper-model reproduction. No statistical superiority claims follow. Official reward zero remains zero even when the process exits successfully.
## Official-task extension assumptions — October 7, 2026

- A16: Released tasks/evaluator plus researcher-defined faults are a controlled extension, not an official recovery benchmark or reproduction of named recovery papers. Full AgentRx is access-blocked; the custom adapter does not satisfy published-method reproduction.
- A17: Version-matched read re-execution assumes deterministic reads and trustworthy local tools/database. The detector excludes injected labels and expected actions. It cannot identify internally consistent wrong policies/database contents.
- A18: Conservative dependencies can make selective and source rollback equivalent. Single-tool calls may provide no independent cache work. The pilot's equal reward and greater selective work must be retained; do not tune selection to force an advantage.
- A19: v2 adds fixed six-second pacing after a v1 quota failure. All methods/participants receive the same delay within wall time. Keep versions/source hashes separate. The 171-cell matrix is planned, not completed.
- A20: Fisk 2024–2025 is explicitly selected, not assumed current/cohort-applicable. Catalog ambiguities and incomplete prerequisites/non-course approvals prevent graduation clearance. Synthetic elective credits do not prove requirement satisfaction. Production rules require review before replacement.
