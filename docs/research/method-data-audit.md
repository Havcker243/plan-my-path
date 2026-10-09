# Method and data provenance audit

Recorded October 7, 2026. Publication, official code reuse, local execution and independent reproduction are separate claims. None means a method is universally proven. This audit does not turn our proposed method into an established method.

| Component | Source and status | Permitted claim |
| --- | --- | --- |
| Official task baseline | [Maintained tau repository](https://github.com/sierra-research/tau2-bench/tree/4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699), pinned unchanged code/data/evaluator; Gemini model substitution | Official task implementation executed on one task. Not full-suite accuracy or reproduction of paper scores. |
| AgentRx | [Official code](https://github.com/microsoft/AgentRx/tree/7a18c79708e7671be15124460f4f7296107c2a55), [paper version](https://arxiv.org/abs/2602.02475v2); seven public samples normalized; full diagnosis access-blocked | Published diagnostic method identified and official preprocessing executed. No local full-method accuracy claim. AgentRx diagnosis does not itself establish recovery performance. |
| Synthetic recovery comparison and Gemini locator | Our Python implementation and illustrative academic fixture | Engineering demonstrations, not faithful reproductions of named published systems. Restart/retry/checkpoint terminology alone does not prove implementation equivalence. |
| Controlled recovery extension | Released tau task/tools/evaluator plus our detector, dependency rules, snapshots, fault injection and protocol | Custom research hypothesis tested in a preliminary pilot. Both strategies earned 1.0; selective used more work. No demonstrated improvement. |
| Fisk academic checks | [Official B.S. catalog](https://fisk.smartcatalogiq.com/en/bulletin/undergraduate/school-of-natural-science-and-mathematics/department-of-mathematics-and-computer-science/computer-science-bs/), edition 2024–2025; synthetic records and local partial checker | Source-grounded partial calculations, not a recognized public benchmark or complete graduation clearance. Current cohort applicability and ambiguities remain unresolved. |

## Saved information

- [Upstream revisions](baselines/upstream-lock.json): exact source commits and model deviations.
- [Method inventory](baselines/benchmark-method-inventory.md): published candidates versus actual execution status.
- [Recovery specification](recovery-method.md): our detector, dependency and restoration rules.
- [Experimental protocol](tau-recovery-protocol.json): researcher-defined faults, budgets, seeds, pacing amendment and planned trials.
- [Fisk extracted facts](fisk-catalog-rules.json): rule-level source references and unresolved conditions; retrieval manifests under baselines/results preserve capture hashes.
- [Assumptions](assumptions.md) and [progress log](research-log.md): uncertainty, decisions, deviations and work completed.
- [Pilot summary](progress-report-1/evidence/official-task-pilot-summary.md) and baselines/results: actual results, failed attempts, traces and execution provenance.

## Baseline-first requirement

The user requires established methods and recognized datasets before proposed improvements. Existing custom demonstrations are retained and explicitly labeled as exploratory evidence; they do not satisfy faithful published-method reproduction. An unchanged task baseline has executed. Full AgentRx diagnosis and any selected published recovery baseline still need supported access, faithful execution, matched settings and documented results before a published-method-versus-proposal comparison can be claimed. Do not relabel the custom controller as a published baseline or claim every component is research proven.

The Research Lab exposes sources and validation status in Method & data and exported protocol metadata. Historical raw evidence is preserved; current explanatory labels do not rewrite original execution protocols.
