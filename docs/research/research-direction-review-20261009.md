# Research direction review — October 9, 2026

This assessment compares primary sources checked online today with the recorded local implementation. It is our methodological judgment, not an external certification of the project.

## Current research relevance

- [AgentRx v2](https://arxiv.org/abs/2602.02475v2), revised August 31, 2026 and listed as accepted to EMNLP Findings 2026, diagnoses critical failure steps using synthesized constraints and validation logs. Our deterministic read-consistency detector is a narrower, different implementation. Local preprocessing is not full AgentRx reproduction.
- [AgentRewind](https://arxiv.org/abs/2608.14380), August 2026 preprint, restores aligned agent-context/environment checkpoints with memory from prior attempts. Local isolated-database snapshots follow a related design principle, but do not reproduce the published system.
- [Dependency-Guided Rollback Repair](https://arxiv.org/abs/2608.10502), August 2026 preprint, traces memory/action dependencies and preserves independently supported state. This closely related work means dependency-aware selective recovery alone cannot be claimed as our novel invention. Preprint results are reported evidence, not proof of universal effectiveness.
- The [maintained tau repository](https://github.com/sierra-research/tau2-bench) now presents itself as tau3-bench. Our checkout is pinned to `4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699`; this review does not establish that the pin is the latest remote commit. Keep the pin stable within comparisons and label the version correctly. The [original tau paper](https://arxiv.org/abs/2406.12045) emphasizes outcome grading and reliability across repeated trials.

## What is sound so far

We have an explicit question, executable baseline comparisons, released task data, unchanged official grading, recorded source/protocol hashes, fault definitions and retained failed attempts. Public task data plus an openly described custom fault protocol is a legitimate experimental design; it does not become an official recovery benchmark. Comparing basic restart/retry/checkpoint mechanisms is useful, but cannot substitute for reproducing a named recent method when that is the stated objective.

## What remains incomplete

The [six-strategy condition](evidence/recovery-six-strategies-20261009/findings.md) is preliminary: selective recovery reused zero cached reads and did not reduce steps/model/tool calls versus no-recovery or source rollback. Visible retry never reached its fault; restart exceeded the cooperative timeout. Overlapping campaigns, differing model trajectories and ambiguous repeated identities weaken direct comparison. More trials alone will not correct these design problems.

The detector only identifies inconsistent deterministic reads at an unchanged database version. It does not cover all reasoning, policy or academic errors, and the conservative dependency graph does not establish the globally smallest safe boundary. Retail results do not establish Fisk academic-planning correctness; the [Fisk checker](fisk-case-study.md) remains partial and requires catalog/cohort and prerequisite review.

## Focused next steps

1. Trace why no valid reads were reused; check recovery and cache correctness before expanding live runs. Keep explanations of failures separate from untested causal hypotheses.
2. Predeclare a new versioned evaluation if changing timeout enforcement or fault timing. Serialize campaigns, record unexercised faults, and define treatment of repeated attempts before observing outcomes.
3. Evaluate more released tasks/faults and repeated trials under that fixed design. Report sample counts and uncertainty; test interventions against no-recovery to distinguish controller benefit from model self-recovery.
4. Finish one supported published-method reproduction and verify the Fisk requirements mapping before making stronger claims about those parts of the proposal.

A useful working question is: under which explicit fault and dependency conditions does selective recovery preserve valid work without lowering task success? Equal or negative results can answer that question. A broad claim that our recovery is already proven better cannot.
