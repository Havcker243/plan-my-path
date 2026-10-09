from copy import deepcopy

from app.agent.state import RunState
from app.agent.tools import PlanningTools


STUDENT = {"profile": {"major_code": "CSCI", "graduation_year": 2027, "graduation_term": "Spring"}, "plan": {
    "semesters": [{"term": "Spring", "year": 2026, "courses": [
        {"code": "CSCI-101", "credits": 3, "grade": "A", "status": "completed"}]}]}}
REQUIREMENTS = {"total_credits": 9, "labels": {
    c: {"group_name": "Core", "group_type": "all_of", "credits": 3}
    for c in ("CSCI-101", "CSCI-201", "CSCI-301")}, "coreqs": {}, "rules": []}
CATALOG = [{"course_code": c, "title": title, "credits_min": 3, "credits_max": 3,
            "requisites": {"prerequisites": prereqs, "corequisites": []}, "terms": []}
           for c, title, prereqs in [("CSCI-101", "Introduction", []),
                                    ("CSCI-201", "Data Structures", ["CSCI-101"]),
                                    ("CSCI-301", "Algorithms", ["CSCI-201"])]]
GOOD_PLAN = {"semesters": [{"term": "Fall", "year": 2026, "courses": ["CSCI-201"]},
                           {"term": "Spring", "year": 2027, "courses": ["CSCI-301"]}]}
BAD_PLAN = {"semesters": [{"term": "Fall", "year": 2026, "courses": ["CSCI-301"]}]}


def fixture_tools(state: RunState | None = None):
    return PlanningTools(state or RunState(), lambda: deepcopy(STUDENT),
                         lambda major_code: deepcopy(REQUIREMENTS),
                         lambda subject: deepcopy(CATALOG) if subject == "CSCI" else [],
                         lambda course_codes, term: {c: [] for c in course_codes})
