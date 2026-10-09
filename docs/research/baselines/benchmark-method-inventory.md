# Public Benchmark and Method Inventory

October 8 update: a later unchanged retail task-0 baseline earned reward 1.0 (site run 2520ed051f2d414c9e01d463335d335f); the earlier reward-zero and infrastructure-error attempts remain retained. The rows below describing the first October 7 task failure are historical observations, not the latest execution status. Controlled-recovery evidence now has a reproducible [analysis of all three saved pilot artifacts](../evidence/recovery-analysis-all-attempts-20261008/summary.md), with protocol versions separated and ungraded attempts retained. This analysis adds no new live trials or published-method reproduction.

Latest October 7 addition: the custom recovery adapter now runs controlled faults on official retail tasks with unchanged grading. The paced pilot earned reward 1.0 for both methods, with greater work/cost for selective; this establishes integration, not superiority. The full matrix remains planned. AgentRx all-stage runner/dependencies are prepared but provider access remains blocked. Original unchanged reference reward 0.0 is preserved. See [recovery boundaries](../recovery-method.md).

Verified October 7, 2026. Public availability, local installation, successful execution, and reproduction of published results are different statuses. An entry here is not a claim that the full experiment has been reproduced.

## Benchmark resources

| Resource | Evaluation target | Local status | Limits |
| --- | --- | --- | --- |
| [AgentRx annotated benchmark](https://huggingface.co/datasets/microsoft/AgentRx) and [official code](https://github.com/microsoft/AgentRx) | Failure localization and classification on existing failed trajectories | Official code downloaded and pinned; seven released tau-retail samples normalized | Full annotated dataset is gated; no diagnosis scores or full dataset reproduction yet |
| [Maintained tau-bench](https://github.com/sierra-research/tau2-bench) | Tool-agent-user interaction with released tasks, policies, and official grading | Downloaded/pinned; data check and 15 retail-tool tests passed; one live retail task graded reward 0.0 | One Gemini-substituted task/trial is setup evidence, not full benchmark results or recovery-method reproduction |
| [AgentBench / AgentBench FC](https://github.com/THUDM/AgentBench) | Agent interaction across multiple environments, including databases and operating systems | Official repository reviewed; not downloaded or executed | Current function-calling edition differs from original versions; choose/pin one and assess container requirements before use |
| [WebArena](https://github.com/web-arena-x/webarena) | Browser-agent tasks in reproducible web environments | Official repository identified/reviewed; not downloaded or executed | Browser/site setup and state restoration must be assessed; no local result claimed |

Airline and retail are different tau-bench domains, not two independent benchmark suites. AgentRx's tau-derived trajectories also overlap in domain with tau-bench; do not describe this pair as fully independent evidence of cross-domain generalization. None of the above is an official Fisk academic-planning benchmark.

## Published method candidates

| Method | What it contributes | Local reproduction status |
| --- | --- | --- |
| Official tau-bench `llm_agent` | Tool-calling agent reference with official user simulator and grading | Executed unchanged on one official task, with explicit Gemini model substitution; task failed |
| [AgentRx](https://arxiv.org/abs/2602.02475v2) | Constraint synthesis/checking and evidence-assisted failure localization | Only official IR preprocessing executed; full diagnosis pending access |
| [AgentRewind](https://arxiv.org/abs/2608.14380) | Recoverable execution using aligned agent/environment checkpoints | Literature candidate; no reproduction executed |
| [AgentDebugX](https://arxiv.org/abs/2607.18754) | Failure observability, attribution, and recovery framework | Literature candidate; no reproduction executed |
| [Dependency-Guided Rollback Repair](https://arxiv.org/abs/2608.10502v1) | Provenance-based affected-state handling and selective replay from diagnosed memory faults | Literature candidate; no official artifact reproduction executed |

The old custom restart/retry/checkpoint/suffix/selective implementations are local engineering comparisons. They are not reproductions of these named systems. Keep that distinction in the report and video.

## Selection rule

October 8 literature expansion: [DoVer](https://arxiv.org/html/2512.06749) and its [official implementation](https://github.com/microsoft/ACV/tree/main/misc/DoVer), plus [DARC](https://arxiv.org/html/2608.11772), were reviewed as additional diagnosis/recovery candidates. AgentRewind's author-linked [recorder](https://github.com/Futuresis/replay-agent-recorder) and [MettleBench](https://github.com/Kelvin-Coffee/MettleBench) were located. None was installed or reproduced in this stage. See the [dated comparison and scope implications](../literature-update-20261008.md); MettleBench is a recent public research release, not claimed to be a widely adopted standard.

Establish one faithful diagnosis baseline and one executable task baseline first. Add a distinct public environment only after checking reset/replay semantics, hardware requirements, model access, grading, license, and cost. Do not download numerous suites merely to claim benchmark coverage. Each selected method needs its paper version, source revision, dataset/split, prompt/model configuration, budget, metric definitions, and deviations recorded before comparison. No custom recovery modification is part of the current official reference run.
