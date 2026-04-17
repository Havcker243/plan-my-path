from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

import json

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware

from app.auth import resolve_jwt_secret, verify_token
from app.advisor import stream_advisor_reply
from app.db import (
    CourseLabelsData,
    CourseLabelEntry,
    fetch_courses_by_subject,
    fetch_majors,
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
    get_reviews,
    get_recent_reviews,
    create_review,
    delete_user_data,
)

app = FastAPI(title="PlanMyPath API")

# Build allowed origins: always include localhost dev ports, plus any
# production frontend URL set via ALLOWED_ORIGINS env var (comma-separated).
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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


def _normalize_requisites(value: object) -> List[str]:
    if value in (None, "", "None"):
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)]


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/subjects")
def list_subjects() -> Dict[str, object]:
    subjects = fetch_subjects(POOLER_URL)
    return {"data": subjects}


@app.get("/api/majors")
def list_majors() -> Dict[str, object]:
    majors = fetch_majors(POOLER_URL)
    return {"data": [{"code": "UNDECLARED", "name": "Undeclared", "degree_type": None, "total_credits_required": 120}] + majors}


@app.get("/api/courses")
def list_courses(subject: str) -> Dict[str, object]:
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
) -> Dict[str, object]:
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
def list_sections(course_codes: str, term: Optional[str] = None) -> Dict[str, object]:
    codes = [code.strip().upper() for code in course_codes.split(",") if code.strip()]
    if not codes:
        raise HTTPException(status_code=400, detail="course_codes is required")
    sections = fetch_sections_by_course_codes(POOLER_URL, codes, term_filter=term)
    return {"data": sections}


@app.get("/api/course-labels")
def get_course_labels_endpoint(
    major_code: str,
    course_codes: Optional[str] = None,
) -> Dict[str, object]:
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
    labels_data: CourseLabelsData = fetch_course_labels(POOLER_URL, major_code.upper())

    # If specific courses requested, filter and apply labeling logic
    if course_codes:
        codes = [code.strip().upper() for code in course_codes.split(",") if code.strip()]
        result: Dict[str, CourseLabelEntry] = {}
        for code in codes:
            result[code] = get_course_label(code, labels_data)
        return {"data": result}

    # Otherwise return all explicitly labeled courses
    return {
        "data": labels_data.get('labels', {}),
        "rules": labels_data.get('rules', []),
        "total_credits": labels_data.get('total_credits', 120),
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> Dict[str, object]:
    token = credentials.credentials
    payload = verify_token(token, JWT_SECRET)
    return payload


@app.get("/api/profile")
def get_profile(user: Dict[str, object] = Depends(get_current_user)) -> Dict[str, object]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    profile = fetch_profile(POOLER_URL, str(user_id))
    return {"data": profile}


@app.put("/api/profile")
def put_profile(payload: dict, user: Dict[str, object] = Depends(get_current_user)) -> Dict[str, object]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload["user_id"] = str(user_id)
    saved = upsert_profile(POOLER_URL, payload)
    return {"data": saved}


@app.get("/api/terms")
def list_terms() -> Dict[str, object]:
    terms = fetch_term_calendar(POOLER_URL)
    return {"data": terms}


@app.post("/api/transcript")
async def parse_transcript_endpoint(file: UploadFile = File(...)) -> Dict[str, object]:
    """
    Parse an uploaded transcript PDF and return extracted courses + GPA.
    No auth required — the transcript is processed in memory and never stored.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB guard
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    try:
        from app.transcript import parse_transcript
        result = parse_transcript(contents)
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF parsing library not installed. Run: pip install pypdf python-multipart",
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse transcript: {exc}")

    return {"data": result}


@app.get("/api/plan")
def get_plan(user: Dict[str, object] = Depends(get_current_user)) -> Dict[str, object]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    plan = fetch_plan(POOLER_URL, str(user_id))
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
def put_plan(payload: dict, user: Dict[str, object] = Depends(get_current_user)) -> Dict[str, object]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    saved = save_plan(POOLER_URL, str(user_id), payload)
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


# ---------------------------------------------------------------------------
# Course reviews
# ---------------------------------------------------------------------------

class ReviewPayload(BaseModel):
    course_code: str
    year_taken: Optional[int] = None
    term_taken: Optional[str] = None
    professor: Optional[str] = None
    comment: str


@app.get("/api/reviews/recent")
def list_recent_reviews(limit: int = 20) -> Dict[str, object]:
    reviews = get_recent_reviews(POOLER_URL, limit)
    return {"data": reviews}


@app.get("/api/reviews")
def list_reviews(course_code: str) -> Dict[str, object]:
    if not course_code:
        raise HTTPException(status_code=400, detail="course_code is required")
    reviews = get_reviews(POOLER_URL, course_code)
    return {"data": reviews}


@app.post("/api/reviews")
def post_review(
    payload: ReviewPayload,
    user: Dict[str, object] = Depends(get_current_user),
) -> Dict[str, object]:
    comment = (payload.comment or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="comment is required")
    if len(comment) > 2000:
        raise HTTPException(status_code=400, detail="comment must be 2000 characters or fewer")
    review = create_review(
        POOLER_URL,
        payload.course_code,
        payload.year_taken,
        payload.term_taken,
        (payload.professor or "").strip() or None,
        comment,
    )
    return {"data": review}


# ---------------------------------------------------------------------------
# AI Advisor
# ---------------------------------------------------------------------------

class AdvisorPayload(BaseModel):
    message: str
    history: Optional[List[dict]] = None


@app.post("/api/ai/advise")
def advise(
    payload: AdvisorPayload,
    user: Dict[str, object] = Depends(get_current_user),
) -> Dict[str, object]:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    # Fetch student data
    profile = fetch_profile(POOLER_URL, str(user_id)) or {}
    plan = fetch_plan(POOLER_URL, str(user_id))
    major_code = profile.get("major_code") or ""

    labels_data: dict = {}
    total_credits = 120
    if major_code and major_code != "UNDECLARED":
        raw = fetch_course_labels(POOLER_URL, major_code)
        labels_data = {k: dict(v) for k, v in raw.get("labels", {}).items()}
        total_credits = raw.get("total_credits", 120)

    # Grab recent hub reviews relevant to this major
    reviews = get_recent_reviews(POOLER_URL, limit=50)

    def generate():
        try:
            for chunk in stream_advisor_reply(
                message=message,
                profile=dict(profile),
                plan=dict(plan) if plan else None,
                labels=labels_data,
                total_credits=total_credits,
                reviews=reviews,
                history=payload.history,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except RuntimeError as exc:
            print(f"[Advisor] RuntimeError: {exc}")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        except Exception as exc:
            import traceback
            print(f"[Advisor] Unexpected error: {exc}")
            traceback.print_exc()
            yield f"data: {json.dumps({'error': 'Advisor unavailable — try again shortly'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------

def _get_env_val(key: str) -> Optional[str]:
    """Read a value from os.environ or fallback to .env file."""
    if os.environ.get(key):
        return os.environ[key]
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return None


@app.delete("/api/account")
def delete_account(user: Dict[str, object] = Depends(get_current_user)) -> Dict[str, object]:
    """
    Permanently delete the authenticated user's account.
    Deletes all plan data and profile from Postgres, then removes the
    Supabase auth user via the Admin API (requires SUPABASE_SERVICE_ROLE_KEY).
    """
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # 1. Delete all user data from our tables
    delete_user_data(POOLER_URL, str(user_id))

    # 2. Delete the Supabase auth user (best-effort — DB data is already gone)
    supabase_url = _get_env_val("SUPABASE_URL")
    service_role_key = _get_env_val("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_url and service_role_key:
        import urllib.request
        import urllib.error
        req = urllib.request.Request(
            f"{supabase_url}/auth/v1/admin/users/{user_id}",
            method="DELETE",
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
            },
        )
        try:
            urllib.request.urlopen(req)
        except urllib.error.URLError:
            pass  # DB rows are gone; auth user will be orphaned but harmless

    return {"data": {"deleted": True}}
