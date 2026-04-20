"""
AI Academic Advisor powered by OpenRouter's OpenAI-compatible API.

The advisor keeps the academic planning logic in this app deterministic, then
uses the model for explanation, suggestions, and conversational support.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Generator, Optional

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b:free"

_client: Any | None = None


def _load_key_from_env_file(key_names: tuple[str, ...]) -> Optional[str]:
    """Fall back to reading Backend/.env manually if a key is not in os.environ."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() in key_names:
            return value.strip().strip("'\"")
    return None


def _get_env_value(key: str, default: Optional[str] = None) -> Optional[str]:
    return os.environ.get(key) or _load_key_from_env_file((key,)) or default


def _get_client() -> Any:
    global _client
    if _client is None:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("OpenAI SDK is not installed. Run: pip install openai") from exc

        api_key = (
            os.environ.get("OPENROUTER_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
            or os.environ.get("GEMINI_API_KEY")
            or _load_key_from_env_file(("OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"))
        )
        if not api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY, OPENAI_API_KEY, or legacy GEMINI_API_KEY is not set in Backend/.env or environment"
            )

        default_headers: dict[str, str] = {}
        site_url = _get_env_value("OPENROUTER_SITE_URL")
        app_name = _get_env_value("OPENROUTER_APP_NAME", "FiskGrad")
        if site_url:
            default_headers["HTTP-Referer"] = site_url
        if app_name:
            default_headers["X-Title"] = app_name

        _client = OpenAI(
            base_url=_get_env_value("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL),
            api_key=api_key,
            default_headers=default_headers or None,
        )
    return _client


def _model_name() -> str:
    return _get_env_value("OPENROUTER_MODEL", DEFAULT_MODEL) or DEFAULT_MODEL


def _fmt_course_list(courses: list[dict]) -> str:
    if not courses:
        return "  (none)"
    return "\n".join(
        f"  - {c.get('code', '?')} - {c.get('title', '')} ({c.get('credits', '?')} cr)"
        + (f" [Grade: {c['grade']}]" if c.get("grade") else "")
        for c in courses
    )


def build_context_prompt(
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    course_catalog: list[dict] | None = None,
    subject_codes: list[str] | None = None,
) -> str:
    major_code = profile.get("major_code") or "Undeclared"
    grad_term = profile.get("graduation_term") or "Unknown"
    grad_year = profile.get("graduation_year") or "Unknown"
    start_term = profile.get("start_term") or "Unknown"
    start_year = profile.get("start_year") or "Unknown"
    gpa = profile.get("gpa")
    gpa_str = f"{gpa:.2f}" if gpa else "Not available"

    completed: list[dict] = []
    planned: list[dict] = []
    if plan:
        for sem in plan.get("semesters", []):
            for course in sem.get("courses", []):
                status = course.get("status", "planned")
                entry = {
                    "code": course.get("code"),
                    "title": course.get("title"),
                    "credits": course.get("credits"),
                    "grade": course.get("grade"),
                    "semester": f"{sem.get('term')} {sem.get('year')}",
                }
                if status == "completed":
                    completed.append(entry)
                else:
                    planned.append(entry)

    completed_credits = sum(c.get("credits") or 0 for c in completed)
    remaining_credits = max(0, total_credits - completed_credits)
    student_stage = (
        "senior" if completed_credits >= 90 else
        "junior" if completed_credits >= 60 else
        "sophomore" if completed_credits >= 30 else
        "freshman / early program"
    )

    plan_codes = {c["code"] for c in completed + planned if c.get("code")}
    missing_required = [
        f"  - {code} ({entry.get('label', 'Required')})"
        for code, entry in labels.items()
        if entry.get("label") in ("Required", "Group Choice") and code not in plan_codes
    ]

    relevant_reviews = reviews[:35]
    review_block = ""
    if relevant_reviews:
        lines = []
        for review in relevant_reviews:
            term_info = f"{review.get('term_taken', '')} {review.get('year_taken', '')}".strip()
            professor = f"with {review['professor']}" if review.get("professor") else ""
            header = " | ".join(filter(None, [review.get("course_code"), term_info, professor]))
            lines.append(f"  [{header}]: {review.get('comment', '')[:200]}")
        review_block = "\nSTUDENT HUB REVIEWS:\n" + "\n".join(lines)

    requirement_lines = []
    for code, entry in list(labels.items())[:120]:
        requirement_lines.append(
            f"  - {code}: {entry.get('label', 'Requirement')} | {entry.get('group_name', '')} | {entry.get('detail', '')}"
        )

    catalog_block = ""
    if course_catalog:
        lines = []
        for course in course_catalog[:70]:
            terms = ", ".join(str(term) for term in (course.get("terms") or [])[:4])
            lines.append(
                f"  - {course.get('course_code')}: {course.get('title', '')}"
                f" ({course.get('credits', '?')} cr)"
                + (f" | Terms: {terms}" if terms else "")
            )
        catalog_block = "\nREAD-ONLY COURSE DATABASE CONTEXT:\n" + "\n".join(lines)

    return f"""You are an academic advisor at Fisk University. Your name is not important — you're just "your advisor" in this app. You have full access to this student's transcript, plan, and degree requirements. You know their situation better than they do in many cases.

Your job is to help them graduate on time, make smart course decisions, and feel supported — not overwhelmed.

HOW TO TALK:
Speak the way a real advisor would in a one-on-one meeting. Warm, direct, human. You know this student personally (their data is right in front of you), so use it. Don't start with "Great question!" or generic openers. Just get into it.

If a student asks something vague or emotional ("am I going to be okay?", "where am I in my journey?"), lead with the most important thing they need to know — one clear sentence — then give the context. End with what they should focus on next or a follow-up question if you need more info to help.

If a student asks something specific ("what should I take next semester?"), give them a concrete answer with real course codes. Don't hedge everything — make a recommendation and explain briefly why.

If something is actually a problem (they're behind, missing a key prereq, overloading), say it clearly but don't panic them. Tell them what to do about it.

STRICT FORMAT RULES — never break these:
- No markdown tables. Ever. Not even for semester plans.
- No bold headers or section dividers in conversational responses.
- No bullet lists unless you're listing 3+ specific courses or action items and prose would be harder to read.
- Keep responses short unless the student asks for a detailed breakdown. 3–6 sentences is usually right for a casual question. A detailed plan can be longer but must be scannable, not a wall of text.
- Never summarize everything you know about the student unprompted — only surface what's relevant to the question.
- Don't end every message with "feel free to ask anything!" or similar filler. End with what matters: a next step, a question, or just the answer.

WHAT A REAL ADVISOR DOES:
- Prioritizes. Not every gap is urgent. If a student is 17 credits from graduation, tell them what actually blocks graduation first.
- Asks follow-up questions when it helps. If you don't have enough to give good advice, ask one focused question — not five.
- Acknowledges stress without making it a big deal. If a student sounds anxious, a quick "you're actually in decent shape" goes a long way.
- Refers to real constraints. If a course is only offered in fall, say that. If a prereq is required, flag it. Use the data.
- Doesn't pretend to be official. You're a planning tool — for anything that affects financial aid, official graduation clearance, or policy exceptions, tell them to confirm with the registrar or their department advisor.

A normal full-time load is 12–18 credits per semester.

If the student asks for a multi-semester course plan, include a JSON block in this exact shape (no other format):

```json
{{
  "semesters": [
    {{"term": "Fall", "year": 2026, "courses": ["CSCI-241", "MATH-201"]}},
    {{"term": "Spring", "year": 2027, "courses": ["CSCI-281", "PHYS-101"]}}
  ]
}}
```

--- STUDENT FILE (use this to personalize every response) ---

Major: {major_code} | Stage: {student_stage} | GPA: {gpa_str}
Started: {start_term} {start_year} | Target graduation: {grad_term} {grad_year}
Credits: {completed_credits} completed / {total_credits} required ({remaining_credits} remaining)
Subject areas: {", ".join(subject_codes or []) or "Unknown"}

COMPLETED COURSES:
{_fmt_course_list(completed) if completed else "  (none on record — may be a new or transfer student)"}

PLANNED BUT NOT YET TAKEN:
{_fmt_course_list(planned) if planned else "  (nothing planned yet)"}

REQUIRED COURSES MISSING FROM PLAN:
{chr(10).join(missing_required) if missing_required else "  (all required courses accounted for in plan)"}

DEGREE REQUIREMENT MAP:
{chr(10).join(requirement_lines) if requirement_lines else "  (no requirement data loaded)"}
{catalog_block}
{review_block}
---
"""


def _sanitize_history(history: list[dict] | None) -> list[dict]:
    safe_messages: list[dict] = []
    if not history:
        return safe_messages

    for item in history[-20:]:
        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        message: dict[str, Any] = {"role": role, "content": content[:4000]}

        # OpenRouter reasoning continuation requires this to be passed back
        # unmodified on assistant messages when the provider returns it.
        if role == "assistant" and "reasoning_details" in item:
            message["reasoning_details"] = item["reasoning_details"]

        safe_messages.append(message)
    return safe_messages


def _build_messages(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    course_catalog: list[dict] | None,
    subject_codes: list[str] | None,
    history: list[dict] | None,
) -> list[dict]:
    return [
        {"role": "system", "content": build_context_prompt(profile, plan, labels, total_credits, reviews, course_catalog, subject_codes)},
        *_sanitize_history(history),
        {"role": "user", "content": message},
    ]


def get_advisor_completion(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    course_catalog: list[dict] | None = None,
    subject_codes: list[str] | None = None,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    client = _get_client()
    messages = _build_messages(message, profile, plan, labels, total_credits, reviews, course_catalog, subject_codes, history)
    try:
        response = client.chat.completions.create(
            model=_model_name(),
            messages=messages,
            extra_body={"reasoning": {"enabled": True}},
        )
        assistant_message = response.choices[0].message
        return {
            "content": assistant_message.content or "",
            "reasoning_details": getattr(assistant_message, "reasoning_details", None),
        }
    except Exception as exc:
        print(f"[Advisor] OpenRouter API error: {exc}")
        raise


def get_advisor_reply(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    course_catalog: list[dict] | None = None,
    subject_codes: list[str] | None = None,
    history: list[dict] | None = None,
) -> str:
    return get_advisor_completion(message, profile, plan, labels, total_credits, reviews, course_catalog, subject_codes, history)["content"]


def stream_advisor_reply(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    course_catalog: list[dict] | None = None,
    subject_codes: list[str] | None = None,
    history: list[dict] | None = None,
) -> Generator[dict[str, Any], None, None]:
    """
    Yields advisor events for the existing SSE endpoint from one streaming
    OpenRouter request.
    """
    client = _get_client()
    messages = _build_messages(message, profile, plan, labels, total_credits, reviews, course_catalog, subject_codes, history)
    reasoning_details: Any = None

    try:
        stream = client.chat.completions.create(
            model=_model_name(),
            messages=messages,
            extra_body={"reasoning": {"enabled": True}},
            stream=True,
        )

        for event in stream:
            if not getattr(event, "choices", None):
                continue
            choice = event.choices[0]
            delta = getattr(choice, "delta", None)
            if delta is None:
                continue

            content = getattr(delta, "content", None)
            if isinstance(content, str) and content:
                yield {"chunk": content}
            elif isinstance(content, list):
                text_parts = [
                    part.get("text", "")
                    for part in content
                    if isinstance(part, dict) and isinstance(part.get("text"), str)
                ]
                if text := "".join(text_parts):
                    yield {"chunk": text}

            details = getattr(delta, "reasoning_details", None)
            if details is None:
                model_extra = getattr(delta, "model_extra", None)
                if isinstance(model_extra, dict):
                    details = model_extra.get("reasoning_details")
            if details is not None:
                reasoning_details = details

        if reasoning_details is not None:
            yield {"reasoning_details": reasoning_details}
    except Exception as exc:
        print(f"[Advisor] OpenRouter streaming error: {exc}")
        raise
