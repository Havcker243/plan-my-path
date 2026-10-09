# Validator-Grounded Selective Recovery for Tool-Using AI Agents

Name: Oludolapo Adegbesan  
Class: Senior Seminar II  
Draft date: September 15, 2026  
Status: Working draft; research question and novelty claim are provisional

October 7 methodology update: reproduce an established method using official released benchmark artifacts before custom recovery development. AgentRx is the initial diagnosis target; maintained tau-bench supplies executable tool-agent tasks and official grading. Earlier custom-scenario sections below are historical proposal material pending revision. See [baseline status](baselines/README.md), [assumptions](assumptions.md), and the dated [research log](research-log.md).

## Abstract Draft

Tool-using AI agents can complete multi-step tasks by combining language-model reasoning with external data and software tools. Their reliability often decreases as workflows become longer because an incorrect intermediate result can influence several later decisions before a final check exposes the problem. Existing approaches include retrying a failed operation, restarting an execution, restoring a checkpoint, reflecting on a failed trajectory, localizing a critical failure with execution constraints, and selectively replaying computation identified through provenance. This project investigates how constraint-based localization and provenance-based repair interact when the original error location is unknown. FiskGrad, an academic-planning application, will provide a structured environment in which a Gemini agent reads completed coursework, retrieves degree requirements and course information, proposes a semester plan, and checks explicit constraints. Controlled faults will be inserted into intermediate steps while the recovery method remains unaware of their locations. The study will compare restart, retry, checkpoint, suffix rollback, reflection, and dependency-closure recovery using final correctness, localization accuracy, valid-work preservation, repeated computation, latency, token use, and estimated cost. The intended contribution is a controlled empirical evaluation in a domain with auditable rules, not a claim that constraint-based diagnosis or dependency-aware rollback is itself new.

## 1. Introduction Draft

AI agents increasingly perform tasks that involve several rounds of reasoning, information retrieval, tool use, and state updates. A typical tool-using agent observes a task, chooses an action, receives a tool result, updates its context, and continues until it produces an answer or changes an external system. This structure allows a language model to work with current and domain-specific information, but it also creates opportunities for errors to propagate across a trajectory.

A failure does not always appear at the step where it originates. For example, an academic-planning agent may retrieve a student's transcript correctly, misclassify one degree requirement, use that classification to choose later courses, and only fail when a final prerequisite or graduation-progress check rejects the completed plan. Retrying the final validator does not repair the incorrect classification. Restarting the entire workflow may recover, but it discards valid transcript and catalog results and repeats model and tool calls. Restoring the latest checkpoint can also preserve the original error if the checkpoint was created after that error entered the state.

Prior work offers several relevant approaches. ReAct interleaves reasoning and actions, while Self-Refine, Reflexion, CRITIC, and Chain-of-Verification use different forms of feedback to improve later outputs or attempts. Agent runtimes such as LangGraph save checkpoints for resumption and replay. More recent research directly addresses failure localization and rollback. AgentDebug and AgentDebugX analyze failed trajectories, ReflectAgent combines step-level anomaly detection with dependency-based localization and suffix rollback, Dependency-Guided Rollback Repair selectively repairs state derived from faulty memories, and AgentRewind aligns agent and environment checkpoints for recovery.

Because these systems overlap strongly with the original project idea, this project will not treat selective rollback or validator-assisted localization as new concepts. AgentRx already synthesizes guarded constraints and uses violation evidence to localize the first unrecoverable failure. ReflectAgent addresses unknown-root localization but replays a suffix, while Dependency-Guided Rollback Repair performs branch-selective replay but begins with diagnosed faulty memories. The study will therefore examine the end-to-end connection between localization and repair: fixed academic constraints will expose a delayed violation, and explicit runtime provenance will support conservative invalidation and reuse. The academic-planning domain is useful because some outputs can be checked against explicit course, credit, prerequisite, and requirement rules without asking another language model to be the sole correctness judge. Unless experiments demonstrate a distinct technical improvement, this will be presented as a reproducible integration and evaluation rather than a new recovery algorithm.

The primary research question is:

> When a deterministic domain validator detects a delayed failure in a tool-using agent, can explicit execution provenance localize the responsible state and safely reuse independent results more accurately or efficiently than retry, checkpoint, and suffix-rollback baselines?

The expected outcome is a working Gemini-powered academic-planning agent, a trace and recovery layer, controlled failure scenarios, and a reproducible comparison of recovery strategies. The project will distinguish student-facing planning assistance from official advising: deterministic validation is limited to encoded rules, and final academic decisions remain with university advisors and the registrar.

## 2. Background and Related Work Draft

### Tool-using agent architecture

[ReAct](https://arxiv.org/abs/2210.03629) demonstrates an influential pattern in which reasoning and actions alternate with observations from an environment. [Toolformer](https://arxiv.org/abs/2302.04761) studies how a model can learn when and how to invoke APIs. These approaches help define the agent trajectory that the proposed recovery system must observe.

### Feedback and correction

[Self-Refine](https://arxiv.org/abs/2303.17651) repeatedly generates feedback and revisions using one model. [Reflexion](https://arxiv.org/abs/2303.11366) places verbal feedback into episodic memory for later attempts. [CRITIC](https://arxiv.org/abs/2305.11738) uses external tools to critique an output, and [Chain-of-Verification](https://arxiv.org/abs/2309.11495) asks independent verification questions before a final response. These methods support correction but generally do not define a machine-checkable dependency closure for selective state reuse.

### Planning with external verification

[LLM-Modulo](https://arxiv.org/abs/2402.01817) argues for combining language models with external model-based verifiers. FiskGrad follows this broad principle: Gemini may propose or explain a plan, while ordinary code checks the encoded academic rules. The verifier's limitations must be reported because a plan that passes an incomplete rule set is not necessarily an official degree-valid plan.

### Classical recovery and provenance

The proposed design also follows older software and data-management ideas. [Program slicing](https://doi.org/10.1109/TSE.1984.5010248) identifies statements that may affect a value of interest, while [dynamic slicing](https://doi.org/10.1145/93548.93576) focuses on dependencies observed for a particular execution. A major [rollback-recovery survey](https://www.cs.rice.edu/~dbj/pubs/csur-rollback.pdf) distinguishes checkpoint- and log-based recovery and explains how communication dependencies propagate rollback. [Database provenance](https://doi.org/10.1561/1900000006) formalizes ways to explain where query results came from, and [provenance-based workflow recovery](https://www.cs.ucdavis.edu/~ludaesch/pubs/Improving-Fault-Tolerance-through-Provenance-SSDBM-2011.pdf) uses recorded lineage and actor checkpoints to avoid restarting long computations. The agent-specific problem is therefore an adaptation: model steps and opaque tools have uncertain semantic dependencies, nondeterministic outputs, and potentially irreversible effects.

### Checkpointing, localization, and rollback

[LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) provides checkpoints for durable execution, time travel, and fault tolerance. [AgentDebug](https://arxiv.org/abs/2509.25370) and [AgentDebugX](https://arxiv.org/html/2607.18754) study failure attribution and corrective rerunning. AgentDebugX already combines deterministic detection rules with model-based attribution. [AgentRx](https://arxiv.org/html/2602.02475) synthesizes guarded constraints from schemas, policies, and trajectories; programmatic or semantic checks produce evidence for an LLM judge that localizes the first unrecoverable failure. [ReflectAgent](https://openreview.net/pdf?id=hV2YxBlo0g) combines an anomaly critic, dependency-based root localization, and suffix rollback. [Dependency-Guided Rollback Repair](https://arxiv.org/html/2608.10502v1) uses explicit provenance, independent-support checking, and answer-relevant selective replay, but assumes faulty memories have already been identified. [AgentRewind](https://arxiv.org/html/2608.14380) restores aligned agent and environment checkpoints. [ACRFence](https://arxiv.org/html/2603.20625) demonstrates why replaying side-effectful calls requires stronger guarantees than replaying pure computations.

### Academic advising

[AdvisingWise](https://arxiv.org/abs/2511.05706) uses institutional sources and human advisor validation in an academic-advising system. A recent [systematic literature review](https://doi.org/10.3390/info17040335) reports that advising research remains dominated by offline evaluation and faces weak institutional grounding, limited external validation, privacy concerns, and maintenance problems as curricula and policies change. FiskGrad therefore treats generated guidance as planning support, freezes data and rule versions for experiments, and keeps human academic review outside the automated pass/fail claim. The proposed study differs by using academic planning as a controlled environment for failure localization and state recovery.

## 3. Proposed Method Draft

The prototype will represent each execution as a directed graph. A node will record a model or tool step, sanitized inputs and outputs, status, timing, and data version. An edge will record an explicit dependency: a later step consumed an earlier value or relied on an earlier assertion. Each node will also declare whether it is pure, read-only but time-sensitive, idempotent, compensatable, or irreversible.

When a deterministic validator rejects a plan, it will return structured violations rather than a single pass/fail result. A prerequisite error, for example, should identify the proposed course, its missing prerequisite, and the semesters involved. The recovery component will map the violation to candidate source nodes, compare recorded inputs with authoritative snapshots, and compute a conservative invalidation closure. Independent nodes whose inputs and assumptions remain unchanged may be reused. If the system cannot justify reuse, it will expand the boundary or fall back to a checkpoint or full restart.

Gemini will serve as the planning and conversational model. It will not be the sole correctness judge. Database queries and pure Python functions will provide student records, catalog facts, requirement rules, and validation. Proposed plans will remain separate from the saved student plan until a user approves them.

## 4. Experimental Design Draft

### Tasks

The initial benchmark will use fixed academic-planning tasks such as identifying remaining requirements, selecting a prerequisite-respecting course sequence, distributing courses across semesters under credit limits, and revising a plan after a delayed validation failure.

### Failure scenarios

Controlled faults will include wrong tool output, omitted completed credit, stale catalog data, incorrect prerequisite interpretation, malformed intermediate state, wrong requirement-group assignment, unavailable tool calls, and errors that manifest only during final validation. Each injection will record the true source step for scoring, but that metadata will not be visible to the recovery method.

### Recovery strategies

The comparison will include full restart, retry at the visible failure, last-checkpoint restore, rollback and replay from an estimated root source, reflection followed by rerun, and dependency-closure selective recovery. All strategies will receive the same task, data snapshot, model configuration, failure scenario, and execution budget.

### Measures

The primary outcome will be final deterministic constraint satisfaction. Secondary measures will include recovery success, exact and safe-boundary localization accuracy, invalidated-state precision/recall/F1, valid-work preservation, repeated model and tool calls, latency, tokens, and estimated API cost. Unsafe reuse will be tracked separately from unnecessary recomputation because a cheap recovery that preserves corrupted state is not successful.

### Analysis

Experiments will be repeated across several dependency shapes and trajectory lengths. Results will report per-scenario outcomes and aggregate uncertainty rather than relying on one demonstration. Ablations should remove deterministic validator evidence, explicit dependency edges, and independent-branch reuse to identify which component contributes to performance.

The analysis must distinguish three targets: the injected source step, the first unrecoverable critical failure, and the earliest safe replay boundary. A method can identify one without identifying the others. An oracle-localization condition will measure the recovery planner independently, while an oracle-recovery condition will help isolate localization errors. A simple combined baseline will feed AgentRx-style violation evidence into an existing dependency-closure planner; the proposed method must improve on that baseline before any algorithmic novelty is claimed.

## 5. Limitations and Ethics Draft

FiskGrad's requirement data does not encode every policy used in official degree clearance. Transfer equivalencies, substitutions, residency rules, minimum-grade policies, and advisor exceptions may be incomplete. The system therefore cannot claim that a generated plan guarantees graduation. Student records should not be included in research artifacts; experiments should use synthetic or properly de-identified snapshots. Model and catalog versions must be recorded because both may change over time.

The initial research is also limited by rapid concurrent work on agent recovery. ReflectAgent and Dependency-Guided Rollback Repair substantially reduce the space for a broad novelty claim. The final report should present a narrow empirical contribution only after the closest methods and artifacts have been reproduced or compared fairly.

## Current Status

- Literature mapping: initial pass complete; full-paper review pending.
- Novelty claim: not established; the default contribution is an empirical integration study.
- Agent prototype: an uncommitted Gemini tool loop and trace prototype exists in the working tree.
- Synthetic recovery demonstration: deterministic baselines and a three-run Gemini localization smoke test work on one controlled fault; engineering evidence only.
- Research benchmark: not yet designed or run at publishable scale.
