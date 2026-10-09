# Recovery literature update — October 8, 2026

Primary sources reviewed during the next research stage. Reading a paper or identifying its code does not establish local reproduction. Paper results belong to their reported tasks/models and must not be copied into our results table.

| Work and source | Method and relevance | Local distinction/status |
| --- | --- | --- |
| [DoVer, arXiv:2512.06749](https://arxiv.org/html/2512.06749), [author project](https://mbjinx.github.io/DoVer_Web/), [official implementation](https://github.com/microsoft/ACV/tree/main/misc/DoVer) | Segments trials, generates failure hypotheses, intervenes on plans/messages, and checks recovery/progress. It uses three independent intervention runs and distinguishes inconclusive intervention outcomes. | Newly reviewed candidate. Our version-matched read detector is not DoVer's hypothesis/intervention pipeline. Code located, not installed or executed. |
| [AgentRewind, arXiv:2608.14380](https://arxiv.org/html/2608.14380), [author-linked recorder](https://github.com/Futuresis/replay-agent-recorder) | Restores aligned agent-context/workspace checkpoints and adds memory from discarded attempts. The paper distinguishes context restoration, environment restoration and rewind memory in ablations. | Relevant published design for source rollback. Our isolated retail DB snapshots and fixed detector are different; no faithful AgentRewind reproduction. |
| [Dependency-Guided Rollback Repair, arXiv:2608.10502v1](https://arxiv.org/html/2608.10502v1) | Typed memory/action provenance, downstream tracing, independent-support checks and answer-relevant replay. Its premise is that graph reachability can over-invalidate independently justified state. | Particularly close related work: do not claim dependency-guided selective repair is new by itself. Our conservative DAG has no complete independent-support validator or persistent-memory repair. Official executable artifact not located in the reviewed paper; no reproduction. |
| [DARC, arXiv:2608.11772v1](https://arxiv.org/html/2608.11772) | Selects recovery interventions by diagnosed task-family failures, freezes development-selected policies, and compares generic/mismatched recovery. Discusses matching information access between methods. | Newly reviewed preprint; not our rollback algorithm. Motivates a future diagnosis-versus-recovery ablation, not an immediate change to frozen trials. Not installed or executed. |
| [AgentRx, arXiv:2602.02475v2](https://arxiv.org/abs/2602.02475v2) | Constraint-supported critical-step diagnosis. The August 31 revision describes 170 trajectories across 11 settings; older publisher/blog pages still describe the earlier 115-trajectory release. | Existing pinned implementation. Version the citation and dataset rather than mixing counts; full diagnosis remains pending supported access. |

## Additional public benchmark candidate

[MettleBench](https://github.com/Kelvin-Coffee/MettleBench), linked by the AgentRewind authors, contains 82 engineering assignments with deterministic ordered-checklist grading. It is a recently released research benchmark, not evidence of broad community adoption. Its tooling/specifications are Apache-2.0; task workspaces retain their source licences. Workspaces are downloaded separately, and reference solutions require gated access. Platform compatibility and reset safety must be assessed before running it. It is not installed or executed here and is not an academic-planning dataset.

## Implications for this project

These are research decisions/inferences from the reviewed designs, not claims made by the cited authors about our implementation:

1. Narrow the contribution to experimentally measuring safe recovery boundaries and work preservation under explicit detector/dependency assumptions. Do not claim the first dependency-aware recovery system or a globally minimal boundary.
2. Finish the recorded matched comparison before introducing independent-support checks or changing the fault mix. Future extensions require a new versioned protocol.
3. Measure detector accuracy and task recovery separately. A correct source prediction can coexist with task failure, while an ordinary agent can succeed without our recovery controller.
4. A proposed future ablation can compare conservative closure against separately validated independent support. It needs a sound support rule, new predeclared cases and unchanged grading; it is not implemented in this update.
5. Keep published-method reproduction pending until official code runs in its supported environment. Naming restart/checkpoint/selective strategies does not satisfy reproduction.

## Execution provenance finding

Preflight found identical v2 protocol bytes but a different adapter hash from the October 7 paced pilot. The current adapter adds a monotonic total tool-error counter and reports it in results. Therefore the October 8 four-cell subset (task 0, empty_read, seeds 301/302, reference/selective) is a separate adapter group. It retains the full six-method protocol's seed ordering, which is not balanced ordering for this two-method subset. Run results must report this potential order/provider confound. The older seed-300 pilot must not be pooled as a third matched seed under the current adapter.
