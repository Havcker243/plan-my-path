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
from research.tau_recovery import RecoveryController, STRATEGIES, closure
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


if __name__ == "__main__":
    unittest.main()
