# Research Progress Report

**Name:** Oludolapo Adegbesan  
**Course:** Senior Seminar II  
**Project:** Selective State Recovery for Reliable AI Agents

## Project overview

My project investigates how an AI agent can recover from an error without restarting an entire task. The agent records its execution history, estimates where inconsistent information entered the workflow, restores valid state and attempts to preserve useful work.

Fisk University's B.S. in Computer Science is the intended academic-planning case study, using catalog requirements and synthetic student records. Current live recovery experiments use released retail benchmark tasks with the official evaluator. These experiments test the recovery mechanism; they do not establish that the Fisk academic-planning rules are complete or correct.

## Work completed since Project 1

The main progress followed this sequence: **initial implementation → experimental finding → recovery redesign → software verification**.

I developed the Research Lab interface so experiment controls, saved results, execution traces and method information are easier to navigate. A reviewer can begin with a result summary and open the supporting evidence rather than view every technical detail at once.

I reviewed AgentRx, AgentRewind and Dependency-Guided Rollback Repair and documented their relationship to my approach. My recovery controller is a custom implementation informed by these sources, not a completed reproduction of the published systems.

I also completed all six stages of the published AgentRx diagnosis pipeline on one released public trace. The run took 314.4 seconds. After preserving its prediction, I compared it with the released annotation: both identify step 17 as the root error, but they assign different failure categories. No annotation file was supplied to the original run. This provides a concrete example of diagnosis working partly as expected, with a remaining classification error; it does not establish overall benchmark accuracy or recovery success. The run used Copilot automatic model selection rather than a fixed paper model.

I conducted controlled experiments comparing no added recovery, full restart, visible-step retry, periodic checkpoint restoration, source rollback and selective recovery. Each saved attempt includes its outcome and execution evidence. Unsuccessful attempts and provider errors remain in the record.

## Experimental finding and redesign

The earlier experiments did not demonstrate work savings from selective recovery. In one six-strategy condition, all strategies received an official success score, but visible retry never encountered its planned fault. Selective recovery and no recovery used equal steps, model calls and executed tool counts, with no cached-read reuse. Therefore, successful task completion alone did not establish that the recovery controller helped.

I investigated this limitation and redesigned the cache. The system still treats affected reasoning conservatively, but separately checks whether a saved tool result can be reused. After recovery, a candidate must match the request and restored database version and pass a fresh value-validation check. The detected corrupt source and error responses are excluded; tools that change data always execute. Caching starts only after recovery.

For example, if a product lookup must be repeated after rollback, its saved result may be reused when the same product is requested against the same database version and the value has been verified. This can avoid a replay lookup. However, the verification itself requires a tool call, so reuse does not automatically reduce total work. This is an explanation of the mechanism, not a claim that live product-lookup savings have been demonstrated.

## Phase 1–3 results summary (task 0, fault_exercised=True, mean reward over seeds)

| fault | no_rec | restart | vis_retry | checkpoint | src_rollback | selective |
|---|---|---|---|---|---|---|
| empty_read | 0.75 (n=4) | 0.67 (n=3) | 0.67 (n=3) | 0.75 (n=4) | **1.00 (n=3)** | 0.50 (n=4) |
| wrong_user_id | 0.67 (n=3) | 0.67 (n=3) | 1.00 (n=3) | 0.67 (n=3) | 1.00 (n=3) | **1.00 (n=3)** |
| tool_error | 1.00 (n=1) | 1.00 (n=1) | 0.50 (n=2) | 0.50 (n=2) | 0.50 (n=2) | **0.50 (n=2)** |

Key findings: `source_rollback` is the most consistent strategy for `empty_read` (1.0 across all 3 seeds). All detection-based strategies recover `wrong_user_id` reliably. For `tool_error`, `selective` recovered in the only case where the fault was detected before the agent's deadline expired; the others failed due to a conversation timing artifact (too many post-recovery steps before `###STOP###`). Note: `no_recovery` performs at 1.0 for `tool_error` due to the agent's natural retry behavior — not a recovery-controller contribution.

## Results and evidence

The checked software behavior passed **23 targeted tests across three test groups**:

| Test group | Passed | Purpose |
| --- | ---: | --- |
| Recovery integration | 12 | Check detection, aligned restoration, cache validation and unsafe-reuse rejection |
| Experiment scheduling | 3 | Check trial identities and protocol ordering |
| Evidence analysis | 8 | Check version separation, missing data, pairing and validation overhead |

I improved the analysis to report executed tools, validation calls and total tool invocations separately. Missing measurements are not treated as zero. One analysis test specifically checks that fewer executions and positive cache reuse can still mean greater total work after validation.

These tests support correctness of the checked behaviors, not superiority in live experiments. The redesigned version has no live performance result yet. Earlier results remain separate from the new version.

Evidence available for review:

- [Six-strategy comparison and raw experiment records](evidence/recovery-six-strategies-20261009/findings.md).
- [Recovery redesign and verification](verified-cache-redesign-20261009.md).
- [Integration-test verification record](evidence/verified-cache-redesign-20261009/verification.json).
- [Analysis verification record](evidence/v3-comparison-readiness-20261009/verification.json).
- [Prepared comparison plan](v3-bounded-comparison-20261009.md).
- [AgentRx public-sample result and annotation comparison](baselines/results/agentrx-full-20261009T093620Z-3eec32/findings.md).
- [Research log](research-log.md) and [assumptions](assumptions.md).

**GitHub:** Add the accessible repository URL after confirming the cited evidence is published.

## Challenges

Live retail experiments were interrupted by Gemini API quota exhaustion for **`gemini-3.5-flash-lite`**, which powers both the research agent and the benchmark's simulated user. A saved provider error reported a limit of **500 requests per day** for that model. Requests are model calls, not benchmark trials. The affected attempts have null rewards and are retained as execution failures rather than graded task failures. I continued offline testing and preparation while live execution was unavailable.

Other limitations include differing model trajectories despite matching requested seeds, unexercised faults, overlapping campaigns and a cooperative timeout that can overrun. I recorded these limitations and preserved implementation/protocol versions. They prevent broad claims of improved reliability or efficiency from the current evidence.

## Expanded experiment: three new strategies

After completing Phases 1–3, I analyzed the trajectory data and found three structural limitations in the original six strategies. This motivated designing three new strategies, each directly grounded in recent literature:

**`rollback_with_reflection`** (source: arXiv 2609.18304) uses the same state rollback as `source_rollback` but appends a verbal explanation to the restored context. The hypothesis is that explicit context reduces repeated mistakes when the agent's reasoning was contaminated by the corrupted data.

**`verbal_correction`** (source: arXiv 2605.06737 / Reflexion / CRITIC) is a minimal-intervention approach that rolls back only one step and pre-fetches the corrected result before the agent's next call. It directly addresses the trajectory finding that `selective` succeeded on `tool_error` due to detection timing rather than a mechanistic advantage — by minimizing post-recovery work at the structural level rather than relying on late detection.

**`adaptive`** (source: arXiv 2608.11977) is a fault-type-aware meta-controller that routes to the empirically best strategy per fault type: `empty_read → source_rollback`, `wrong_user_id → restart`, `tool_error → selective`. It provides a near-oracle ceiling for perfect strategy selection.

All three strategies were added to the adapter and the protocol was updated with a fourth amendment. Phase 4b — 27 cells on task 0, seeds 300–302, all three faults — runs these strategies under identical conditions to Phases 1–3, using the same model and evaluator, for direct comparison.

## Nuance finding: coverage ≠ impact

Detailed trajectory inspection revealed that `fault_exercised=True` is necessary but not sufficient for a meaningful comparison. For `wrong_user_id`, the agent sometimes obtains the correct user ID through `find_user_id_by_name_zip` before `get_user_details` is called; the fault fires but is never used in a downstream action (structural bypass). For `tool_error`, the agent retries transient errors naturally; the fault fires but the single-injection protocol means the natural retry always succeeds. In both cases, `no_recovery` receives credit for agent resilience that exists independent of the recovery controller. These cases are now labeled separately as "fault fired but not impact-confirmed."

## Next stage

After Phase 4b completes, I will regenerate the results table and report whether the new strategies outperform, match, or underperform the original six on the same seeds. The `adaptive` strategy provides a strategy-selection ceiling for each fault type. I will then run Phase 5 (tasks 1 and 2) to test whether the method generalizes beyond task 0, and complete the Fisk requirement verification.

The primary next deliverable is a completed results table with all nine strategies across three faults and at least three seeds, with exercised-only and impact-confirmed filtering clearly documented.

---

## Evidence captions and submission notes — remove after preparing the report

Use two or three selected figures rather than screenshots of every section:

1. **Research Lab:** “The Research Lab organizes experiment controls, saved outcomes and detailed execution evidence for review.” Use a current screenshot; do not treat it as proof of performance.
2. **Earlier comparison:** “Results from one released retail task under the earlier adapter. Selective recovery showed no work-saving advantage in this condition; visible retry did not encounter the planned fault. These results do not evaluate the redesigned version.” Use the actual six-strategy table and preserve its fault-coverage and timeout notes.
3. **Verification:** “The redesigned recovery implementation passed 12 offline integration tests. Separate scheduling and analysis groups passed 3 and 8 tests, respectively. These checks establish tested software behavior, not live recovery superiority.” Use actual test output or the saved verification records; do not imply all 23 were one test run.

This draft follows the user's request to describe progress since Project 1 without calendar dates. The assigned September 16–25 period remains different from the recorded October work. Omitting dates does not establish that this work occurred during Weeks 5–6; confirm the accepted reporting scope before submission. Do not relabel later accomplishments as September work.
