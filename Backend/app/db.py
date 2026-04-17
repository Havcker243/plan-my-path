from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple
from typing_extensions import TypedDict

import psycopg2


# ---------------------------------------------------------------------------
# TypedDicts for DB row shapes
# ---------------------------------------------------------------------------

class SubjectRow(TypedDict):
    id: str
    code: str
    name: str


class CourseRow(TypedDict):
    id: str
    course_code: str
    title: str
    description: Optional[str]
    credits_min: Optional[int]
    credits_max: Optional[int]
    credit_type: Optional[str]
    requisites: object  # can be list, string, or None from DB
    locations: object
    attributes: object
    terms: List[Optional[str]]


class MeetingTimeRow(TypedDict):
    days: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    location: Optional[str]
    building: Optional[str]
    room: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    modality: Optional[str]


class InstructorRow(TypedDict):
    name: str
    faculty_id: Optional[str]
    role: Optional[str]


class SeatsRow(TypedDict):
    available: int
    capacity: int
    enrolled: Optional[int]
    waitlisted: Optional[int]


class SectionRow(TypedDict):
    id: str
    section_code: str
    section_id: str
    term: str
    term_code: Optional[str]
    status: Optional[str]
    campus: Optional[str]
    modality: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    seats: SeatsRow
    instructors: List[InstructorRow]
    meeting_times: List[MeetingTimeRow]


class TermCalendarRow(TypedDict):
    term: str
    year: int
    start_date: Optional[str]
    end_date: Optional[str]


class CourseDetailRow(TypedDict):
    course_code: str
    title: Optional[str]
    description: Optional[str]
    credits_min: Optional[int]
    credits_max: Optional[int]
    requisites: object
    terms: List[Optional[str]]


class PlanCourseRow(TypedDict):
    id: str
    code: str
    title: str
    credits: int
    description: Optional[str]
    prerequisites: object
    offered_terms: List[Optional[str]]
    type: str
    requirement_bucket: None
    status: str
    grade: Optional[str]
    semester_id: str
    selected_section_id: Optional[str]


class PlanSemesterRow(TypedDict):
    id: str
    term: str
    year: int
    label: str
    start_date: Optional[str]
    end_date: Optional[str]
    courses: List[PlanCourseRow]


class PlanRow(TypedDict):
    id: str
    name: str
    semesters: List[PlanSemesterRow]


class SearchCourseRow(TypedDict):
    id: str
    course_code: str
    title: Optional[str]
    description: Optional[str]
    credits: dict  # {"min_credits": int|None, "max_credits": int|None, "credit_type": str|None}
    requisites: object
    locations: object
    attributes: object
    sections: List[SectionRow]


class ProfileRow(TypedDict):
    user_id: str
    email: Optional[str]
    name: Optional[str]
    phone: Optional[str]
    avatar_url: Optional[str]
    major_code: Optional[str]
    graduation_year: Optional[int]
    graduation_term: Optional[str]
    start_year: Optional[int]
    start_term: Optional[str]
    completed_courses: List[str]
    gpa: Optional[float]


class CourseLabelEntry(TypedDict):
    label: str
    group_name: str
    group_type: str
    detail: str
    credits: Optional[float]


class ElectiveRule(TypedDict):
    subject_code: str
    min_level: int
    max_level: Optional[int]
    exclude_courses: set  # set[str]
    group_name: str


class CourseLabelsData(TypedDict):
    labels: dict  # dict[str, CourseLabelEntry]
    rules: List[ElectiveRule]
    total_credits: int


# ---------------------------------------------------------------------------
# Env / connection helpers
# ---------------------------------------------------------------------------


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


def fetch_subjects(pooler_url: str) -> List[SubjectRow]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, code, name from subjects order by code;")
            rows = cur.fetchall()
    return [{"id": row[0], "code": row[1], "name": row[2]} for row in rows]


def fetch_majors(pooler_url: str) -> List[dict]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, name, degree_type, total_credits_required FROM majors ORDER BY name;"
            )
            rows = cur.fetchall()
    return [
        {
            "code": row[0],
            "name": row[1] or row[0],
            "degree_type": row[2],
            "total_credits_required": row[3],
        }
        for row in rows
    ]


def fetch_courses_by_subject(pooler_url: str, subject_code: str) -> List[CourseRow]:
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
    results: List[CourseRow] = []
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


def _fetch_sections_by_course(
    pooler_url: str,
    course_ids: List[str],
    term_filter: Optional[str] = None,
) -> dict[str, List[SectionRow]]:
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
        where course_id = any(%s::uuid[])
    """
    params: List[str | int] = [course_ids]  # type: ignore[assignment]  # psycopg2 accepts lists directly
    if term_filter:
        sections_sql += " and lower(term) like %s"
        params.append(f"%{term_filter.lower()}%")
    sections_sql += ";"

    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sections_sql, params)
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
                    where section_id = any(%s::uuid[]);
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
                    where si.section_id = any(%s::uuid[]);
                    """,
                    (section_ids,),
                )
                instructor_rows = cur.fetchall()

    meetings_by_section: dict[str, List[MeetingTimeRow]] = {}
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

    instructors_by_section: dict[str, List[InstructorRow]] = {}
    for row in instructor_rows:
        instructors_by_section.setdefault(row[0], []).append(
            {
                "name": row[1],
                "faculty_id": row[2],
                "role": row[3],
            }
        )

    sections_by_course: dict[str, List[SectionRow]] = {}
    for row in section_rows:
        section_id = row[0]
        course_id = row[1]
        sections_by_course.setdefault(course_id, []).append(
            {
                "id": section_id,
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
    pooler_url: str,
    course_codes: List[str],
    term_filter: Optional[str] = None,
) -> dict[str, List[SectionRow]]:
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
    sections_by_course_id = _fetch_sections_by_course(pooler_url, course_ids, term_filter)

    sections_by_code: dict[str, List[SectionRow]] = {}
    for course_id, sections in sections_by_course_id.items():
        code = id_to_code.get(course_id)
        if not code:
            continue
        sections_by_code[code] = sections

    return sections_by_code


def fetch_term_calendar(pooler_url: str) -> List[TermCalendarRow]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select term, year, start_date, end_date
                from term_calendar
                order by year, term;
                """
            )
            rows = cur.fetchall()
    return [
        {"term": row[0], "year": row[1], "start_date": row[2], "end_date": row[3]}
        for row in rows
    ]


def _fetch_course_details_by_codes(
    pooler_url: str, course_codes: List[str]
) -> dict[str, CourseDetailRow]:
    if not course_codes:
        return {}
    sql = """
        select
          c.course_code,
          c.title,
          c.description,
          c.credits_min,
          c.credits_max,
          c.requisites,
          array_agg(distinct s.term) as terms
        from courses c
        left join sections s on s.course_id = c.id
        where c.course_code = any(%s)
        group by c.course_code, c.title, c.description, c.credits_min, c.credits_max, c.requisites
        order by c.course_code;
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (course_codes,))
            rows = cur.fetchall()
    results: dict[str, CourseDetailRow] = {}
    for row in rows:
        results[row[0]] = {
            "course_code": row[0],
            "title": row[1],
            "description": row[2],
            "credits_min": row[3],
            "credits_max": row[4],
            "requisites": row[5],
            "terms": row[6] or [],
        }
    return results


def fetch_plan(pooler_url: str, user_id: str) -> Optional[PlanRow]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, name from plans where user_id = %s;", (user_id,))
            plan_row = cur.fetchone()
            if not plan_row:
                return None
            plan_id, plan_name = plan_row

            cur.execute(
                """
                select id, term, year, label, start_date, end_date
                from plan_semesters
                where plan_id = %s;
                """,
                (plan_id,),
            )
            semester_rows = cur.fetchall()

            semester_ids = [row[0] for row in semester_rows]
            course_rows: List[Tuple[str, str, str, str, Optional[str], int, Optional[str]]] = []
            if semester_ids:
                cur.execute(
                    """
                    select id, semester_id, course_code, status, grade, credits, selected_section_id
                    from plan_courses
                    where semester_id = any(%s::uuid[]);
                    """,
                    (semester_ids,),
                )
                course_rows = cur.fetchall()

    course_codes = [row[2] for row in course_rows]
    course_details = _fetch_course_details_by_codes(pooler_url, course_codes)

    semesters: List[PlanSemesterRow] = []
    courses_by_semester: dict[str, List[PlanCourseRow]] = {}
    for row in course_rows:
        course_id, semester_id, code, status, grade, credits, selected_section_id = row
        detail = course_details.get(code, {})
        credits_value = credits
        if credits_value is None:
            credits_value = detail.get("credits_min") or detail.get("credits_max") or 0
        credits_value = int(credits_value) if credits_value is not None else 0
        courses_by_semester.setdefault(semester_id, []).append(
            {
                "id": course_id,
                "code": code,
                "title": detail.get("title") or code,
                "credits": credits_value,
                "description": detail.get("description"),
                "prerequisites": detail.get("requisites"),
                "offered_terms": detail.get("terms") or [],
                "type": "core",
                "requirement_bucket": None,
                "status": status,
                "grade": grade,
                "semester_id": semester_id,
                "selected_section_id": selected_section_id,
            }
        )

    for row in semester_rows:
        semester_id, term, year, label, start_date, end_date = row
        semesters.append(
            {
                "id": semester_id,
                "term": term,
                "year": year,
                "label": label,
                "start_date": start_date,
                "end_date": end_date,
                "courses": courses_by_semester.get(semester_id, []),
            }
        )

    return {"id": plan_id, "name": plan_name, "semesters": semesters}


def save_plan(pooler_url: str, user_id: str, payload: dict) -> Optional[PlanRow]:
    semesters_payload = payload.get("semesters") or []
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            # Use FOR UPDATE to prevent concurrent saves corrupting data
            cur.execute("select id from plans where user_id = %s for update;", (user_id,))
            plan_row = cur.fetchone()
            if plan_row:
                plan_id = plan_row[0]
                cur.execute(
                    "update plans set updated_at = now() where id = %s;",
                    (plan_id,),
                )
            else:
                cur.execute(
                    "insert into plans (user_id, name) values (%s, %s) returning id;",
                    (user_id, payload.get("name") or "My Academic Plan"),
                )
                plan_id = cur.fetchone()[0]

            # Get existing semester IDs so we can UPDATE instead of DELETE+INSERT
            cur.execute(
                "select id from plan_semesters where plan_id = %s;", (plan_id,)
            )
            existing_semester_ids = {str(row[0]) for row in cur.fetchall()}
            incoming_semester_ids: set[str] = set()

            for semester in semesters_payload:
                incoming_id = str(semester.get("id") or "")
                term = semester.get("type") or semester.get("term")
                year = semester.get("year")
                label = semester.get("label")
                start_date = semester.get("startDate") or semester.get("start_date")
                end_date = semester.get("endDate") or semester.get("end_date")

                if incoming_id and incoming_id in existing_semester_ids:
                    # Preserve existing semester ID — just update metadata
                    cur.execute(
                        """
                        update plan_semesters set
                          term = %s, year = %s, label = %s,
                          start_date = %s, end_date = %s, updated_at = now()
                        where id = %s;
                        """,
                        (term, year, label, start_date, end_date, incoming_id),
                    )
                    semester_id = incoming_id
                else:
                    # New semester — INSERT and get the DB-generated ID
                    cur.execute(
                        """
                        insert into plan_semesters (
                          plan_id, term, year, label, start_date, end_date, updated_at
                        ) values (%s, %s, %s, %s, %s, %s, now())
                        returning id;
                        """,
                        (plan_id, term, year, label, start_date, end_date),
                    )
                    semester_id = str(cur.fetchone()[0])

                incoming_semester_ids.add(semester_id)

                # Courses: delete and re-insert (simpler; courses have no stable client IDs)
                cur.execute(
                    "delete from plan_courses where semester_id = %s;", (semester_id,)
                )
                for course in semester.get("courses", []):
                    cur.execute(
                        """
                        insert into plan_courses (
                          semester_id,
                          course_code,
                          status,
                          grade,
                          credits,
                          selected_section_id,
                          updated_at
                        ) values (%s, %s, %s, %s, %s, %s, now());
                        """,
                        (
                            semester_id,
                            course.get("code"),
                            course.get("status") or "planned",
                            course.get("grade"),
                            course.get("credits"),
                            course.get("selectedSectionId") or course.get("selected_section_id"),
                        ),
                    )

            # Delete semesters that were removed from the plan
            removed_ids = existing_semester_ids - incoming_semester_ids
            if removed_ids:
                cur.execute(
                    "delete from plan_semesters where id = any(%s::uuid[]);",
                    (list(removed_ids),),
                )

            conn.commit()

    return fetch_plan(pooler_url, user_id)


def search_courses(
    pooler_url: str,
    query: str,
    subject_code: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
) -> tuple[List[SearchCourseRow], int]:
    # Guard against excessively long queries that produce slow ILIKE scans
    if len(query) > 200:
        query = query[:200]
    limit = min(limit, 100)
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

    results: List[SearchCourseRow] = []
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


def fetch_profile(pooler_url: str, user_id: str) -> Optional[ProfileRow]:
    sql = """
        select
          user_id,
          email,
          name,
          phone,
          avatar_url,
          major_code,
          minor_code,
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
        "phone": row[3],
        "avatar_url": row[4],
        "major_code": row[5],
        "minor_code": row[6],
        "graduation_year": row[7],
        "graduation_term": row[8],
        "start_year": row[9],
        "start_term": row[10],
        "completed_courses": row[11] or [],
        "gpa": row[12],
    }


def upsert_profile(pooler_url: str, payload: dict) -> dict:
    sql = """
        insert into profiles (
          user_id,
          email,
          name,
          phone,
          avatar_url,
          major_code,
          minor_code,
          graduation_year,
          graduation_term,
          start_year,
          start_term,
          completed_courses,
          gpa,
          updated_at
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        on conflict (user_id) do update set
          email = excluded.email,
          name = excluded.name,
          phone = excluded.phone,
          avatar_url = excluded.avatar_url,
          major_code = excluded.major_code,
          minor_code = excluded.minor_code,
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
                    payload.get("phone"),
                    payload.get("avatar_url"),
                    payload.get("major_code"),
                    payload.get("minor_code"),
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


def delete_user_data(pooler_url: str, user_id: str) -> None:
    """Delete all user-owned rows: plan_courses → plan_semesters → plans → profiles."""
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM plan_courses
                WHERE semester_id IN (
                    SELECT ps.id FROM plan_semesters ps
                    JOIN plans p ON ps.plan_id = p.id
                    WHERE p.user_id = %s
                )
                """,
                (user_id,),
            )
            cur.execute(
                """
                DELETE FROM plan_semesters
                WHERE plan_id IN (SELECT id FROM plans WHERE user_id = %s)
                """,
                (user_id,),
            )
            cur.execute("DELETE FROM plans WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM profiles WHERE user_id = %s", (user_id,))
        conn.commit()


def fetch_course_labels(pooler_url: str, major_code: str) -> CourseLabelsData:
    """
    Fetch course labels for a specific major.
    Returns a dictionary mapping course_code to label information.

    Labels:
    - "Required" - Must take this course (from all_of groups)
    - "Group Choice" - Pick one from a group (from choose_one groups)
    - "Major Elective" - Counts toward major electives (from rules)
    - "General Elective" - Fills remaining credits
    """
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            # Get total credits required for this major
            cur.execute(
                "SELECT total_credits_required FROM majors WHERE code = %s",
                (major_code,),
            )
            major_row = cur.fetchone()
            total_credits: int = major_row[0] if major_row and major_row[0] else 120

            # Get all requirement courses for this major
            cur.execute(
                """
                SELECT
                    rc.course_code,
                    rc.course_name,
                    rc.credits,
                    rc.is_required,
                    rg.group_id,
                    rg.group_name,
                    rg.group_type,
                    rg.description
                FROM requirement_courses rc
                JOIN requirement_groups rg ON rg.id = rc.group_id
                JOIN majors m ON m.id = rg.major_id
                WHERE m.code = %s
                ORDER BY rg.display_order, rc.course_code
                """,
                (major_code,),
            )

            rows = cur.fetchall()
            labels: dict[str, CourseLabelEntry] = {}

            for row in rows:
                course_code, course_name, credits, is_required, group_id, group_name, group_type, description = row

                # Determine label based on group type
                if group_type == 'all_of':
                    label = 'Required'
                    detail = f"Required for {group_name}"
                elif group_type == 'choose_one':
                    label = 'Group Choice'
                    detail = f"Choose one from {group_name}"
                elif group_type == 'choose_n':
                    label = 'Group Choice'
                    detail = f"Choose from {group_name}"
                elif group_type == 'credit_threshold':
                    label = 'Major Elective'
                    detail = group_name
                else:
                    label = 'General Elective'
                    detail = group_name

                # Store the most specific label (Required > Group Choice > Elective)
                if course_code not in labels or label == 'Required':
                    labels[course_code] = {
                        'label': label,
                        'group_name': group_name,
                        'group_type': group_type,
                        'detail': detail,
                        'credits': credits,
                    }

            # Get major electives rules
            cur.execute(
                """
                SELECT
                    rr.subject_code,
                    rr.min_level,
                    rr.max_level,
                    rr.exclude_courses,
                    rg.group_name
                FROM requirement_rules rr
                JOIN requirement_groups rg ON rg.id = rr.group_id
                JOIN majors m ON m.id = rg.major_id
                WHERE m.code = %s AND rr.rule_type = 'subject_level'
                """,
                (major_code,),
            )

            rules = cur.fetchall()

            # Store rules for later application
            elective_rules: List[ElectiveRule] = []
            for rule_row in rules:
                subject_code, min_level, max_level, exclude_courses, group_name = rule_row
                elective_rules.append({
                    'subject_code': subject_code,
                    'min_level': min_level,
                    'max_level': max_level,
                    'exclude_courses': set(exclude_courses or []),
                    'group_name': group_name,
                })

    return {'labels': labels, 'rules': elective_rules, 'total_credits': total_credits}


def get_course_label(course_code: str, labels_data: CourseLabelsData) -> CourseLabelEntry:
    """
    Determine the label for a single course based on labels data.
    This applies the labeling logic including pattern-matching rules.
    """
    labels = labels_data.get('labels', {})
    rules = labels_data.get('rules', [])

    # Check if course is explicitly in requirements
    if course_code in labels:
        return labels[course_code]

    # Check if course matches elective rules
    for rule in rules:
        subject_code = rule['subject_code']
        min_level = rule['min_level']
        max_level = rule.get('max_level')
        exclude_courses = rule.get('exclude_courses', set())

        # Check if course matches pattern (e.g., CSCI-XXX)
        if course_code.startswith(subject_code + '-'):
            # Extract level from course code (e.g., CSCI-241 → 241)
            try:
                parts = course_code.split('-')
                if len(parts) >= 2:
                    # Remove any non-digit characters (e.g., CSCI-241L → 241)
                    level_str = ''.join(filter(str.isdigit, parts[1]))
                    if level_str:
                        level = int(level_str)

                        # Check if within level range
                        if level >= min_level and (max_level is None or level <= max_level):
                            # Check if not excluded
                            if course_code not in exclude_courses:
                                return {
                                    'label': 'Major Elective',
                                    'group_name': rule['group_name'],
                                    'group_type': 'credit_threshold',
                                    'detail': f"{subject_code} {min_level}+ level",
                                    'credits': None,
                                }
            except (ValueError, IndexError):
                pass

    # Default to general elective
    return {
        'label': 'General Elective',
        'group_name': 'General Electives',
        'group_type': 'fill_remaining',
        'detail': 'Counts toward 120 total credits',
        'credits': None,
    }


# ---------------------------------------------------------------------------
# Course reviews
# ---------------------------------------------------------------------------

def get_reviews(pooler_url: str, course_code: str) -> list[dict]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, course_code, year_taken, term_taken, professor, comment, created_at
                FROM course_reviews
                WHERE course_code = %s
                ORDER BY created_at DESC
                LIMIT 50
                """,
                (course_code,),
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(row[0]),
            "course_code": row[1],
            "year_taken": row[2],
            "term_taken": row[3],
            "professor": row[4],
            "comment": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
        }
        for row in rows
    ]


def get_recent_reviews(pooler_url: str, limit: int = 20) -> list[dict]:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, course_code, year_taken, term_taken, professor, comment, created_at
                FROM course_reviews
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (min(limit, 100),),
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(row[0]),
            "course_code": row[1],
            "year_taken": row[2],
            "term_taken": row[3],
            "professor": row[4],
            "comment": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
        }
        for row in rows
    ]


def create_review(
    pooler_url: str,
    course_code: str,
    year_taken: Optional[int],
    term_taken: Optional[str],
    professor: Optional[str],
    comment: str,
) -> dict:
    with connect(pooler_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO course_reviews (course_code, year_taken, term_taken, professor, comment)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, course_code, year_taken, term_taken, professor, comment, created_at
                """,
                (course_code, year_taken, term_taken, professor, comment),
            )
            row = cur.fetchone()
        conn.commit()
    return {
        "id": str(row[0]),
        "course_code": row[1],
        "year_taken": row[2],
        "term_taken": row[3],
        "professor": row[4],
        "comment": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }
