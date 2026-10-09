# Inspection of the graded selective failure

Source: [seed-301 selective artifact](../../baselines/results/tau-matrix-20261009T044036Z-e96b6c/cell-000.json). This is a post-hoc inspection; it does not modify grading or the detection algorithm.

## Recorded sequence

1. The controller detected source node 18 at attempt step 14 and restored the snapshot at attempt step 12. It invalidated nodes 18 and 19. The recorded source-scoring field agrees with the predicted source.
2. The final retained conversation contains corrected user-account details, a calculation of the price difference, and an assistant request for confirmation of the proposed exchange.
3. The final simulated user message confirms the exchange and contains `###STOP###`.
4. There is no subsequent assistant exchange-tool call. The official evaluator records a failed required `exchange_delivered_order_items` action match and a database mismatch. Reward remains 0.0.

## Termination mechanism

The pinned upstream `UserSimulator.is_stop` recognizes the STOP marker. In `src/tau2/orchestrator/orchestrator.py`, the AGENT/ENV-to-USER branch sets `done = True` and `termination_reason = USER_STOP` immediately when the generated user message contains that marker. The next agent dispatch therefore does not occur.

The new offline integration test `test_user_stop_at_confirmation_prevents_next_agent_action` reproduces this sequence with scripted speakers and no injected fault: after a read and confirmation question, the simulated confirmation includes STOP; the agent receives no additional generation, the database is unchanged, no write node exists, and official reward is zero. This is a mechanism check, not another live benchmark trial.

## Supported interpretation

The pinned `data/tau2/user_simulator/simulation_guidelines.md` instructs the simulated user to continue until the task is complete and emit STOP when its goal is satisfied. Since the required write had not occurred, the observed confirmation-and-stop is flagged as premature simulated-user termination. This is a post-hoc explanatory annotation, not an exclusion rule: official reward zero remains in all analysis denominators.

For this saved run, the immediate endpoint is simulated-user termination before the required write, rather than evidence that the corrupted user details persisted in the final retained context. Correct localization and restored data did not yield a successful task because the workflow ended with unmet requirements.

It is not established that removing STOP would produce success, that selective recovery caused the simulated user's termination, or that the same seed without recovery would behave identically. No user prompt or official evaluator was changed. Report user_stop and reward independently: termination describes how execution ended, not whether requirements were satisfied.
