# Live Test and Flow Review — October 7, 2026

Real Google API requests were executed using synthetic fixtures. No production agent code or environment file was changed. Report drafting remains paused.

## Planning result

`live-planning-alternate-model-2026-10-07.json` records a completed `gemini-3.5-flash-lite` planning session: three model calls, model-requested `read_catalog` and `propose_plan`, deterministic acceptance, final response, and execution trace. Student and requirement reads were supplied by the harness before model generation. The generated proposal schedules illustrative `CSCI-201` in Fall 2026 and `CSCI-301` in Spring 2027. It is an unsaved proposal for a synthetic nine-credit degree, not Fisk's curriculum.

The initial sandboxed planning request could not connect. Two subsequent network-enabled attempts using the default `gemini-3.6-flash` returned HTTP 503 UNAVAILABLE. All attempts remain saved; the successful alternate-model run must not be presented as first-attempt reliability. The model override applied only to that command process.

## Recovery result

`live-recovery-network-retry-2026-10-07.json` records a completed `gemini-3.5-flash-lite` diagnosis. The first sandboxed recovery attempt could not connect and remains saved separately.

1. The fixture reads correct student and requirement inputs.
2. A controlled fault makes step 3 return an empty remaining-course list.
3. Step 6 produces an empty proposal.
4. Step 7 rejects it with expected and observed course sets.
5. Gemini receives the observable trace and violation, without the hidden fault label. It selects source step 3 and supplies confidence and an evidence-based rationale.
6. The graph invalidates task nodes 3, 6, and 7. Diagnostic node 8 is also marked invalidated because it consumes the old trace; its recorded output remains available for audit.
7. Nodes 1, 2, 4, and 5 are reused. Three task nodes are recomputed as nodes 9, 10, and 11.
8. Final validation passes.

Recorded metrics: one diagnosis model call, 875 tokens, approximately 1.99 seconds recovery time, three repeated task steps plus one diagnostic step, four retained correct nodes, and invalidation precision/recall/F1 of 1.0. These metrics describe one smoke test. The section lookup is retained but unused by the final proposal.

`live-flow-audit-2026-10-07.json` checks nine trace properties, including source selection, affected-node invalidation, dependency ordering, explicit reuse, and final validation. All nine pass. Reproduce the audit without API calls using:

```powershell
python docs/research/progress-report-1/check_live_flow.py
```

## What is ready to demonstrate

The real model can generate a structured plan through tools. A separate real model call can identify the fault in a delayed-failure trace, after which dependency-driven deterministic replay repairs the result. Code, input/output traces, validator evidence, diagnosis rationale, invalidation/reuse events, tokens, and replay counts are available for a progress demonstration.

## What is still missing from the proposed research

- A single integrated session that diagnoses and selectively re-plans a faulty live-generated workflow; recovery proposal generation is deterministic in this harness.
- Verified, frozen Fisk catalog requirements and synthetic records grounded in those sources.
- General localization and conservative recovery-boundary rules beyond the one supported example.
- Multiple fault scenarios and repeated paired comparisons across all strategies.
- Durable checkpoint restoration; the existing checkpoint baseline simulates a replay boundary.
- Calculated API cost, consistently recorded source/rule versions, full generation settings, and embedded collection timestamps.

The current prototype supports an honest progress report and demonstration. It does not yet satisfy the full research evaluation promised in the proposal.
