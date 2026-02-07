from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import psycopg2


def _load_env_lines(path: Path) -> List[tuple[str, str]]:
    if not path.exists():
        return []
    pairs: List[tuple[str, str]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        pairs.append((key.strip(), value.strip().strip("'").strip('"')))
    return pairs


def _sanitize_pooler_url(url: str) -> str:
    if "@@" in url and "%40" not in url:
        return url.replace("@@", "%40@", 1)
    return url


def resolve_pooler_url(env_path: Optional[Path] = None) -> str:
    candidates = (
        "SUPABASE_POOLER_URL",
        "supabase_POOLER_URL",
        "SUPABASE_DB_URL",
        "supabase_DB_URL",
        "SUPABASE_URL",
        "supabase_URL",
    )

    for key in candidates:
        if key in os.environ and os.environ[key]:
            return _sanitize_pooler_url(os.environ[key])

    if env_path:
        for key, value in _load_env_lines(env_path):
            if key in candidates and value.startswith("postgresql://"):
                return _sanitize_pooler_url(value)

    raise RuntimeError("Supabase pooler URL not found in environment or .env")


def connect(pooler_url: str):
    return psycopg2.connect(pooler_url)


def fetch_subjects(pooler_url: str) -> List[Dict[str, Any]]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, code, name from subjects order by code;")
            rows = cur.fetchall()
    return [{"id": row[0], "code": row[1], "name": row[2]} for row in rows]


def fetch_courses_by_subject(pooler_url: str, subject_code: str) -> List[Dict[str, Any]]:
    query = """
        select
          c.id,
          c.course_code,
          c.title,
          c.description,
          c.credits_min,
          c.credits_max,
          c.credit_type,
          c.requisites,
          c.locations,
          c.attributes,
          array_agg(distinct s.term) as terms
        from courses c
        join subjects subj on subj.id = c.subject_id
        left join sections s on s.course_id = c.id
        where subj.code = %s
        group by c.id
        order by c.course_code;
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query, (subject_code,))
            rows = cur.fetchall()
    results: List[Dict[str, Any]] = []
    for row in rows:
        results.append(
            {
                "id": row[0],
                "course_code": row[1],
                "title": row[2],
                "description": row[3],
                "credits_min": row[4],
                "credits_max": row[5],
                "credit_type": row[6],
                "requisites": row[7],
                "locations": row[8],
                "attributes": row[9],
                "terms": row[10] or [],
            }
        )
    return results


def _fetch_sections_by_course(pooler_url: str, course_ids: List[str]) -> Dict[str, Any]:
    if not course_ids:
        return {}

    sections_sql = """
        select
          id,
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
          seats_waitlisted
        from sections
        where course_id = any(%s);
    """

    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sections_sql, (course_ids,))
            section_rows = cur.fetchall()

            section_ids = [row[0] for row in section_rows]
            meeting_rows = []
            instructor_rows = []

            if section_ids:
                cur.execute(
                    """
                    select
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
                    from meeting_times
                    where section_id = any(%s);
                    """,
                    (section_ids,),
                )
                meeting_rows = cur.fetchall()

                cur.execute(
                    """
                    select
                      si.section_id,
                      i.name,
                      i.faculty_id,
                      si.role
                    from section_instructors si
                    join instructors i on i.id = si.instructor_id
                    where si.section_id = any(%s);
                    """,
                    (section_ids,),
                )
                instructor_rows = cur.fetchall()

    meetings_by_section: Dict[str, List[Dict[str, Any]]] = {}
    for row in meeting_rows:
        meetings_by_section.setdefault(row[0], []).append(
            {
                "days": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "location": row[4],
                "building": row[5],
                "room": row[6],
                "start_date": row[7],
                "end_date": row[8],
                "modality": row[9],
            }
        )

    instructors_by_section: Dict[str, List[Dict[str, Any]]] = {}
    for row in instructor_rows:
        instructors_by_section.setdefault(row[0], []).append(
            {
                "name": row[1],
                "faculty_id": row[2],
                "role": row[3],
            }
        )

    sections_by_course: Dict[str, List[Dict[str, Any]]] = {}
    for row in section_rows:
        section_id = row[0]
        course_id = row[1]
        sections_by_course.setdefault(course_id, []).append(
            {
                "section_code": row[2],
                "section_id": row[3],
                "term": row[4],
                "term_code": row[5],
                "status": row[6],
                "campus": row[7],
                "modality": row[8],
                "start_date": row[9],
                "end_date": row[10],
                "seats": {
                    "available": row[11],
                    "capacity": row[12],
                    "enrolled": row[13],
                    "waitlisted": row[14],
                },
                "instructors": instructors_by_section.get(section_id, []),
                "meeting_times": meetings_by_section.get(section_id, []),
            }
        )

    return sections_by_course


def fetch_sections_by_course_codes(
    pooler_url: str, course_codes: List[str]
) -> Dict[str, List[Dict[str, Any]]]:
    if not course_codes:
        return {}

    sql = """
        select
          c.id,
          c.course_code
        from courses c
        where c.course_code = any(%s);
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (course_codes,))
            rows = cur.fetchall()

    course_ids = [row[0] for row in rows]
    id_to_code = {row[0]: row[1] for row in rows}
    sections_by_course_id = _fetch_sections_by_course(pooler_url, course_ids)

    sections_by_code: Dict[str, List[Dict[str, Any]]] = {}
    for course_id, sections in sections_by_course_id.items():
        code = id_to_code.get(course_id)
        if not code:
            continue
        sections_by_code[code] = sections

    return sections_by_code


def search_courses(
    pooler_url: str,
    query: str,
    subject_code: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
) -> tuple[List[Dict[str, Any]], int]:
    offset = max(page - 1, 0) * limit
    sql = """
        select
          c.id,
          c.course_code,
          c.title,
          c.description,
          c.credits_min,
          c.credits_max,
          c.credit_type,
          c.requisites,
          c.locations,
          c.attributes
        from courses c
        join subjects subj on subj.id = c.subject_id
        where (%s is null or subj.code = %s)
          and (
            c.course_code ilike %s
            or c.title ilike %s
            or c.description ilike %s
          )
        order by c.course_code
        limit %s
        offset %s;
    """
    count_sql = """
        select count(*)
        from courses c
        join subjects subj on subj.id = c.subject_id
        where (%s is null or subj.code = %s)
          and (
            c.course_code ilike %s
            or c.title ilike %s
            or c.description ilike %s
          );
    """
    like = f"%{query}%"
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(count_sql, (subject_code, subject_code, like, like, like))
            total = cur.fetchone()[0]
            cur.execute(sql, (subject_code, subject_code, like, like, like, limit, offset))
            rows = cur.fetchall()

    course_ids = [row[0] for row in rows]
    sections_by_course = _fetch_sections_by_course(pooler_url, course_ids)

    results: List[Dict[str, Any]] = []
    for row in rows:
        course_id = row[0]
        results.append(
            {
                "id": course_id,
                "course_code": row[1],
                "title": row[2],
                "description": row[3],
                "credits": {
                    "min_credits": row[4],
                    "max_credits": row[5],
                    "credit_type": row[6],
                },
                "requisites": row[7],
                "locations": row[8],
                "attributes": row[9],
                "sections": sections_by_course.get(course_id, []),
            }
        )

    return results, total


def fetch_profile(pooler_url: str, user_id: str) -> Optional[Dict[str, Any]]:
    sql = """
        select
          user_id,
          email,
          name,
          avatar_url,
          major_code,
          graduation_year,
          graduation_term,
          start_year,
          start_term,
          completed_courses,
          gpa
        from profiles
        where user_id = %s;
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()
    if not row:
        return None
    return {
        "user_id": row[0],
        "email": row[1],
        "name": row[2],
        "avatar_url": row[3],
        "major_code": row[4],
        "graduation_year": row[5],
        "graduation_term": row[6],
        "start_year": row[7],
        "start_term": row[8],
        "completed_courses": row[9] or [],
        "gpa": row[10],
    }


def upsert_profile(pooler_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    sql = """
        insert into profiles (
          user_id,
          email,
          name,
          avatar_url,
          major_code,
          graduation_year,
          graduation_term,
          start_year,
          start_term,
          completed_courses,
          gpa,
          updated_at
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        on conflict (user_id) do update set
          email = excluded.email,
          name = excluded.name,
          avatar_url = excluded.avatar_url,
          major_code = excluded.major_code,
          graduation_year = excluded.graduation_year,
          graduation_term = excluded.graduation_term,
          start_year = excluded.start_year,
          start_term = excluded.start_term,
          completed_courses = excluded.completed_courses,
          gpa = excluded.gpa,
          updated_at = now()
        returning user_id;
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    payload["user_id"],
                    payload.get("email"),
                    payload.get("name"),
                    payload.get("avatar_url"),
                    payload.get("major_code"),
                    payload.get("graduation_year"),
                    payload.get("graduation_term"),
                    payload.get("start_year"),
                    payload.get("start_term"),
                    payload.get("completed_courses"),
                    payload.get("gpa"),
                ),
            )
            conn.commit()
    return payload
