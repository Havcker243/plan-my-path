# Literature Notes: Reliable Recovery for Tool-Using AI Agents

Researcher: Oludolapo Adegbesan  
Course: Senior Seminar II  
Last updated: September 15, 2026

## Purpose

These notes map existing approaches before FiskGrad's recovery method is finalized. The central concern is not merely whether an agent can retry. It is whether a system can detect a delayed failure, locate the responsible earlier state, preserve independent valid work, and recompute an appropriate affected region.

The original question was:

> How can a tool-using AI agent automatically determine the smallest safe recovery boundary after a failure?

That wording is now provisional. Recent work addresses almost the same problem. The novelty audit below must be completed before making a contribution claim.

## Working Vocabulary

- **Agent trajectory:** An ordered record of model decisions, tool calls, observations, and state changes.
- **Failure manifestation:** The step where a problem becomes observable, such as a final validator rejecting a plan.
- **Root-cause step:** The earlier step that first introduced the error.
- **Checkpoint recovery:** Restore a saved state and replay later execution.
- **Suffix rollback:** Re-execute every step after a selected point.
- **Selective recovery:** Invalidate and recompute only affected nodes or branches while retaining independent valid results.
- **Provenance:** Machine-readable evidence describing where a value came from and which earlier values it used.
- **Safe reuse:** Reusing a prior result only when its inputs, dependencies, external assumptions, and relevant environment state remain valid.
- **Deterministic validator:** Code whose output follows explicit rules rather than an LLM judgment, such as a prerequisite or credit-load checker.

## Literature Map

| Work | Category | Main mechanism | Recovery granularity | Detection/localization | Relevance and limitation |
|---|---|---|---|---|---|
| [Program Slicing (Weiser, 1984)](https://doi.org/10.1109/TSE.1984.5010248) | Software analysis | Computes statements relevant to a value at a program point | Statement slice | Static data/control dependence | Supplies the classical idea behind an affected dependency closure, but assumes analyzable program semantics rather than LLM reasoning and opaque tools. |
| [Dynamic Program Slicing (Agrawal and Horgan, 1990)](https://doi.org/10.1145/93548.93576) | Software analysis | Restricts a slice to dependencies observed for one execution/input | Executed statement slice | Runtime execution dependence | More closely matches trajectory-specific recovery, but an agent trace does not automatically expose every semantic dependency. |
| [Rollback-Recovery Survey (Elnozahy et al., 2002)](https://www.cs.rice.edu/~dbj/pubs/csur-rollback.pdf) | Fault tolerance | Classifies checkpoint- and log-based restoration and rollback propagation | Process/checkpoint/event | Failure model plus recorded recovery state | Establishes that dependencies can force otherwise healthy processes to roll back and that nondeterministic events must be logged for replay. |
| [Database Provenance Survey (Cheney et al., 2009)](https://doi.org/10.1561/1900000006) | Data provenance | Distinguishes why, how, and where provenance | Query result/data item | Query lineage | Grounds the use of provenance for debugging and update propagation, while agent state includes unstructured claims and external effects. |
| [Provenance-Based Workflow Recovery (Kohler et al., 2011)](https://www.cs.ucdavis.edu/~ludaesch/pubs/Improving-Fault-Tolerance-through-Provenance-SSDBM-2011.pdf) | Workflow recovery | Uses recorded data provenance and actor-state checkpoints to resume workflows | Actor invocation/state | Known workflow crash | A direct non-LLM predecessor to provenance-guided replay and checkpoint recovery; it addresses crash resumption rather than semantic fault localization. |
| [ReAct (Yao et al., 2023)](https://arxiv.org/abs/2210.03629) | Agent architecture | Interleaves reasoning, actions, and observations | None by itself | Environmental feedback can expose errors | Establishes the common tool-using loop, but not automatic state recovery. |
| [Toolformer (Schick et al., 2023)](https://arxiv.org/abs/2302.04761) | Tool use | Learns when and how to call APIs | None | No recovery mechanism | Useful background for tool-enabled language models. |
| [Self-Refine (Madaan et al., 2023)](https://arxiv.org/abs/2303.17651) | Self-correction | Same model generates feedback and revises output | Whole output/attempt | Model self-feedback | Improves answers, but does not track tool-state dependencies or undo effects. |
| [Reflexion (Shinn et al., 2023)](https://arxiv.org/abs/2303.11366) | Reflection and memory | Stores verbal feedback from failed attempts | Later trial or trajectory | Task feedback followed by reflection | Learns from failure, but may retain a corrupted trajectory and repeat valid work. |
| [CRITIC (Gou et al., 2023)](https://arxiv.org/abs/2305.11738) | Tool-grounded correction | External tools critique an output before revision | Output-level iterative revision | Tool feedback | Supports the value of external verification; it does not establish dependency-aware rollback. |
| [Chain-of-Verification (Dhuliawala et al., 2023)](https://arxiv.org/abs/2309.11495) | Verification | Generates and answers independent verification questions | Draft response | LLM-created verification questions | Reduces hallucination, but focuses on answer verification rather than execution recovery. |
| [LATS (Zhou et al., 2023)](https://arxiv.org/abs/2310.04406) | Search/planning | Tree search with reflections and environment feedback | Alternative trajectory branches | LM value estimates and environment feedback | Explores alternatives with additional inference; it is not designed to preserve completed side-effectful work after failure. |
| [LLM-Modulo (Kambhampati et al., 2024)](https://arxiv.org/abs/2402.01817) | Neuro-symbolic planning | LLM proposes while external model-based verifiers check | Candidate plan | External symbolic verifier | Strong theoretical grounding for using deterministic academic rules around an LLM planner. |
| [LangGraph persistence and time travel](https://docs.langchain.com/oss/python/langgraph/persistence) | Production runtime | Saves graph checkpoints; supports resume, replay, and fork | Graph super-step/checkpoint | Developer or workflow selects checkpoint | Provides durable execution but normally re-executes nodes after the checkpoint. It does not alone find the smallest safe affected subgraph. |
| [AgentDebug (Zhu et al., 2025)](https://arxiv.org/abs/2509.25370) | Failure diagnosis | Taxonomy, annotated trajectories, root-cause feedback | Failed step/trajectory | Agent-based trajectory analysis | Directly studies cascading failures and localization; recovery is corrective rerunning rather than proven minimal reuse. |
| [AdvisingWise (Jiang et al., 2025)](https://arxiv.org/abs/2511.05706) | Academic advising | Multi-agent retrieval and drafting with human advisor validation | Response | Human review | Grounds the application domain and the need for human oversight, but not selective recovery. |
| [AI-Based Academic Advising SLR (Alloug et al., 2026)](https://doi.org/10.3390/info17040335) | Academic-advising review | PRISMA review of 27 peer-reviewed studies from 2018-2025 | Field-level evidence | Literature synthesis | Reports inconsistent evaluation, weak institutional grounding, offline-evaluation dominance, and maintenance concerns under changing policy. It supports a narrow decision-support claim and versioned evaluation data. |
| [AgentRx (Barke et al., 2026)](https://arxiv.org/abs/2602.02475) | Evidence-grounded diagnosis | Synthesizes guarded constraints from schemas, policies, and traces; produces violation evidence for an LLM judge | Critical trajectory step | Programmatic and semantic checks plus LLM attribution | Directly establishes constraint-assisted unknown-root localization. It diagnoses but does not perform dependency-selective state repair. Some constraints and the final judge are LLM-generated. |
| [ACRFence (Zheng et al., 2026)](https://arxiv.org/abs/2603.20625) | Safe checkpoint restore | Records irreversible effects and enforces replay-or-fork semantics | External action | Restore-time policy | Shows that replaying an LLM-generated tool request may create duplicate or unauthorized effects. Any recovery claim must address side effects and idempotency. |
| [HORIZON (Wang et al., 2026)](https://arxiv.org/abs/2604.11978) | Long-horizon diagnosis | Cross-domain benchmark and trajectory-grounded attribution | Trajectory step/category | LLM judge validated against humans | Supports measuring horizon-dependent failure and localization accuracy. It is diagnostic, not a selective runtime. |
| [ReflectAgent (OpenReview submission, 2026)](https://openreview.net/pdf?id=hV2YxBlo0g) | Intra-trajectory recovery | Per-step anomaly critic, dependency graph, root locator, beam rollback planner | Tool-call suffix from localized root | LLM critic plus dependency traversal | The closest work to the original proposal. Reported results include 66% top-1 root localization at chain length 9 and 41.8% recovery on ERRRECOV-HARD. Publication/review status and artifacts require verification. |
| [AgentLocate (Xia et al., 2026)](https://arxiv.org/abs/2607.07989) | Multi-agent localization | Independent evaluators with confidence aggregation | Earliest decisive agent/step | LLM judges and lightweight fine-tuning | Useful localization baseline, but focuses on multi-agent attribution. |
| [AgentDebugX (Zhu et al., 2026)](https://arxiv.org/abs/2607.18754) | Debugging and recovery | Detect, Attribute, Recover, Rerun loop | Trajectory | Global analysis and cross-examination | Very relevant end-to-end debugging framework. Its reported exact attribution remains modest, emphasizing that localization is difficult. |
| [Dependency-Guided Rollback Repair (Yu et al., 2026)](https://arxiv.org/html/2608.10502v1) | Selective recovery | Typed memory-to-action provenance graph, independent-support checking, and selective replay | Memory claims and answer-relevant affected computation | Starts from diagnosed faulty memories | Very close in mechanism. It captures dependencies explicitly, excludes mere temporal edges, preserves independently supported nodes, and assumes the faulty memories are diagnosed. |
| [AgentRewind (Zhuang et al., 2026)](https://arxiv.org/abs/2608.14380) | Runtime recovery | Aligns checkpoints of agent context and environment | Earlier checkpoint and suffix | Checkpoint selection/recovery information | A strong checkpoint baseline for long-horizon tasks; selective independent-branch reuse is not its stated focus. |

## What Existing Methods Already Establish

1. Tool-using agents commonly operate as repeated model-action-observation loops. ReAct is a foundational example.
2. Feedback and revision can improve agent outcomes. Self-Refine, Reflexion, CRITIC, and Chain-of-Verification differ mainly in the feedback source and revision scope.
3. Production runtimes already support durable checkpoints, resume, replay, and forks. Therefore, "adding checkpoints" alone is not a research contribution.
4. Recent systems explicitly diagnose root causes and roll back agent trajectories. ReflectAgent is especially close to the original question.
5. Recent memory research already uses provenance graphs to selectively replay affected computation while retaining benign state.
6. Recovery can be unsafe when tools have external effects. ACRFence shows that regenerated calls may not be semantically identical to the originals.
7. Constraint-assisted localization is already established by AgentRx, which combines programmatic and semantic guarded checks with an LLM judge. Domain validators alone are not a novelty claim.
8. External deterministic verification has a strong conceptual basis in LLM-Modulo and is more defensible than asking the same model to judge its own plan.

## Classical Foundations

The recovery problem is not unique to language-model agents. The project should explicitly connect four older lines of work:

1. **Program slicing:** Weiser's static slicing asks which statements may affect a selected value. Agrawal and Horgan's dynamic slicing narrows this to statements that actually affected a value in one execution. An agent recovery closure is analogous to a dynamic slice, but must work across model outputs, tool results, database facts, and hidden semantic assumptions.
2. **Rollback recovery:** Checkpoint- and log-based protocols restore computation from recorded state. Elnozahy et al. show that dependencies can propagate rollback to processes that did not fail and that replay of nondeterministic execution requires recording its determinants. Agent tool responses, model outputs, data versions, and random settings play a related role.
3. **Data provenance:** Provenance explains how and why a result was derived and supports debugging and update propagation. This motivates value-level lineage rather than treating a timestamp-ordered transcript as a causal graph.
4. **Workflow recovery:** Kohler et al. used ordinary workflow provenance and actor-state checkpoints to avoid full re-execution. This is a direct conceptual predecessor to selective agent replay, although its faults are workflow crashes and its components have clearer execution semantics.

These foundations prevent an inflated novelty claim. The LLM-specific challenge is not the general idea of slicing or provenance-based replay; it is deciding what counts as a dependency, localizing semantic faults from incomplete evidence, and validating reuse when steps are nondeterministic or side-effectful.

## Novelty Audit

### Collision with the original proposal

The original idea cannot currently be presented as the first dependency-aware selective recovery method. ReflectAgent combines anomaly detection, dependency-based localization, and rollback within tool-use trajectories. Dependency-Guided Rollback Repair preserves benign state and selectively replays affected computation in memory-augmented agents. AgentRewind provides aligned agent/environment checkpoint recovery.

### Closest-method comparison

| Dimension | AgentRx | ReflectAgent | Dependency-Guided Rollback Repair | Candidate FiskGrad study |
|---|---|---|---|---|
| Initial fault known? | No; localizes the first unrecoverable critical step | No; localizes a likely root tool step | Yes; diagnosed faulty memory IDs are inputs | No; begins from structured validator violations |
| Detection evidence | Synthesized guarded programmatic and semantic constraints | LLM anomaly critic over steps | Upstream detector is outside scope | Fixed academic rules plus versioned source facts |
| Dependency representation | Normalized ordered trajectory and dynamic trace constraints | Post-hoc token/argument matching refined by an LLM | Explicit typed runtime provenance | Explicit value and rule provenance recorded during execution |
| Recovery unit | None; diagnosis output | Re-executed trajectory suffix from a localized root | Answer-relevant affected dependency closure | Affected dependency closure, with conservative fallback |
| Independent later work | Not a recovery study | Suffix rollback may repeat it | Can preserve it | Measured directly as valid-work preservation |
| Main domain | Cross-domain failed trajectories | General tool-use benchmarks | Persistent-memory failures in shopping, travel, and support | Within-run planning/state faults in academic planning |
| Main unresolved fit for this project | Does not connect the diagnosis to selective repair | LLM critic reliability and suffix-wide replay | Fault diagnosis is assumed; memory is the fault source | Measure the full path from violation to localization, invalidation, repair, and reuse |

### Candidate distinction for FiskGrad

The most defensible direction presently appears to be an **empirical study of validator-grounded branch-selective recovery in a structured domain**:

- Combine **unknown-root localization** with **explicit provenance and selective dependency-closure replay**. The closest reviewed methods presently provide one side or the other: ReflectAgent localizes an unknown source but uses post-hoc dependency inference and suffix replay; Dependency-Guided Rollback Repair uses explicit provenance and branch-selective replay but receives diagnosed faulty memories.
- Use fixed, independently tested academic constraints to detect contradictions and narrow candidate source steps before any LLM diagnosis. Unlike AgentRx's general constraint synthesis, the primary rule set should not be generated by the model being evaluated.
- Compare suffix rollback with dependency-closure recomputation, where an independent branch after the root cause may still be reused.
- Evaluate localization and reuse together when the injected error location is hidden from the recovery algorithm.
- Separate pure/read-only steps from side-effectful steps and avoid claiming automatic reversal of enrollment, email, or other irreversible actions.

This is a **candidate distinction**, not yet a confirmed research gap. AgentRx already uses guarded constraints to localize critical failures, and AgentDebugX uses deterministic rules before model-based attribution. Combining established diagnosis and recovery mechanisms may still be a useful senior-seminar contribution, but it should be described as an integration and controlled evaluation unless the final method contains and validates a new technical element. It must be tested against the full methods and artifacts of AgentRx, ReflectAgent, AgentDebugX, Dependency-Guided Rollback Repair, and AgentRewind.

## Detailed Reading: AgentRx

Source: [Barke et al., 2026, arXiv](https://arxiv.org/html/2602.02475). Status: recent preprint with released code and data.

Key details:

- AgentRx defines the critical failure as the first failure in the causal chain from which the agent does not recover, rather than simply the first or final visible error.
- It normalizes heterogeneous traces and synthesizes global constraints from schemas and policies plus dynamic constraints from prior observations.
- Guards decide when a constraint applies. Assertions are checked either programmatically over structured fields or semantically by an LLM checker.
- A validation log records verdicts and evidence. A separate LLM judge may accept or override those signals and predicts the critical step and failure category.
- The current arXiv HTML reports 170 annotated failed trajectories across 11 settings and three repeated runs per configuration. Earlier search metadata reported 115, so the exact version must be frozen in the bibliography.
- Exact step accuracy in the paper includes 42.7% on its tau-bench subset and 36.4% on Magentic-One, demonstrating useful but incomplete localization.
- The authors report that weak, false-positive, or downstream violations can misdirect the judge. They identify signal selection as future work.
- The framework stops at diagnosis; it does not calculate a dependency invalidation set or selectively repair state.

Implication for FiskGrad: validator-grounded localization is prior art. A useful experiment can test whether fixed domain rules and explicit provenance produce better repair decisions, while separately reporting detection, localization, invalidation, and recovery performance.

## Detailed Reading: Dependency-Guided Rollback Repair

Source: [Yu et al., 2026, arXiv v1](https://arxiv.org/html/2608.10502v1). Status: recent preprint.

Key assumptions and method details:

- Its input includes the failed trace, memory store, runtime provenance, and the identifiers of already diagnosed faulty memories. Fault diagnosis is explicitly outside its scope.
- Its graph is instrumented and deterministic rather than inferred from raw text. Nodes represent user inputs, execution steps, and persistent memory. Typed edges represent support, production, updates, consolidation, derivation, and other relations.
- Temporal order alone does not imply contamination. This is essential because an unrelated later branch may remain reusable.
- Reachability first over-approximates the affected set. Independent trusted support may then preserve a reachable node.
- A deterministic planner invalidates unsupported state and computes the answer-relevant execution closure. Safe prerequisites are supplied as fixed context during replay.
- Irreversible effects cannot be undone. Re-execution assumes resettable, idempotent, or compensating tool interfaces.
- The controlled benchmark contains 150 cases across shopping, travel, and customer support. It evaluates four memory fault types: poisoned, stale, wrong-user, and summary drift.
- The benchmark retains only injections that alter the answer and create downstream effects. This evaluates conditional recovery, not natural fault prevalence or detector performance.

Implication for FiskGrad: explicit dependency closure, benign-state preservation, and selective replay are established ideas. A FiskGrad study needs to focus on locating an unknown within-run source from validator evidence, or on another difference supported by direct experiments.

## Detailed Reading: AgentDebugX

Source: [Zhu et al., 2026, arXiv v1](https://arxiv.org/html/2607.18754). Status: recent preprint with linked open-source toolkit.

Key details:

- The workflow is Detect, Attribute, Recover, and Rerun.
- Detection first uses deterministic rule packs for malformed calls, invalid outputs, loops, and premature success. LLM judging covers cases rules cannot resolve.
- The visible failure seeds attribution; it does not automatically become the assigned cause.
- DeepDebug performs a global read, a structure-guided second investigation, cross-examination of candidates, and a structured diagnosis with one proposed fix.
- Recovery produces a suggestion behind a human or policy gate and creates a branch from a selected checkpoint. It does not automatically replay arbitrary external tools from imported logs.
- Reported strict exact agent-and-step localization is 28.8% for qwen3.5-9b on 184 Who&When traces. This shows that source localization remains difficult even with a multi-turn debugger.
- The GAIA recovery experiment repairs 13 of 73 previously failed tasks in one rerun, but evaluates the full diagnosis-and-fix recipe rather than isolating attribution alone.

Implication for FiskGrad: merely adding rule-based detection plus an LLM debugger would overlap with AgentDebugX. The experiment must isolate the value of structured domain violations and dependency closure.

## Detailed Reading: AgentRewind and ACRFence

[AgentRewind](https://arxiv.org/html/2608.14380) records LLM and tool calls together with workspace snapshots, restores recorded prefix outputs without rerunning them, and begins a fresh suffix from a selected LLM checkpoint. Its controlled environment is the workspace filesystem; network requests and external services are outside its rollback boundary. MettleBench uses executable acceptance checks and an ordered checklist for 82 engineering tasks. This provides a strong checkpoint/suffix-recovery baseline and a useful model for hidden deterministic acceptance criteria.

[ACRFence](https://arxiv.org/html/2603.20625) identifies semantic rollback risk: after restore, a nondeterministic LLM may produce a similar but different external request, bypassing ordinary duplicate detection. It proposes recording irreversible effects and using replay-or-fork semantics. The paper reports only a proof-of-concept attack evaluation; its proposed analyzer was not implemented in that version. FiskGrad experiments should initially keep recovery tools read-only and proposals unsaved, then treat any state-changing operation as a separate safety problem.

## Proposed Research Questions

Primary candidate:

> When a deterministic domain validator detects a delayed failure in a tool-using agent, can explicit execution provenance localize the responsible state and safely reuse independent results more accurately or efficiently than retry, checkpoint, and suffix-rollback baselines?

More conservative formulation if novelty remains unclear:

> What accuracy-efficiency tradeoffs arise when constraint-based failure localization is connected to provenance-based selective recovery in a Gemini academic-planning agent?

Supporting questions:

- **RQ1, localization:** How accurately does the method identify the injected root-cause step or a safe earlier boundary?
- **RQ2, correctness:** How often does recovery produce a plan that satisfies the available deterministic academic constraints?
- **RQ3, reuse:** How much valid prior computation is preserved?
- **RQ4, efficiency:** How many model calls, tool calls, tokens, seconds, and estimated dollars are required?
- **RQ5, safety:** How often does reuse preserve a stale or corrupted result, and how often does recovery unnecessarily discard valid work?

## Evaluation Requirements

The study should include:

- Frozen synthetic or de-identified student records, catalog snapshots, and requirement snapshots.
- Expected plans or satisfiability conditions produced independently from the agent under test.
- Controlled failures in tool output, requirement interpretation, intermediate state, plan generation, and delayed validation.
- Failure injection metadata hidden from the recovery algorithm but retained by the experiment harness as ground truth.
- Multiple task lengths and dependency-graph shapes, including parallel independent branches.
- Repeated trials with fixed scenario ordering and recorded model/version/settings.
- Baselines: full restart, visible-step retry, last checkpoint, root-source suffix rollback, reflection/rerun, and selective dependency closure.
- Separate measurement of detection, localization, invalidation, and final task recovery.

Suggested metrics:

- Final constraint-satisfaction accuracy.
- Recovery success rate.
- Exact root-step localization accuracy and safe-boundary accuracy.
- Invalidated-state precision, recall, and F1.
- Valid-work preservation rate.
- Repeated model/tool steps.
- Latency, token use, and estimated model cost.
- Unsafe-reuse rate and unnecessary-recomputation rate.

## Ground Truth in FiskGrad

Deterministic checks can cover only rules represented precisely in the data, such as:

- course already completed;
- duplicate course placement;
- fixed prerequisite ordering;
- corequisite presence;
- semester credit limit;
- `all_of`, `choose_one`, `choose_n`, and credit-threshold requirement groups when the source data is complete.

The current FiskGrad data cannot yet establish official graduation clearance. It may omit overlapping requirement groups, transfer equivalencies, residency requirements, grade minima, substitutions, and policy exceptions. Those limitations must remain visible in the experiment and paper.

The academic-advising literature adds four operational constraints:

- Freeze the catalog, requirement, parser, and validator versions used in every experiment because curricula and policies drift.
- Use synthetic or properly de-identified student records and keep protected student data out of released traces.
- Evaluate the system as planning decision support, not as a replacement for an academic advisor or registrar.
- Report which encoded rules were tested and which institutional policies remain outside the validator; a high pass rate against an incomplete ruleset is not broad advising accuracy.

## Source Quality and Open Checks

- ReAct, Reflexion, Self-Refine, and related foundational works have established conference histories; final citation metadata still needs formatting.
- Several 2025-2026 items are arXiv preprints. Their claims should be described as reported results, not settled facts.
- ReflectAgent is currently accessible as an OpenReview submission/search extract. Its review status, authors, code, and benchmark artifacts need direct verification before formal citation.
- Search results alone are not a substitute for reading methods, experimental setup, ablations, and limitations in full.

## Research Decision Gate

Do not lock the implementation or claim a new recovery algorithm until all of the following are answered:

- Can AgentRx constraints and Dependency-Guided Rollback Repair be adapted as explicit baselines?
- Is the proposed locator deterministic, LLM-based, or hybrid, and what evidence can each version see?
- Is the target the true injected source, the first unrecoverable step, or the earliest safe replay boundary? These labels are not interchangeable.
- Does branch-selective recovery improve cost or valid-work preservation without increasing unsafe reuse?
- Does any proposed new mechanism outperform an ablation that simply combines AgentRx-style evidence with an existing dependency-closure planner?

If the last answer is no, the contribution should remain a reproducible domain study and system prototype rather than an algorithmic novelty claim.

## Next Reading Queue

1. AgentRx artifact and constraint schema, including whether fixed human-authored constraints can be supplied directly.
2. ReflectAgent full paper and artifact, with attention to dependency inference, rollback unit, side effects, and baselines.
3. Dependency-Guided Rollback Repair artifact, especially the diagnosed-fault input contract.
4. AgentDebug and AgentDebugX methodology and released code.
5. AgentRewind checkpoint alignment and MettleBench design.
6. LLM-Modulo and related verifier-guided planning work.
7. Academic-advising evaluation literature, focusing on authoritative data and human review.
