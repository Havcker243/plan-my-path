# Verified recovery cache — October 9, 2026

## Decision

The pasted Phase 3 update correctly identified a temporal restriction on cache reuse. Its stronger claims need qualification: matching arguments and DB hash do not prove the arguments were independent of corrupt context, or that a stored response is clean. Zero live reuse alone also does not prove a software bug; earlier batch tests already demonstrated some reuse under the original rules.

We retain the conservative dependency graph for reasoning invalidation. Reusing a tool value is a separate, narrower operation: deterministic memoization of the same request against the same isolated database, with explicit verification. This does not establish a minimal recovery boundary or reproduce a published method.

## Implemented rule

1. Execute ordinary reads before recovery; do not apply selective-only caching to an unfaulted prefix.
2. Restore the chosen snapshot. For selective recovery, independently re-execute saved candidate reads against the restored matching DB version. Exclude the detected source and error responses. Compare canonical content and error flags; count each validation call.
3. Reuse only approved values for the exact tool, arguments, requestor and DB hash. Changed arguments/version miss naturally. Writes always execute; cached messages receive the new call ID/timestamp.
4. Record `total_tool_invocations = tool_executions + validation_tool_calls`. A hit is not automatically a net saving: validation itself can erase any avoided replay cost. These are local benchmark tools, not necessarily external API calls.

Trusted tool code, deterministic reads, full DB-hash coverage and faithful canonical comparison remain assumptions. This policy does not make a wrong policy interpretation or an incorrect choice of arguments correct.

## Versioning and next live evidence

The current protocol is `tau-retail-controlled-recovery-v3-verified-cache`; [v2 is preserved](protocol-archive/tau-recovery-v2-before-verified-cache-20261009.json). Existing source/protocol hashes distinguish the versions. The active matrix's guard stops further cells when it observes the change; its completed/current-cell evidence remains preserved. No new large live campaign is launched as part of this redesign.

Before expansion, run one serialized, predeclared bounded comparison with no-recovery, source rollback and selective, keeping original grading and failed/unexercised attempts. Analyze all tool invocations, model calls, task reward and coverage. Do not select fault locations merely to manufacture a selective advantage. If no savings appear, retain and explain that result.

## Verification

All 12 pinned upstream integration tests and three matrix-scheduling tests passed. The integration tests cover delayed source detection, official grading preservation, aligned state restoration, independent batch reuse, no caching before recovery, validation of invalidated read values, rejection of corrupted/source/error/version-mismatched cached values and write bypass. Scripted speakers are software test doubles, not live benchmark performance evidence. [Source-hashed verification record](evidence/verified-cache-redesign-20261009/verification.json). The sandbox could not fetch the remote cost map; upstream used its bundled fallback.
