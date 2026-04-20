from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, List, Optional

import json

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_allowed_email, resolve_allowed_email_domains, resolve_jwt_secret, verify_token
from app.advisor import stream_advisor_reply
from app.custom_balance_sheet import scan_balance_sheet_pdf
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
    get_reviews_for_subject,
    create_review,
    delete_user_data,
)

app = FastAPI(title="FiskGrad API")

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

_rate_limit_hits: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMITS = {
    ("POST", "/api/transcript"): (5, 15 * 60),
    ("POST", "/api/ai/advise"): (20, 15 * 60),
    ("POST", "/api/reviews"): (10, 15 * 60),
}


def _client_ip(request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.middleware("http")
async def rate_limit_sensitive_routes(request, call_next):
    limit = _RATE_LIMITS.get((request.method.upper(), request.url.path))
    if not limit:
        return await call_next(request)

    max_requests, window_seconds = limit
    now = time.monotonic()
    key = f"{request.method.upper()}:{request.url.path}:{_client_ip(request)}"
    hits = _rate_limit_hits[key]
    while hits and now - hits[0] > window_seconds:
        hits.popleft()
    if len(hits) >= max_requests:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."},
        )
    hits.append(now)
    return await call_next(request)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
POOLER_URL = resolve_pooler_url(ENV_PATH)
JWT_SECRET = resolve_jwt_secret(ENV_PATH)
ALLOWED_EMAIL_DOMAINS = resolve_allowed_email_domains(ENV_PATH)

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
    require_allowed_email(payload, ALLOWED_EMAIL_DOMAINS)
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
async def parse_transcript_endpoint(
    file: UploadFile = File(...),
    user: Dict[str, object] = Depends(get_current_user),
) -> Dict[str, object]:
    """
    Parse an uploaded transcript PDF and return extracted courses + GPA.
    No auth required — the transcript is processed in memory and never stored.
    """
    if not user.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    if file.content_type and file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB guard
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")
    if not contents.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

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


RE_COURSE_CODE = re.compile(r"^[A-Z]{2,6}[-\s]?\d+[A-Z0-9]*$")


class BalanceSheetScanPayload(BaseModel):
    course_codes: List[str]


@app.post("/api/balance-sheet/scan")
async def scan_custom_balance_sheet(
    payload_json: str = Form(...),
    file: UploadFile = File(...),
    user: Dict[str, object] = Depends(get_current_user),
) -> Dict[str, object]:
    if not user.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        payload = BalanceSheetScanPayload(**json.loads(payload_json))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan payload")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only searchable PDF balance sheets can be scanned right now.")
    if file.content_type and file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Only searchable PDF balance sheets can be scanned right now.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")
    if not contents.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

    try:
        result = scan_balance_sheet_pdf(contents, payload.course_codes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not scan balance sheet: {exc}")

    return {"data": result}


@app.get("/api/reviews/recent")
def list_recent_reviews(limit: int = 20) -> Dict[str, object]:
    limit = max(1, min(limit, 50))
    reviews = get_recent_reviews(POOLER_URL, limit)
    return {"data": reviews}


@app.get("/api/reviews")
def list_reviews(course_code: str) -> Dict[str, object]:
    course_code = course_code.strip().upper()
    if not course_code or not RE_COURSE_CODE.match(course_code):
        raise HTTPException(status_code=400, detail="course_code is required")
    reviews = get_reviews(POOLER_URL, course_code)
    return {"data": reviews}


@app.post("/api/reviews")
def post_review(
    payload: ReviewPayload,
    user: Dict[str, object] = Depends(get_current_user),
) -> Dict[str, object]:
    course_code = payload.course_code.strip().upper()
    if not RE_COURSE_CODE.match(course_code):
        raise HTTPException(status_code=400, detail="valid course_code is required")
    comment = (payload.comment or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="comment is required")
    if len(comment) > 2000:
        raise HTTPException(status_code=400, detail="comment must be 2000 characters or fewer")
    review = create_review(
        POOLER_URL,
        course_code,
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
    if len(message) > 4000:
        raise HTTPException(status_code=400, detail="message must be 4000 characters or fewer")
    history = payload.history or []
    if len(history) > 20:
        raise HTTPException(status_code=400, detail="history must include 20 messages or fewer")

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

    subject_codes = _advisor_subject_codes(major_code, labels_data, plan)
    course_catalog_context = _advisor_course_catalog(subject_codes, message)
    reviews = _advisor_reviews(subject_codes)

    def generate():
        try:
            for event in stream_advisor_reply(
                message=message,
                profile=dict(profile),
                plan=dict(plan) if plan else None,
                labels=labels_data,
                total_credits=total_credits,
                reviews=reviews,
                course_catalog=course_catalog_context,
                subject_codes=subject_codes,
                history=history,
            ):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"
        except RuntimeError as exc:
            print(f"[Advisor] RuntimeError: {exc}")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        except Exception as exc:
            import traceback
            print(f"[Advisor] Unexpected error: {exc}")
            traceback.print_exc()
            yield f"data: {json.dumps({'error': 'Advisor unavailable — try again shortly'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _advisor_subject_codes(major_code: str, labels: dict, plan: Optional[dict]) -> List[str]:
    subjects: set[str] = set()
    if major_code and re.match(r"^[A-Z]{2,6}$", major_code):
        subjects.add(major_code)
    for code in labels.keys():
        match = re.match(r"^([A-Z]{2,6})[-\s]", str(code).upper())
        if match:
            subjects.add(match.group(1))
    if plan:
        for semester in plan.get("semesters", []):
            for course in semester.get("courses", []):
                match = re.match(r"^([A-Z]{2,6})[-\s]", str(course.get("code", "")).upper())
                if match:
                    subjects.add(match.group(1))
    return sorted(subjects)[:6]


def _advisor_course_catalog(subject_codes: List[str], message: str) -> List[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for subject in subject_codes[:3]:
        try:
            for course in fetch_courses_by_subject(POOLER_URL, subject)[:30]:
                code = course.get("course_code")
                if not code or code in seen:
                    continue
                seen.add(code)
                rows.append({
                    "course_code": code,
                    "title": course.get("title"),
                    "credits": course.get("credits_min") or course.get("credits_max"),
                    "terms": course.get("terms") or [],
                    "description": (course.get("description") or "")[:220],
                })
        except Exception:
            continue

    query = message.strip()[:140]
    if len(query) >= 3:
        try:
            search_rows, _total = search_courses(POOLER_URL, query, page=1, limit=10)
            for course in search_rows:
                code = course.get("course_code")
                if not code or code in seen:
                    continue
                seen.add(code)
                credits = course.get("credits") or {}
                rows.append({
                    "course_code": code,
                    "title": course.get("title"),
                    "credits": credits.get("min_credits") or credits.get("max_credits"),
                    "terms": [section.get("term") for section in course.get("sections", []) if section.get("term")],
                    "description": (course.get("description") or "")[:220],
                })
        except Exception:
            pass
    return rows[:80]


def _advisor_reviews(subject_codes: List[str]) -> List[dict]:
    reviews: list[dict] = []
    seen: set[str] = set()
    for subject in subject_codes[:4]:
        try:
            for review in get_reviews_for_subject(POOLER_URL, subject, limit=40):
                review_id = review.get("id")
                if review_id and review_id in seen:
                    continue
                if review_id:
                    seen.add(review_id)
                reviews.append(review)
        except Exception:
            continue
    if len(reviews) < 20:
        reviews.extend(get_recent_reviews(POOLER_URL, limit=50 - len(reviews)))
    return reviews[:80]


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
