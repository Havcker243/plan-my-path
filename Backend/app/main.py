from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware

from app.auth import resolve_jwt_secret, verify_token
from app.db import (
    fetch_courses_by_subject,
    fetch_profile,
    fetch_sections_by_course_codes,
    fetch_subjects,
    fetch_term_calendar,
    fetch_plan,
    resolve_pooler_url,
    search_courses,
    save_plan,
    upsert_profile,
    fetch_course_labels,
    get_course_label,
)

app = FastAPI(title="PlanMyPath API")

# Build allowed origins: always include localhost dev ports, plus any
# production frontend URL set via ALLOWED_ORIGINS env var (comma-separated).
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
_extra = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins = _default_origins + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
POOLER_URL = resolve_pooler_url(ENV_PATH)
JWT_SECRET = resolve_jwt_secret(ENV_PATH)
auth_scheme = HTTPBearer()


def _term_to_semester(term: Optional[str]) -> Optional[str]:
    if not term:
        return None
    term_lower = term.lower()
    if "fall" in term_lower:
        return "fall"
    if "spring" in term_lower:
        return "spring"
    if "summer" in term_lower:
        return "summer"
    if "winter" in term_lower:
        return "winter"
    return None


def _derive_offered_terms(terms: List[Optional[str]]) -> List[str]:
    found = []
    for term in terms:
        semester = _term_to_semester(term)
        if semester and semester not in found:
            found.append(semester)
    # Return all four terms when we have no section data rather than silently
    # assuming fall/spring — this prevents misleading "Fall Only" badges.
    return found or ["fall", "spring", "summer", "winter"]


def _normalize_requisites(value: Any) -> List[str]:
    if value in (None, "", "None"):
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)]


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/subjects")
def list_subjects() -> Dict[str, Any]:
    subjects = fetch_subjects(POOLER_URL)
    return {"data": subjects}


@app.get("/api/majors")
def list_majors() -> Dict[str, Any]:
    subjects = fetch_subjects(POOLER_URL)
    majors = [{"code": "UNDECLARED", "name": "Undeclared"}] + [
        {"code": item["code"], "name": item["name"] or item["code"]} for item in subjects
    ]
    return {"data": majors}


@app.get("/api/courses")
def list_courses(subject: str) -> Dict[str, Any]:
    if not subject:
        raise HTTPException(status_code=400, detail="subject is required")
    rows = fetch_courses_by_subject(POOLER_URL, subject.upper())

    courses = []
    for row in rows:
        credits = row["credits_min"] or row["credits_max"] or 0
        courses.append(
            {
                "id": row["course_code"],
                "code": row["course_code"],
                "title": row["title"] or row["course_code"],
                "credits": credits,
                "description": row["description"] or None,
                "prerequisites": _normalize_requisites(row["requisites"]),
                "offeredTerms": _derive_offered_terms(row["terms"]),
                "type": "core",
                "requirementBucket": None,
            }
        )

    return {"data": courses}


@app.get("/api/courses/search")
def search_courses_endpoint(
    query: str,
    subject: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
) -> Dict[str, Any]:
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    rows, total = search_courses(
        POOLER_URL,
        query,
        subject.upper() if subject else None,
        page=page,
        limit=limit,
    )
    return {"data": rows, "page": page, "limit": limit, "total": total}


@app.get("/api/sections")
def list_sections(course_codes: str, term: Optional[str] = None) -> Dict[str, Any]:
    codes = [code.strip().upper() for code in course_codes.split(",") if code.strip()]
    if not codes:
        raise HTTPException(status_code=400, detail="course_codes is required")
    sections = fetch_sections_by_course_codes(POOLER_URL, codes, term_filter=term)
    return {"data": sections}


@app.get("/api/course-labels")
def get_course_labels_endpoint(
    major_code: str,
    course_codes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get requirement labels for courses based on a major.

    If course_codes is provided, returns labels for specific courses.
    Otherwise, returns all labeled courses for the major.

    Labels:
    - Required: Must take this course
    - Group Choice: Pick one from a group
    - Major Elective: Counts toward major electives
    - General Elective: Fills remaining credits
    """
    if not major_code:
        raise HTTPException(status_code=400, detail="major_code is required")

    # Fetch all labels and rules for this major
    labels_data = fetch_course_labels(POOLER_URL, major_code.upper())

    # If specific courses requested, filter and apply labeling logic
    if course_codes:
        codes = [code.strip().upper() for code in course_codes.split(",") if code.strip()]
        result = {}
        for code in codes:
            result[code] = get_course_label(code, labels_data)
        return {"data": result}

    # Otherwise return all explicitly labeled courses
    return {"data": labels_data.get('labels', {}), "rules": labels_data.get('rules', [])}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> Dict[str, Any]:
    token = credentials.credentials
    payload = verify_token(token, JWT_SECRET)
    return payload


@app.get("/api/profile")
def get_profile(user=Depends(get_current_user)) -> Dict[str, Any]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    profile = fetch_profile(POOLER_URL, user_id)
    return {"data": profile}


@app.put("/api/profile")
def put_profile(payload: Dict[str, Any], user=Depends(get_current_user)) -> Dict[str, Any]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload["user_id"] = user_id
    saved = upsert_profile(POOLER_URL, payload)
    return {"data": saved}


@app.get("/api/terms")
def list_terms() -> Dict[str, Any]:
    terms = fetch_term_calendar(POOLER_URL)
    return {"data": terms}


@app.get("/api/plan")
def get_plan(user=Depends(get_current_user)) -> Dict[str, Any]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    plan = fetch_plan(POOLER_URL, user_id)
    if not plan:
        return {"data": None}

    for semester in plan.get("semesters", []):
        for course in semester.get("courses", []):
            course["prerequisites"] = _normalize_requisites(course.get("prerequisites"))
            course["offeredTerms"] = _derive_offered_terms(course.get("offered_terms", []))
            course.pop("offered_terms", None)
            course["requirementBucket"] = course.pop("requirement_bucket", None)
            course["semesterId"] = course.pop("semester_id", None)
            course["selectedSectionId"] = course.pop("selected_section_id", None)
    return {"data": plan}


@app.put("/api/plan")
def put_plan(payload: Dict[str, Any], user=Depends(get_current_user)) -> Dict[str, Any]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    saved = save_plan(POOLER_URL, user_id, payload)
    if not saved:
        return {"data": None}
    for semester in saved.get("semesters", []):
        for course in semester.get("courses", []):
            course["prerequisites"] = _normalize_requisites(course.get("prerequisites"))
            course["offeredTerms"] = _derive_offered_terms(course.get("offered_terms", []))
            course.pop("offered_terms", None)
            course["requirementBucket"] = course.pop("requirement_bucket", None)
            course["semesterId"] = course.pop("semester_id", None)
            course["selectedSectionId"] = course.pop("selected_section_id", None)
    return {"data": saved}
