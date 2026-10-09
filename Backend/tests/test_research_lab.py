"""Access, truthful scoring, and real offline API-to-artifact execution checks."""
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app import research_lab as lab


class ResearchLabTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.paths = patch.object(lab, "RUNS", Path(self.temp.name))
        self.paths.start()
        self.addCleanup(self.paths.stop)
        self.config = patch.dict("os.environ", {"RESEARCH_OPERATOR_EMAILS": "research@fisk.edu", "RESEARCH_LAB_ENABLED": "true"})
        self.config.start()
        self.addCleanup(self.config.stop)
        app = FastAPI()
        self.user = {"sub": "test-operator", "email": "research@fisk.edu"}
        app.include_router(lab.create_router(lambda: self.user))
        self.client = TestClient(app)

    def test_non_operator_cannot_read_or_execute(self):
        self.user["email"] = "other@fisk.edu"
        self.assertEqual(self.client.get("/api/research/runs").status_code, 403)
        self.assertEqual(self.client.post("/api/research/runs", json={"action": "custom-offline"}).status_code, 403)

    def test_research_settings_load_from_local_file_without_global_dotenv(self):
        with patch.dict("os.environ", {}, clear=True), patch.object(lab, "_load_env_lines", return_value={"RESEARCH_LAB_ENABLED": "true"}):
            self.assertEqual(lab.research_setting("RESEARCH_LAB_ENABLED", "false"), "true")
            self.assertEqual(lab.research_setting("RESEARCH_OPERATOR_EMAILS"), "")

    def test_disabled_unknown_and_concurrent_runs_are_rejected(self):
        with patch.dict("os.environ", {"RESEARCH_LAB_ENABLED": "false"}):
            self.assertEqual(self.client.post("/api/research/runs", json={"action": "custom-offline"}).status_code, 403)
        self.assertEqual(self.client.post("/api/research/runs", json={"action": "../arbitrary-command"}).status_code, 422)
        lab.LOCK.acquire()
        try:
            self.assertEqual(self.client.post("/api/research/runs", json={"action": "custom-offline"}).status_code, 409)
        finally:
            lab.LOCK.release()

    def test_official_zero_reward_is_preserved(self):
        folder = Path(self.temp.name)
        manifest = folder / "manifest.json"
        manifest.write_text(json.dumps({"evidence_scope": "one task", "executions": [{"exit_code": 0}]}))
        (folder / "official-results.json").write_text(json.dumps({
            "info": {"agent_info": {"llm": "test"}},
            "simulations": [{"task_id": "0", "reward_info": {"reward": 0.0}, "termination_reason": "user_stop"}]}))
        result = lab.describe(manifest, "tau-smoke")
        self.assertEqual(result["rows"][0]["reward"], 0.0)
        self.assertNotEqual(result["comparison_group"], "synthetic-delayed-audit-v1")
        self.assertIn("no custom recovery adapter", result["protocol"]["method"])
        self.assertEqual(len(result["artifacts"]), 2)

    def test_offline_run_through_api_records_real_results_and_trace(self):
        response = self.client.post("/api/research/runs", json={"action": "custom-offline"})
        self.assertEqual(response.status_code, 202)
        job_id = response.json()["id"]
        deadline = time.monotonic() + 20
        while lab.LOCK.locked() and time.monotonic() < deadline:
            time.sleep(.05)
        self.assertFalse(lab.LOCK.locked(), "Offline job failed to complete")
        item = next(r for r in self.client.get("/api/research/runs").json()["runs"] if r["id"] == job_id)
        self.assertEqual(item["status"], "completed", item)
        self.assertEqual(item["exit_code"], 0)
        rows = {r["strategy"]: r for r in item["evidence"]["rows"]}
        self.assertTrue(rows["selective"]["success"])
        self.assertFalse(rows["visible_retry"]["success"])
        self.assertEqual(rows["selective"]["repeated_steps"], 3)
        self.assertTrue(rows["selective"]["trace"])
        self.assertTrue(item["source_sha256"])
        self.assertIn("one execution per strategy", item["evidence"]["protocol"]["design"])
        artifact = item["evidence"]["artifacts"][0]
        self.assertEqual(len(artifact["sha256_at_inspection"]), 64)

    def test_inspection_hash_changes_if_artifact_bytes_change(self):
        path = Path(self.temp.name) / "evidence.json"
        path.write_text('{"reward": 0}')
        before = lab.artifact_record(path)
        path.write_text('{"reward": 1}')
        after = lab.artifact_record(path)
        self.assertNotEqual(before["sha256_at_inspection"], after["sha256_at_inspection"])

    def test_archived_provider_failure_remains_visible_and_ungraded(self):
        folder = Path(self.temp.name)
        path = folder / "live-recovery-failed.json"
        path.write_text(json.dumps({"model": "test", "limitations": "one trial", "results": [
            {"strategy": "agent_selective", "success": False, "provider_error": {"error_type": "ConnectError"}}]}))
        with patch.object(lab, "EVIDENCE", folder):
            item = next(r for r in lab.history() if r["id"] == "archive-live-recovery-failed")
        self.assertEqual(item["status"], "failed")
        self.assertIn("provider_error", item["evidence"]["rows"][0])
        self.assertNotIn("exact_source_accuracy", item["evidence"]["rows"][0])

    def test_matrix_archive_preserves_zero_and_ignores_partial_files(self):
        base = Path(self.temp.name) / "baselines"
        folder = base / "tau-matrix-test"
        folder.mkdir(parents=True)
        data = {"action": "tau-recovery", "started_at": "2026-10-09T00:00:00Z",
                "ended_at": "2026-10-09T00:01:00Z", "configuration": {"llm_agent": "test"},
                "protocol_sha256": "p" * 64, "adapter_sha256": "a" * 64,
                "limitations": "one cell", "results": [{"strategy": "selective", "task_id": "0",
                "seed": 301, "fault": "empty_read", "reward": 0.0, "fault_exercised": True}]}
        (folder / "cell-000.json").write_text(json.dumps(data))
        data.pop("ended_at")
        data["results"] = []
        (folder / "cell-001.json").write_text(json.dumps(data))
        with patch.object(lab, "BASELINES", base), patch.object(lab, "EVIDENCE", base):
            rows = lab.history()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], "tau-matrix-test-cell-000")
        self.assertEqual(rows[0]["status"], "completed")
        self.assertEqual(rows[0]["evidence"]["rows"][0]["reward"], 0.0)

    def test_interrupted_run_does_not_claim_completion(self):
        folder = Path(self.temp.name) / "old"
        folder.mkdir()
        lab.save(folder, {"id": "old", "action": "custom-offline", "status": "running"})
        item = next(r for r in lab.history() if r["id"] == "old")
        self.assertEqual(item["status"], "interrupted")


if __name__ == "__main__":
    unittest.main()
