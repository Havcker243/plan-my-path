from __future__ import annotations

import re
from typing import Callable

from pydantic import BaseModel, ConfigDict, Field

from .state import RunState
from .validation import Proposal, audit, validate


class Empty(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CatalogArgs(Empty):
    subject: str = Field(pattern=r"^[A-Z]{2,6}$")


class SectionArgs(Empty):
    course_codes: list[str] = Field(min_length=1, max_length=10)
    term: str = Field(min_length=1, max_length=40)


SCHEMAS = {
    "read_student": (Empty, "Read the authenticated student's profile and saved coursework."),
    "read_requirements": (Empty, "Read the student's major requirements and corequisites."),
    "read_catalog": (CatalogArgs, "Retrieve catalog courses, credits and requisites for a subject."),
    "read_sections": (SectionArgs, "Retrieve sections for course codes and a term, without reserving seats."),
    "audit_progress": (Empty, "Calculate completed credits and progress against supported requirement groups."),
    "propose_plan": (Proposal, "Submit a semester proposal for deterministic validation. Fix reported errors by submitting a new proposal. Does not save the plan."),
}


class PlanningTools:
    def __init__(self, state: RunState, student: Callable, requirements: Callable, catalog: Callable, sections: Callable):
        self.state = state
        self.loaders = {"student": student, "requirements": requirements, "catalog": catalog, "sections": sections}
        self.proposal: dict | None = None
        self.validation: dict | None = None

    def source(self, name: str, args: dict | None = None, deps: list[str] | None = None):
        args = args or {}
        # A failed read gets one retry; successful independent reads stay cached.
        for attempt in range(2):
            try:
                return self.state.execute(name, args, deps or [], lambda: self.loaders[name](**args))
            except (ValueError, TypeError, KeyError):
                raise
            except Exception:
                if attempt:
                    raise
                self.state.events.append({"event": "retry", "tool": name})

    def student(self):
        return self.source("student")

    def requirements(self):
        student, student_id = self.student()
        return self.source("requirements", {"major_code": student.get("profile", {}).get("major_code") or "UNDECLARED"}, [student_id])

    def call(self, name: str, args: dict) -> dict:
        if name not in SCHEMAS:
            raise ValueError("Unknown tool")
        parsed = SCHEMAS[name][0].model_validate(args)
        if name == "read_student":
            value, step_id = self.student()
        elif name == "read_requirements":
            value, step_id = self.requirements()
        elif name == "read_catalog":
            value, step_id = self.source("catalog", parsed.model_dump())
        elif name == "read_sections":
            value, step_id = self.source("sections", parsed.model_dump())
        else:
            student, student_id = self.student()
            requirements, req_id = self.requirements()
            if name == "audit_progress":
                value, step_id = self.state.execute("audit", {}, [student_id, req_id], lambda: audit(student, requirements))
            else:
                self.proposal = None
                self.validation = None
                rows, dependencies = [], [student_id, req_id]
                subjects = sorted({re.match(r"[A-Za-z]+", c).group().upper() for s in parsed.semesters for c in s.courses})
                for subject in subjects:
                    courses, catalog_id = self.source("catalog", {"subject": subject})
                    rows.extend(courses)
                    dependencies.append(catalog_id)
                # Model proposals may depend on any prior observation, not only named tools.
                observed = [s.id for s in self.state.steps if s.status == "ok"]
                proposal, proposal_id = self.state.execute("proposal", parsed.model_dump(), observed, parsed.model_dump)
                value, step_id = self.state.execute("validate", {}, [proposal_id, *dependencies], lambda: validate(parsed, student, requirements, rows))
                if value["valid"]:
                    self.proposal, self.validation = proposal, value
                else:
                    self.state.invalidate([proposal_id], "Deterministic checks rejected this proposal; retain source reads for revision.")
                value = {"proposal": proposal, **value}
        return {"step_id": step_id, "result": value}


def database_tools(state: RunState, pooler_url: str, user_id: str) -> PlanningTools:
    from app import db

    def student():
        profile = db.fetch_profile(pooler_url, user_id) or {}
        # Send only academic fields; identifiers and contact details are unnecessary.
        profile = {k: profile.get(k) for k in ("major_code", "minor_code", "graduation_term", "graduation_year", "gpa")}
        plan = db.fetch_plan(pooler_url, user_id)
        if plan:
            plan = {"semesters": [{"term": s["term"], "year": s["year"], "courses": [
                {k: c.get(k) for k in ("code", "title", "credits", "grade", "status")} for c in s["courses"]
            ]} for s in plan["semesters"]]}
        return {"profile": profile, "plan": plan}

    def requirements(major_code):
        result = db.fetch_course_labels(pooler_url, major_code)
        for rule in result.get("rules", []):
            rule["exclude_courses"] = sorted(rule.get("exclude_courses") or [])
        return result

    return PlanningTools(state, student, requirements,
        lambda subject: db.fetch_courses_by_subject(pooler_url, subject),
        lambda course_codes, term: db.fetch_sections_by_course_codes(pooler_url, course_codes, term))
