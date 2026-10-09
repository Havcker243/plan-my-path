import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.analyze_recovery import analyze


class RecoveryAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.doc = {"action": "tau-recovery", "protocol_sha256": "p1", "adapter_sha256": "a1",
                    "input_sha256": {"db": "d1"}, "configuration": {"model": "test"},
                    "upstream": {"revision": "r1"}, "results": []}

    def save(self, name, rows, protocol="p1"):
        doc = copy.deepcopy(self.doc)
        doc.update(results=rows, protocol_sha256=protocol)
        path = self.root / name
        path.write_text(json.dumps(doc))
        return path

    def row(self, method, reward=1, exercised=True, **extra):
        return dict(strategy=method, task_id="0", fault="empty_read", seed=300,
                    reward=reward, fault_exercised=exercised, **extra)

    def test_null_is_not_zero_and_fault_coverage_has_denominators(self):
        path = self.save("a.json", [self.row("selective", None), self.row("selective", 0),
                                    self.row("selective", 1, False)])
        counts = analyze([path])["groups"][0]["strategies"]["selective"]
        self.assertEqual((counts["graded"], counts["ungraded"]), (2, 1))
        self.assertEqual(counts["mean_reward_graded"], .5)
        self.assertEqual(counts["mean_reward_graded_fault_exercised"], 0)

    def test_protocol_versions_are_not_paired(self):
        a = self.save("a.json", [self.row("no_recovery")])
        b = self.save("b.json", [self.row("selective")], protocol="p2")
        groups = analyze([a, b])["groups"]
        self.assertEqual(len(groups), 2)
        self.assertTrue(all(g["pairs"][0]["status"] == "missing_or_ambiguous_pair" for g in groups))

    def test_more_work_has_positive_delta_and_incomplete_cost_is_excluded(self):
        path = self.save("a.json", [self.row("no_recovery", total_attempt_steps=21, estimated_attempt_cost_usd=.1, cost_usage_complete=True),
                                    self.row("selective", total_attempt_steps=25, estimated_attempt_cost_usd=.2, cost_usage_complete=False)])
        pair = analyze([path])["groups"][0]["pairs"][0]
        self.assertEqual(pair["status"], "eligible")
        self.assertEqual(pair["selective_minus_reference"]["total_attempt_steps"], 4)
        self.assertNotIn("estimated_attempt_cost_usd", pair["selective_minus_reference"])

    def test_duplicate_attempts_are_retained_without_favorable_pair_selection(self):
        path = self.save("a.json", [self.row("no_recovery"), self.row("selective", 0), self.row("selective", 1)])
        group = analyze([path])["groups"][0]
        self.assertEqual(group["attempts"], 3)
        self.assertEqual(group["pairs"][0]["status"], "missing_or_ambiguous_pair")
        with self.assertRaises(ValueError):
            analyze([path, path])

    def test_unexercised_fault_cannot_establish_recovery_pair(self):
        path = self.save("a.json", [self.row("no_recovery"), self.row("selective", 1, False)])
        pair = analyze([path])["groups"][0]["pairs"][0]
        self.assertEqual(pair["status"], "ungraded_or_fault_not_exercised")

    def test_coverage_counts_keep_incomplete_pair_alongside_complete_pair(self):
        a = self.save("a.json", [self.row("no_recovery"), self.row("selective")])
        b = self.save("b.json", [self.row("no_recovery"), self.row("selective", None)], protocol="p2")
        totals = analyze([a, b])["totals"]
        self.assertEqual(totals, {"attempts": 4, "graded_attempts": 3,
                                 "ungraded_attempts": 1, "eligible_pairs": 1, "ineligible_pairs": 1})

    def test_cache_hits_cannot_hide_more_total_tool_work(self):
        path = self.save("v3.json", [
            self.row("no_recovery", tool_executions=8, validation_tool_calls=2, total_tool_invocations=10),
            self.row("selective", tool_executions=6, validation_tool_calls=7, total_tool_invocations=13, cached_reads_reused=2)])
        group = analyze([path])["groups"][0]
        delta = group["pairs"][0]["selective_minus_reference"]
        self.assertEqual(delta["tool_executions"], -2)
        self.assertEqual(delta["total_tool_invocations"], 3)
        self.assertEqual(group["strategies"]["selective"]["work_metrics"]["total_tool_invocations"]["mean"], 13)

    def test_tool_work_summary_excludes_missing_ungraded_and_unexercised_values(self):
        path = self.save("work.json", [self.row("source_rollback", total_tool_invocations=12),
            self.row("source_rollback"), self.row("source_rollback", None, total_tool_invocations=90),
            self.row("source_rollback", 1, False, total_tool_invocations=1)])
        work = analyze([path])["groups"][0]["strategies"]["source_rollback"]["work_metrics"]
        self.assertEqual(work["total_tool_invocations"], {"measured_attempts": 1, "mean": 12})
        self.assertEqual(work["tool_executions"], {"measured_attempts": 0, "mean": None})


if __name__ == "__main__":
    unittest.main()
