import json
import unittest
from research.fisk_case_study import audit, fixtures, RULES


class FiskCaseStudyTests(unittest.TestCase):
    def setUp(self):
        self.rules = json.loads(RULES.read_text())
        self.cases = fixtures(self.rules)

    def test_120_credits_and_gpa_do_not_clear_unverified_requirements(self):
        result = audit(self.cases["known_rules_met_review_still_required"], self.rules)
        self.assertEqual(result["earned_credits"], 120)
        self.assertEqual(result["fisk_gpa"], 3)
        self.assertEqual(result["status"], "manual_review_required")
        self.assertFalse(result["degree_cleared"])

    def test_missing_course_and_low_grade_fail_known_rules(self):
        missing = audit(self.cases["missing_required_course"], self.rules)
        self.assertEqual(missing["earned_credits"], 117)
        self.assertIn("CSCI 241", missing["missing_known_courses"])
        low = audit(self.cases["major_grade_below_C"], self.rules)
        self.assertEqual(low["earned_credits"], 120)
        self.assertIn("CSCI 241 below C", low["failed_known_rules"])

    def test_duplicate_does_not_inflate_earned_credits(self):
        result = audit(self.cases["duplicate_credit_attempt"], self.rules)
        self.assertEqual(result["earned_credits"], 120)
        self.assertEqual(result["status"], "invalid_record")


if __name__ == "__main__":
    unittest.main()
