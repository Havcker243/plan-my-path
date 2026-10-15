# AgentRx public-sample pipeline: completed

All six official stages completed on October 9, 2026: IR normalization, static invariants, dynamic invariants, checking, judge and report. Process exit was 0; recorded pipeline duration was 314.4 seconds. Input was the fixed first lexicographically sorted public sample, `hallucination_doubt.json` (task 39, 26 trace steps). This is pipeline execution evidence, not full-dataset or paper-model reproduction.

## Observed diagnosis

The judge flagged failure case 2 at trace step 17: an unsupported claim about what order details could reveal, used instead of checking available information. No ground-truth file was supplied to the original run, so its raw output contains no comparison.

Subsequent inspection found a released annotation for task 39 in the pinned checkout. A separate, read-only comparison of the frozen prediction found an **exact root-step match (17)** but a **category mismatch**: the judge predicted "Invention of New Information" (2), whereas the annotation labels "Intent Plan Misalignment" (5). Both released annotation copies agree and represent the same single case. [Comparison and input hashes](annotation-comparison.json) preserve the evidence without changing the raw run or making new model calls.

At step 17, the assistant claims it cannot retrieve the requested address from order details instead of checking them. The released annotation identifies that decision as the root failure. This is one annotated case and one judge pass, not dataset-level accuracy, proof of a minimal recovery boundary or demonstrated recovery success. Prior benchmark exposure or overlap with upstream examples has not been excluded.

The checker recorded six successful Python checks and an empty violations list. The judge's diagnosis despite that list shows why process completion and successful individual checks cannot establish complete failure-detection coverage. No recovery controller was evaluated by this diagnostic run.

## Configuration and retained failures

- Clean official source pinned to `7a18c79708e7671be15124460f4f7296107c2a55`; original locally edited checkout preserved.
- Copilot CLI 1.0.94; successful authenticated text-response preflight.
- The original `claude-opus-4.6` default was unavailable. [That failed attempt](../agentrx-full-20261009T093506Z-655e02/manifest.json) is retained.
- Successful run substituted Copilot `auto` routing. The actual routed model was not captured, so fixed-model reproducibility and paper-result equivalence are not established.
- A text-only wrapper disabled Copilot tools, builtin MCPs, custom instructions and auto-update. Per-call timeout was 120 seconds; outer wrapper timeout 900 seconds. These runtime deviations are explicit.

## Evidence

- [Execution manifest](manifest.json)
- [Runtime provenance](provider-runtime.json)
- [Complete console output](hallucination_doubt.txt)
- [Stage completion state](hallucination_doubt/state.json)
- [Judge prediction](hallucination_doubt/judge_output/runs/run1.json)
- [Post-run annotation comparison](annotation-comparison.json)
- [Checker telemetry](hallucination_doubt/checker_results/39/telemetry_tau.json)
- [Checker violations](hallucination_doubt/checker_results/39/violations_tau.json)
- [Generated plot](hallucination_doubt/plots/predicted.png)

The site action uses the tested clean-checkout/Copilot-auto configuration and a clearer public-sample label. Nine Research Lab integration tests passed. Local readiness checks verify setup paths, not future provider capacity or authentication validity.
