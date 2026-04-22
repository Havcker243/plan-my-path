#!/usr/bin/env python3
"""
Fetch courses + sections from parse.bot and upsert into Supabase Postgres.

Defaults to subjects listed in scripts/courses.txt (by ?subjects=CODE).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

import time

import psycopg2
import requests


DEFAULT_BASE_API = "https://api.parse.bot/scraper/37fd40d8-afe7-4fa5-80dc-adcbc4147728"


def load_env_lines(path: Path) -> List[Tuple[str, str]]:
    if not path.exists():
        return []
    pairs: List[Tuple[str, str]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        pairs.append((key.strip(), value.strip().strip("'").strip('"')))
    return pairs


def resolve_scraper_key(env_path: Path) -> str:
    env_pairs = load_env_lines(env_path)
    for key in ("SCRAPPER_ENV_KEY", "PARSE_BOT_API_KEY", "X_API_KEY"):
        if key in os.environ and os.environ[key]:
            return os.environ[key]
    for key, value in env_pairs:
        if key in ("SCRAPPER_ENV_KEY", "PARSE_BOT_API_KEY", "X_API_KEY") and value:
            return value
    raise RuntimeError("SCRAPPER_ENV_KEY not found in environment or scripts/.env")


def resolve_base_api(env_path: Path) -> str:
    env_pairs = load_env_lines(env_path)
    for key in ("PARSE_BOT_BASE_URL", "SCRAPER_BASE_URL", "PARSE_BOT_SCRAPER_URL"):
        if key in os.environ and os.environ[key]:
            return os.environ[key].rstrip("/")
    for key, value in env_pairs:
        if key in ("PARSE_BOT_BASE_URL", "SCRAPER_BASE_URL", "PARSE_BOT_SCRAPER_URL") and value:
            return value.rstrip("/")
    return DEFAULT_BASE_API


def build_endpoints(base_api: str) -> Dict[str, str]:
    return {
        "all": f"{base_api}/get_all_courses_with_sections",
        "snapshot": f"{base_api}/get_catalog_snapshot",
    }


def resolve_pooler_url(env_path: Path) -> str:
    env_pairs = load_env_lines(env_path)
    candidates = {
        "SUPABASE_POOLER_URL",
        "supabase_POOLER_URL",
        "SUPABASE_DB_URL",
        "supabase_DB_URL",
        "supabase_URL",
        "SUPABASE_URL",
    }

    # Prefer explicit env vars first.
    for key in ("SUPABASE_POOLER_URL", "supabase_POOLER_URL", "SUPABASE_DB_URL", "supabase_DB_URL"):
        if key in os.environ and os.environ[key]:
            return sanitize_pooler_url(os.environ[key])

    # Then check .env in order; pick the first postgres url.
    for key, value in env_pairs:
        if key in candidates and value.startswith("postgresql://"):
            return sanitize_pooler_url(value)

    raise RuntimeError("Supabase pooler URL not found in scripts/.env")


def sanitize_pooler_url(url: str) -> str:
    if "@@" in url and "%40" not in url:
        # Best-effort fix for passwords containing '@' without URL-encoding.
        return url.replace("@@", "%40@", 1)
    return url


def request_json(url: str, params: Dict[str, str], api_key: str) -> Any:
    headers = {"X-API-Key": api_key}
    for attempt in range(5):
        resp = requests.get(url, params=params, headers=headers, timeout=60)
        if resp.status_code == 429:
            wait = 2 ** attempt * 10  # 10s, 20s, 40s, 80s, 160s
            print(f"  Rate limited — waiting {wait}s before retry {attempt + 1}/5…")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    resp.raise_for_status()  # re-raise after all retries exhausted


def parse_courses_file(path: Path, only_subject: Optional[str] = None) -> List[Tuple[str, str]]:
    items: List[Tuple[str, str]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        name, url = [part.strip() for part in line.split(":", 1)]
        if not url:
            continue
        subject = extract_subject_from_url(url)
        if not subject:
            continue
        if only_subject and subject != only_subject:
            continue
        items.append((subject, name))
    return items


def extract_subject_from_url(url: str) -> str:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    subjects = qs.get("subjects") or qs.get("subject")
    if subjects:
        return subjects[0].strip().upper()
    return ""


def iter_courses(payload: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("courses"), list):
            for item in payload["courses"]:
                if isinstance(item, dict):
                    yield item
            return
        if isinstance(payload.get("data"), list):
            for item in payload["data"]:
                if isinstance(item, dict):
                    yield item
            return
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item


def normalize_requisites(value: Any) -> Optional[Any]:
    if value in (None, "", "None"):
        return None
    if isinstance(value, list) and not value:
        return None
    return value


def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def normalize_credits(course: Dict[str, Any]) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    credits_min = course.get("credits_min")
    credits_max = course.get("credits_max")
    credit_type = normalize_text(course.get("credit_type"))
    if credits_min is not None or credits_max is not None or credit_type is not None:
        return (credits_min, credits_max, credit_type)

    raw = course.get("credits")
    if isinstance(raw, dict):
        return (
            raw.get("min_credits"),
            raw.get("max_credits"),
            normalize_text(raw.get("credit_type")),
        )
    if raw is None or raw == "":
        return (None, None, credit_type)
    try:
        return (float(raw), None, credit_type or "fixed")
    except (TypeError, ValueError):
        return (None, None, credit_type)


def build_course_requisites(course: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    requisites = {
        "raw": normalize_text(course.get("requisites_raw")),
        "prerequisites": course.get("prerequisites") or [],
        "corequisites": course.get("corequisites") or [],
    }
    return normalize_requisites(requisites if any(requisites.values()) else None)


def build_course_locations(course: Dict[str, Any]) -> Optional[str]:
    locations = course.get("locations")
    if isinstance(locations, list):
        return ", ".join(str(value).strip() for value in locations if str(value).strip()) or None
    return normalize_text(course.get("locations_raw") or locations)


def iter_sections(course: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    terms = course.get("terms")
    if isinstance(terms, list):
        for term in terms:
            if not isinstance(term, dict):
                continue
            sections = term.get("sections") or []
            for section in sections:
                if not isinstance(section, dict):
                    continue
                merged = dict(section)
                merged.setdefault("term", term.get("term"))
                merged.setdefault("term_code", term.get("term_code"))
                yield merged
        return

    sections = course.get("sections") or []
    for section in sections:
        if isinstance(section, dict):
            yield section


def build_section_seats(section: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(section.get("seats"), dict):
        seats = dict(section["seats"])
    else:
        seats = {
            "available": section.get("seats_available"),
            "capacity": section.get("seats_capacity"),
            "enrolled": section.get("seats_enrolled"),
            "waitlisted": section.get("seats_waitlisted"),
        }
    seats["raw"] = normalize_text(section.get("seats_raw")) or seats.get("raw")
    return seats


def normalize_meeting_days(value: Any) -> Optional[str]:
    if isinstance(value, list):
        parts = [str(item).strip() for item in value if str(item).strip()]
        return ", ".join(parts) if parts else None
    return normalize_text(value)


def ensure_indexes(cur) -> None:
    cur.execute(
        """
        create unique index if not exists sections_unique
        on sections(course_id, term_code, section_code, section_id);
        """
    )
    cur.execute(
        """
        create unique index if not exists meeting_times_unique
        on meeting_times(
          section_id,
          days,
          start_time,
          end_time,
          location,
          building,
          room,
          start_date,
          end_date
        );
        """
    )


def upsert_subject(cur, code: str, name: Optional[str]) -> str:
    cur.execute(
        """
        insert into subjects (code, name)
        values (%s, %s)
        on conflict (code) do update set name = excluded.name
        returning id;
        """,
        (code, name),
    )
    return cur.fetchone()[0]


def upsert_course(cur, subject_id: str, course: Dict[str, Any]) -> str:
    credits_min, credits_max, credit_type = normalize_credits(course)
    cur.execute(
        """
        insert into courses (
          subject_id,
          course_code,
          title,
          description,
          credits_min,
          credits_max,
          credit_type,
          requisites,
          locations,
          attributes,
          source_url,
          last_updated
        ) values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s, %s)
        on conflict (course_code) do update set
          subject_id = excluded.subject_id,
          title = excluded.title,
          description = excluded.description,
          credits_min = excluded.credits_min,
          credits_max = excluded.credits_max,
          credit_type = excluded.credit_type,
          requisites = excluded.requisites,
          locations = excluded.locations,
          attributes = excluded.attributes,
          source_url = excluded.source_url,
          last_updated = excluded.last_updated
        returning id;
        """,
        (
            subject_id,
            normalize_text(course.get("course_code")),
            normalize_text(course.get("title")),
            normalize_text(course.get("description")),
            credits_min,
            credits_max,
            credit_type,
            json.dumps(build_course_requisites(course)),
            build_course_locations(course),
            json.dumps(course.get("attributes")),
            normalize_text(course.get("source_url")),
            course.get("scraped_at") or course.get("last_updated"),
        ),
    )
    return cur.fetchone()[0]


def upsert_section(cur, course_id: str, section: Dict[str, Any]) -> str:
    seats = build_section_seats(section)
    cur.execute(
        """
        insert into sections (
          course_id,
          section_code,
          section_id,
          term,
          term_code,
          status,
          campus,
          modality,
          start_date,
          end_date,
          seats_available,
          seats_capacity,
          seats_enrolled,
          seats_waitlisted,
          source_url,
          last_updated
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (course_id, term_code, section_code, section_id) do update set
          term = excluded.term,
          status = excluded.status,
          campus = excluded.campus,
          modality = excluded.modality,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          seats_available = excluded.seats_available,
          seats_capacity = excluded.seats_capacity,
          seats_enrolled = excluded.seats_enrolled,
          seats_waitlisted = excluded.seats_waitlisted,
          source_url = excluded.source_url,
          last_updated = excluded.last_updated
        returning id;
        """,
        (
            course_id,
            normalize_text(section.get("section_code")),
            normalize_text(section.get("section_id")),
            normalize_text(section.get("term")),
            normalize_text(section.get("term_code")),
            normalize_text(section.get("status")),
            normalize_text(section.get("campus")),
            normalize_text(section.get("modality")),
            section.get("start_date"),
            section.get("end_date"),
            seats.get("available"),
            seats.get("capacity"),
            seats.get("enrolled"),
            seats.get("waitlisted"),
            normalize_text(section.get("source_url")),
            section.get("scraped_at") or section.get("last_updated"),
        ),
    )
    return cur.fetchone()[0]


def upsert_instructor(cur, instructor: Dict[str, Any]) -> str:
    faculty_id = normalize_text(instructor.get("faculty_id"))
    name = normalize_text(instructor.get("name"))
    role = normalize_text(instructor.get("role"))
    if faculty_id:
        cur.execute(
            """
            insert into instructors (name, faculty_id)
            values (%s, %s)
            on conflict (faculty_id) do update set name = excluded.name
            returning id;
            """,
            (name, faculty_id),
        )
        return cur.fetchone()[0]
    cur.execute(
        "insert into instructors (name) values (%s) returning id;",
        (name,),
    )
    return cur.fetchone()[0]


def insert_section_instructor(cur, section_id: str, instructor_id: str, role: Optional[str]) -> None:
    cur.execute(
        """
        insert into section_instructors (section_id, instructor_id, role)
        values (%s, %s, %s)
        on conflict do nothing;
        """,
        (section_id, instructor_id, role),
    )


def upsert_meeting_time(cur, section_id: str, meeting: Dict[str, Any]) -> None:
    cur.execute(
        """
        insert into meeting_times (
          section_id,
          days,
          start_time,
          end_time,
          location,
          building,
          room,
          start_date,
          end_date,
          modality
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict do nothing;
        """,
        (
            section_id,
            normalize_meeting_days(meeting.get("days")),
            normalize_text(meeting.get("start_time")),
            normalize_text(meeting.get("end_time")),
            normalize_text(meeting.get("location") or meeting.get("location_raw")),
            normalize_text(meeting.get("building")),
            normalize_text(meeting.get("room")),
            meeting.get("start_date"),
            meeting.get("end_date"),
            normalize_text(meeting.get("modality")),
        ),
    )


def sync_subject(
    cur,
    subject_code: str,
    subject_name: Optional[str],
    api_key: str,
    endpoints: Dict[str, str],
) -> Tuple[int, int]:
    payload = request_json(endpoints["all"], {"subject_code": subject_code}, api_key)
    subject_id = upsert_subject(cur, subject_code, subject_name)
    course_count = 0
    section_count = 0

    for course in iter_courses(payload):
        course_id = upsert_course(cur, subject_id, course)
        course_count += 1
        for section in iter_sections(course):
            section_id = upsert_section(cur, course_id, section)
            section_count += 1

            for instructor in section.get("instructors") or []:
                instructor_id = upsert_instructor(cur, instructor)
                insert_section_instructor(cur, section_id, instructor_id, normalize_text(instructor.get("role")))

            for meeting in section.get("meeting_times") or []:
                upsert_meeting_time(cur, section_id, meeting)

    return course_count, section_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync parse.bot courses into Supabase.")
    script_dir = Path(__file__).resolve().parent
    parser.add_argument("--env-path", default=str(script_dir.parent / ".env"))
    parser.add_argument("--subjects-file", default=str(script_dir / "courses.txt"))
    parser.add_argument("--subject", default=None, help="Optional subject code filter, e.g. CSCI")
    parser.add_argument(
        "--seasonal-only",
        action="store_true",
        help="Only run during Jan-Apr and Aug-Nov (local time).",
    )
    args = parser.parse_args()

    env_path = Path(args.env_path)
    courses_path = Path(args.subjects_file)
    subject_filter = args.subject.upper() if args.subject else None

    if args.seasonal_only:
        month = datetime.now().month
        if month not in (1, 2, 3, 4, 8, 9, 10, 11):
            print("Outside seasonal window; skipping sync.")
            return 0

    api_key = resolve_scraper_key(env_path)
    endpoints = build_endpoints(resolve_base_api(env_path))
    pooler_url = resolve_pooler_url(env_path)

    subjects = parse_courses_file(courses_path, subject_filter)
    if not subjects:
        print("No subjects found to sync.", file=sys.stderr)
        return 1

    conn = psycopg2.connect(pooler_url)
    try:
        with conn:
            with conn.cursor() as cur:
                ensure_indexes(cur)
                total_courses = 0
                total_sections = 0
                for subject_code, subject_name in subjects:
                    time.sleep(2)  # 2s between subjects to avoid rate limiting
                    courses, sections = sync_subject(cur, subject_code, subject_name, api_key, endpoints)
                    total_courses += courses
                    total_sections += sections
        print(f"Synced {total_courses} courses and {total_sections} sections.")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
