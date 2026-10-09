import copy
import unittest

from google.genai import types

from app.agent.runtime import run_agent
from app.agent.state import RunState
from app.agent.validation import Proposal, audit, validate
from research.fixtures import BAD_PLAN, GOOD_PLAN, STUDENT, REQUIREMENTS, CATALOG, fixture_tools


class RecoveryTests(unittest.TestCase):
    def test_delayed_failure_benchmark_has_expected_outcomes(self):
        from research.benchmark import experiment, STRATEGIES
        results = {s: experiment(s) for s in STRATEGIES}
        self.assertFalse(results["visible_retry"]["success"])
        self.assertFalse(results["checkpoint"]["success"])
        self.assertTrue(results["selective"]["success"])
        self.assertEqual(results["selective"]["repeated_steps"], 3)
        self.assertEqual(results["selective"]["preserved_valid_steps"], 4)
        self.assertEqual(results["restart"]["repeated_steps"], 7)

    def test_agent_locator_is_scored_against_hidden_source(self):
        from research.benchmark import experiment
        seen = []
        def locator(observation):
            seen.append(observation)
            return {"source_step_id": "3", "confidence": 0.9, "rationale": "The remaining-course output contradicts its inputs."}
        result = experiment("agent_selective", locator=locator)
        self.assertTrue(result["success"])
        self.assertTrue(result["exact_source_accuracy"])
        self.assertEqual(result["invalidation_f1"], 1.0)
        self.assertNotIn("true_source_step", seen[0])
        self.assertNotIn("injected", seen[0])

    def test_wrong_agent_localization_is_not_converted_to_success(self):
        from research.benchmark import experiment
        result = experiment("agent_selective", locator=lambda _: {
            "source_step_id": "7", "confidence": 0.8, "rationale": "Incorrectly chose the visible failure."
        })
        self.assertFalse(result["success"])
        self.assertFalse(result["exact_source_accuracy"])
        self.assertFalse(result["safe_boundary"])

    def test_invalidation_preserves_independent_branch_and_copies(self):
        state = RunState()
        value, a = state.execute("source", {}, [], lambda: {"value": 1})
        value["value"] = 100
        _, b = state.execute("dependent", {}, [a], lambda: 2)
        _, c = state.execute("independent", {}, [], lambda: 3)
        self.assertEqual(state.step(a).output["value"], 1)
        self.assertEqual(set(state.invalidate([a], "test")), {a, b})
        _, reused = state.execute("independent", {}, [], lambda: self.fail("Should reuse"))
        self.assertEqual(reused, c)

    def test_rejected_plan_then_repair_reuses_catalog(self):
        tools = fixture_tools()
        result = tools.call("propose_plan", BAD_PLAN)["result"]
        self.assertFalse(result["valid"])
        self.assertIsNone(tools.proposal)
        repaired = tools.call("propose_plan", GOOD_PLAN)["result"]
        self.assertTrue(repaired["valid"])
        self.assertEqual(len([s for s in tools.state.steps if s.name == "catalog"]), 1)
        self.assertEqual(len([s for s in tools.state.steps if s.status == "invalidated"]), 2)

    def test_transient_read_retry_is_recorded(self):
        tools = fixture_tools()
        attempts = []
        def source(subject):
            attempts.append(subject)
            if len(attempts) == 1:
                raise ConnectionError("synthetic")
            return CATALOG
        tools.loaders["catalog"] = source
        tools.call("read_catalog", {"subject": "CSCI"})
        self.assertEqual(len(attempts), 2)
        self.assertEqual(tools.state.steps[0].status, "error")

    def test_no_cross_student_cache(self):
        first, second = fixture_tools(), fixture_tools()
        first.call("read_student", {})
        second.loaders["student"] = lambda: {"profile": {}, "plan": None}
        self.assertIsNone(second.call("read_student", {})["result"]["plan"])

    def test_trace_redacts_academic_records(self):
        tools = fixture_tools()
        tools.call("read_student", {})
        row = tools.state.trace()["steps"][0]
        self.assertEqual(set(row["output"]), {"sha256"})


class AcademicTests(unittest.TestCase):
    def test_earlier_prerequisite_required_not_same_semester(self):
        proposal = Proposal.model_validate({"semesters": [{"term": "Fall", "year": 2026, "courses": ["CSCI-201", "CSCI-301"]}]})
        self.assertFalse(validate(proposal, STUDENT, REQUIREMENTS, CATALOG)["valid"])

    def test_unknown_duplicate_completed_courses(self):
        for codes in (["CSCI-999"], ["CSCI-201", "CSCI-201"], ["CSCI-101"]):
            with self.subTest(codes=codes):
                p = Proposal.model_validate({"semesters": [{"term": "Fall", "year": 2026, "courses": codes}]})
                self.assertFalse(validate(p, STUDENT, REQUIREMENTS, CATALOG)["valid"])

    def test_completed_failed_course_not_counted(self):
        student = copy.deepcopy(STUDENT)
        student["plan"]["semesters"][0]["courses"][0]["grade"] = "F"
        self.assertEqual(audit(student, REQUIREMENTS)["completed_credits"], 0)

    def test_choice_group_requires_only_one(self):
        req = copy.deepcopy(REQUIREMENTS)
        for entry in req["labels"].values():
            entry["group_type"] = "choose_one"
        self.assertTrue(audit(STUDENT, req)["groups"][0]["satisfied"])

    def test_ambiguous_requisite_is_not_silently_validated(self):
        catalog = copy.deepcopy(CATALOG)
        catalog[1]["requisites"] = "CSCI 101 or instructor consent"
        result = validate(Proposal.model_validate(GOOD_PLAN), STUDENT, REQUIREMENTS, catalog)
        self.assertTrue(any("complex requisites" in w for w in result["warnings"]))
        self.assertFalse(result["official_degree_clearance"])


class RuntimeTests(unittest.TestCase):
    def test_tool_roundtrip_preserves_signature_and_repairs(self):
        responses = [
            types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[
                types.Part(function_call=types.FunctionCall(name="propose_plan", args=BAD_PLAN, id="bad"), thought_signature=b"opaque")]))]),
            types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[
                types.Part(function_call=types.FunctionCall(name="propose_plan", args=GOOD_PLAN, id="good"))]))]),
            types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part(text="Done")]))]),
        ]
        rounds = []
        def generate(**kwargs):
            rounds.append(copy.deepcopy(kwargs["contents"]))
            return responses.pop(0)
        tools = fixture_tools()
        events = list(run_agent(None, "test", "Plan my semesters", [], tools, generate=generate))
        self.assertTrue(any(e.get("proposal") == GOOD_PLAN for e in events))
        self.assertEqual(tools.state.usage["model_calls"], 3)
        signature = [p.thought_signature for c in rounds[1] for p in c.parts if p.thought_signature]
        self.assertEqual(signature, [b"opaque"])
        self.assertTrue(any("Proposed plan" in e.get("chunk", "") for e in events))

    def test_step_budget_stops_loop(self):
        def generate(**kwargs):
            return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[
                types.Part(function_call=types.FunctionCall(name="read_student", args={}))]))])
        events = list(run_agent(None, "test", "Hello", [], fixture_tools(), max_rounds=2, generate=generate))
        self.assertIn("step limit", events[-1]["error"])


if __name__ == "__main__":
    unittest.main()
