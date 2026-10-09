"""Conservative checks over catalog snapshots; not an official degree audit."""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def code(value: str) -> str:
    return re.sub(r"[\s-]+", "", str(value)).upper()


class SemesterProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    term: Literal["Spring", "Summer", "Fall", "Winter"]
    year: int = Field(ge=2000, le=2100)
    courses: list[str] = Field(min_length=1, max_length=10)

    @field_validator("courses")
    @classmethod
    def valid_codes(cls, values):
        if any(not re.fullmatch(r"[A-Za-z]{2,6}[- ]?\d{2,4}[A-Za-z]?", v) for v in values):
            raise ValueError("Use catalog course codes")
        return values


class Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    semesters: list[SemesterProposal] = Field(min_length=1, max_length=16)


def completed_courses(student: dict) -> dict:
    result = {}
    for semester in (student.get("plan") or {}).get("semesters", []):
        for course in semester.get("courses", []):
            if course.get("status") == "completed" and str(course.get("grade") or "").upper() not in {"F", "W", "WF", "I", "IP", "NP", "NC"}:
                result[code(course["code"])] = course
    return result


def audit(student: dict, requirements: dict, additional: dict | None = None) -> dict:
    earned = completed_courses(student)
    covered = {**earned, **(additional or {})}
    groups: dict[str, dict] = {}
    for course_code, entry in requirements.get("labels", {}).items():
        name = entry.get("group_name") or "Other"
        group = groups.setdefault(name, {"name": name, "type": entry.get("group_type"), "options": [], "matched": [], "credits": 0, "courses_required": entry.get("courses_required"), "credits_required": entry.get("credits_required_min") or entry.get("credits_required_max")})
        group["options"].append(course_code)
        if code(course_code) in covered:
            group["matched"].append(course_code)
            group["credits"] += float(entry.get("credits") or 0)
    for group in groups.values():
        kind = group["type"]
        if kind == "all_of":
            satisfied = len(group["matched"]) == len(group["options"])
        elif kind == "choose_one":
            satisfied = len(group["matched"]) >= 1
        elif kind == "choose_n" and group["courses_required"] is not None:
            satisfied = len(group["matched"]) >= group["courses_required"]
        elif kind == "credit_threshold" and group["credits_required"] is not None:
            satisfied = group["credits"] >= float(group["credits_required"])
        else:
            satisfied = None
        group["satisfied"] = satisfied
    return {
        "completed_credits": sum(float(c.get("credits") or 0) for c in earned.values()),
        "total_credits_required": requirements.get("total_credits", 120),
        "groups": list(groups.values()),
        "coverage": "partial",
        "limitations": ["Course-label data may omit overlapping or empty groups. Subject-level elective rules, grade minima, residency and transfer equivalencies need advisor review."],
    }


def _simple_codes(value) -> list[str] | None:
    if value is None or value == []:
        return []
    if not isinstance(value, list) or any(not isinstance(v, str) or not re.fullmatch(r"[A-Za-z]{2,6}[- ]?\d{2,4}[A-Za-z]?", v) for v in value):
        return None
    return [code(v) for v in value]


def validate(proposal: Proposal, student: dict, requirements: dict, catalog: list[dict]) -> dict:
    by_code = {code(c["course_code"]): c for c in catalog}
    completed = completed_courses(student)
    prior = set(completed)
    added: dict = {}
    errors: list[str] = []
    warnings: list[str] = []
    terms = {"Spring": 0, "Summer": 1, "Fall": 2, "Winter": 3}
    ordered = sorted(proposal.semesters, key=lambda s: (s.year, terms[s.term]))
    term_keys = [(s.year, s.term) for s in ordered]
    if len(term_keys) != len(set(term_keys)):
        errors.append("A semester appears more than once.")
    for semester in ordered:
        current = {code(c) for c in semester.courses}
        if len(current) != len(semester.courses):
            errors.append(f"Duplicate courses in {semester.term} {semester.year}.")
        credits = 0.0
        for raw in semester.courses:
            key = code(raw)
            course = by_code.get(key)
            if course is None:
                errors.append(f"{raw}: not found in the retrieved catalog.")
                continue
            if key in prior:
                errors.append(f"{raw}: already completed or proposed in an earlier semester.")
            minimum, maximum = course.get("credits_min"), course.get("credits_max")
            if minimum is None or maximum is None or minimum != maximum:
                warnings.append(f"{raw}: credit value needs confirmation.")
            credits += float(minimum or 0)
            requisites = course.get("requisites")
            if isinstance(requisites, dict):
                prereqs = _simple_codes(requisites.get("prerequisites"))
                coreqs = _simple_codes(requisites.get("corequisites"))
                if requisites.get("raw"):
                    warnings.append(f"{raw}: catalog prerequisite prose needs review, including alternatives and minimum grades.")
            else:
                prereqs = _simple_codes(requisites)
                coreqs = []
            if prereqs is None or coreqs is None:
                warnings.append(f"{raw}: complex requisites need advisor review.")
            else:
                missing = set(prereqs) - prior
                if missing:
                    errors.append(f"{raw}: missing earlier prerequisites: {', '.join(sorted(missing))}.")
                missing_coreqs = set(coreqs) - prior - current
                if missing_coreqs:
                    errors.append(f"{raw}: missing corequisites: {', '.join(sorted(missing_coreqs))}.")
            for coreq_code, required in requirements.get("coreqs", {}).items():
                if code(coreq_code) == key and code(required) not in prior | current:
                    errors.append(f"{raw}: requires corequisite {required}.")
            added[key] = {"credits": minimum or 0}
        if credits > 18:
            errors.append(f"{semester.term} {semester.year}: {credits:g} credits exceeds the prototype's 18-credit limit.")
        prior.update(current)
    projected = audit(student, requirements, added)
    projected["projected_credits"] = projected["completed_credits"] + sum(float(c["credits"]) for c in added.values())
    warnings.append("Future section availability and meeting conflicts have not been validated. Existing planned courses are not assumed completed.")
    return {"valid": not errors, "errors": errors, "warnings": list(dict.fromkeys(warnings)), "audit": projected, "official_degree_clearance": False}
