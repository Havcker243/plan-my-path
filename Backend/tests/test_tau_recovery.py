"""Offline integration with real released tools/evaluator; scripted speakers are test doubles.

Execute with .research-upstream/tau-bench/.venv/Scripts/python.exe.
These are software correctness tests, not live benchmark performance trials.
"""
from pathlib import Path
import os
import importlib.util
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("LOGURU_LEVEL", "ERROR")
if importlib.util.find_spec("tau2") is None:
    raise unittest.SkipTest("Use the pinned tau isolated interpreter for official adapter integration tests")
from research.tau_recovery import RecoveryController, STRATEGIES, closure, digest
from tau2.run import build_orchestrator, load_tasks
from tau2.data_model.simulation import TextRunConfig
from tau2.data_model.message import AssistantMessage, UserMessage, ToolCall, ToolMessage


class TauRecoveryTests(unittest.TestCase):
    def orchestrator(self):
        task = next(t for t in load_tasks("retail", "base") if t.id == "0")
        config = TextRunConfig(domain="retail", llm_agent="mock", llm_user="mock", max_steps=60, seed=300)
        return build_orchestrator(config, task, seed=300)

    def execute(self, strategy, fault="empty_read", parallel=False):
        orch = self.orchestrator()
        uid = next(iter(orch.environment.tools.db.users))

        def agent(**kwargs):
            if kwargs["messages"][-1].role == "tool":
                return AssistantMessage(role="assistant", content="Read complete", cost=0, usage={})
            calls = [ToolCall(id="user-read", name="get_user_details", arguments={"user_id": uid})]
            if parallel:
                calls.append(ToolCall(id="independent-read", name="list_all_product_types", arguments={}))
            return AssistantMessage(role="assistant", tool_calls=calls, cost=0, usage={})

        def user(**kwargs):
            content = "Please read my details" if kwargs["messages"][-1].content.startswith("Hi!") else "###STOP###"
            return UserMessage(role="user", content=content, cost=0, usage={})

        with patch("tau2.agent.llm_agent.generate", side_effect=agent), patch("tau2.user.user_simulator.generate", side_effect=user):
            return RecoveryController(orch, strategy, fault).run()

    def test_delayed_detection_and_source_scoring_without_oracle(self):
        row = self.execute("selective")
        self.assertTrue(row["fault_exercised"])
        self.assertTrue(row["exact_source_accuracy"])
        self.assertEqual(len(row["events"]), 1)
        event = row["events"][0]
        self.assertGreaterEqual(event["detected_at_attempt_step"] - row["source_scoring_only"]["attempt_step"], 2)
        # Actual official reward is preserved: these scripted speakers do not solve the exchange task.
        self.assertEqual(row["reward"], 0)
        self.assertFalse(row["recovery_success"])
        self.assertGreater(row["validation_tool_calls"], 0)

    def test_every_strategy_can_run_with_same_official_evaluator(self):
        for strategy in STRATEGIES:
            with self.subTest(strategy=strategy):
                row = self.execute(strategy)
                self.assertEqual(row["reward"], row["simulation"]["reward_info"]["reward"])
                self.assertLessEqual(len(row["events"]), 1)
                self.assertLessEqual(row["total_attempt_steps"], 60)

    def test_independent_batch_read_reused_but_corrupt_read_reexecuted(self):
        row = self.execute("selective", parallel=True)
        self.assertEqual(row["cached_reads_reused"], 1)
        events = row["events"][0]
        independent = next(n for n in row["trace"] if n.get("tool", {}).get("name") == "list_all_product_types")
        self.assertNotIn(independent["id"], events["invalidated_nodes"])
        self.assertEqual(sum(n.get("cache_hit", False) for n in row["trace"] if n.get("tool", {}).get("name") == "get_user_details"), 0)
        self.assertEqual(row["total_tool_invocations"], row["tool_executions"] + row["validation_tool_calls"])

    def cache_controller(self):
        orch = self.orchestrator()
        orch.initialize()
        controller = RecoveryController(orch, "selective", "none")
        controller.step_node = controller.node("dispatch", [])
        call = ToolCall(id="products", name="list_all_product_types", arguments={})
        key = digest([call.name, call.arguments, call.requestor, orch.environment.get_db_hash()])
        return controller, call, key

    def test_cache_does_not_change_unrecovered_execution(self):
        controller, call, key = self.cache_controller()
        controller.response(call)
        controller.response(call)
        self.assertEqual(controller.cache_hits, 0)
        self.assertEqual(controller.tool_executions, 2)

    def test_invalidated_read_requires_independent_value_validation(self):
        controller, call, key = self.cache_controller()
        controller.response(call)
        controller.invalidated.add(controller.cache[key]["node_id"])
        controller.recoveries = 1
        controller.verify_recovery_cache()
        self.assertIn(key, controller.verified_cache)
        controller.response(call.model_copy(update={"id": "new-call"}))
        self.assertEqual(controller.cache_hits, 1)
        self.assertEqual(controller.tool_executions, 1)
        self.assertEqual(controller.validation_calls, 1)
        self.assertEqual(controller.reads[-1]["response"].id, "new-call")

    def test_corrupt_descendant_response_is_not_reused(self):
        controller, call, key = self.cache_controller()
        controller.response(call)
        controller.cache[key]["response"].content = '[]'
        controller.invalidated.add(controller.cache[key]["node_id"])
        controller.recoveries = 1
        controller.verify_recovery_cache()
        self.assertNotIn(key, controller.verified_cache)
        controller.response(call)
        self.assertEqual(controller.cache_hits, 0)
        self.assertEqual(controller.tool_executions, 2)

    def test_source_error_and_changed_db_cannot_validate_for_reuse(self):
        for reason in ("source", "error", "database"):
            with self.subTest(reason=reason):
                controller, call, key = self.cache_controller()
                controller.response(call)
                controller.recoveries = 1
                if reason == "source":
                    controller.detected = controller.cache[key]["node_id"]
                elif reason == "error":
                    controller.cache[key]["response"].error = True
                else:
                    uid = next(iter(controller.o.environment.tools.db.users))
                    controller.o.environment.tools.db.users[uid].address.city = "Different version"
                controller.verify_recovery_cache()
                self.assertNotIn(key, controller.verified_cache)
                controller.response(call)
                self.assertEqual(controller.cache_hits, 0)

    def test_mutating_calls_bypass_even_a_verified_cache_key(self):
        controller, call, key = self.cache_controller()
        controller.response(call)
        controller.recoveries = 1
        controller.verify_recovery_cache()
        with patch.object(controller.o.environment, "_is_mutating_tool", return_value=True):
            controller.response(call)
        self.assertEqual(controller.cache_hits, 0)
        self.assertEqual(controller.tool_executions, 2)

    def test_snapshot_restores_database_and_conversation_together(self):
        orch = self.orchestrator()
        orch.initialize()
        controller = RecoveryController(orch, "selective", "none")
        snapshot = controller.snapshot()
        original_hash = orch.environment.get_db_hash()
        uid = next(iter(orch.environment.tools.db.users))
        orch.environment.tools.db.users[uid].address.city = "Injected changed city"
        orch.agent_state.messages.clear()
        self.assertNotEqual(orch.environment.get_db_hash(), original_hash)
        controller.restore(snapshot)
        self.assertEqual(orch.environment.get_db_hash(), original_hash)
        self.assertTrue(orch.agent_state.messages)

    def test_no_fault_has_no_fabricated_localization_score(self):
        row = self.execute("selective", fault="none")
        self.assertFalse(row["fault_exercised"])
        self.assertIsNone(row["exact_source_accuracy"])
        self.assertIsNone(row["recovery_success"])

    def test_all_fault_types_are_detected(self):
        for fault in ("empty_read", "wrong_user_id", "tool_error"):
            with self.subTest(fault=fault):
                self.assertTrue(self.execute("selective", fault)["exact_source_accuracy"])

    def test_user_stop_at_confirmation_prevents_next_agent_action(self):
        # Reproduce the termination mechanism without claiming live performance.
        orch = self.orchestrator()
        before = orch.environment.get_db_hash()
        uid = next(iter(orch.environment.tools.db.users))
        calls = []

        def agent(**kwargs):
            calls.append("agent")
            if kwargs["messages"][-1].role == "tool":
                return AssistantMessage(role="assistant", content="Please confirm the exchange", cost=0, usage={})
            return AssistantMessage(role="assistant", tool_calls=[ToolCall(
                id="read", name="get_user_details", arguments={"user_id": uid})], cost=0, usage={})

        def user(**kwargs):
            content = "Please exchange my items" if kwargs["messages"][-1].content.startswith("Hi!") else "Yes, please proceed. ###STOP###"
            return UserMessage(role="user", content=content, cost=0, usage={})

        with patch("tau2.agent.llm_agent.generate", side_effect=agent), patch("tau2.user.user_simulator.generate", side_effect=user):
            row = RecoveryController(orch, "no_recovery", "none").run()
        self.assertEqual(len(calls), 2)
        self.assertEqual(row["termination_reason"], "user_stop")
        self.assertEqual(row["reward"], 0)
        self.assertFalse(row["fault_exercised"])
        self.assertEqual(orch.environment.get_db_hash(), before)
        self.assertFalse(any(n["kind"] == "write" for n in row["trace"]))


if __name__ == "__main__":
    unittest.main()
