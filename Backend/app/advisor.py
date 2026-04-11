"""
AI Academic Advisor — powered by Google Gemini
Uses Gemini to give students personalized course recommendations based on
their profile, current plan, degree requirements, and Hub reviews.
"""
from __future__ import annotations

import os
from typing import Optional

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - optional dependency in local/dev setups
    genai = None


MODEL = "gemini-1.5-flash"  # free tier, fast


def _fmt_course_list(courses: list[dict]) -> str:
    if not courses:
        return "  (none)"
    return "\n".join(
        f"  - {c.get('code', '?')} — {c.get('title', '')} ({c.get('credits', '?')} cr)"
        + (f" [Grade: {c['grade']}]" if c.get('grade') else "")
        for c in courses
    )


def build_prompt(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    history: list[dict] | None,
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

    plan_codes = {c["code"] for c in completed + planned}
    missing_required = [
        f"  - {code} ({entry.get('label', 'Required')})"
        for code, entry in labels.items()
        if entry.get("label") in ("Required", "Group Choice") and code not in plan_codes
    ]

    major_codes = set(labels.keys())
    relevant_reviews = [r for r in reviews if r.get("course_code") in major_codes][:15]
    review_block = ""
    if relevant_reviews:
        lines = []
        for r in relevant_reviews:
            term_info = f"{r.get('term_taken', '')} {r.get('year_taken', '')}".strip()
            prof = f"with {r['professor']}" if r.get("professor") else ""
            header = " | ".join(filter(None, [r.get("course_code"), term_info, prof]))
            lines.append(f"  [{header}]: {r.get('comment', '')[:200]}")
        review_block = "\nSTUDENT HUB REVIEWS (qualitative course feedback):\n" + "\n".join(lines)

    # Flatten conversation history
    history_block = ""
    if history:
        turns = []
        for msg in history:
            role = "Student" if msg.get("role") == "user" else "Advisor"
            turns.append(f"{role}: {msg.get('content', '')}")
        history_block = "\nCONVERSATION SO FAR:\n" + "\n\n".join(turns) + "\n"

    return f"""You are an academic advisor for a university. Help students plan the best path to graduation.

STUDENT PROFILE:
  Major: {major_code}
  Started: {start_term} {start_year}
  Target graduation: {grad_term} {grad_year}
  GPA: {gpa_str}
  Degree requires: {total_credits} credits total
  Credits completed: {completed_credits}
  Credits remaining: {remaining_credits}

COMPLETED COURSES:
{_fmt_course_list(completed) if completed else "  (none yet — may be a new student)"}

CURRENTLY PLANNED (not yet taken):
{_fmt_course_list(planned) if planned else "  (nothing planned yet)"}

REQUIRED/GROUP COURSES NOT YET IN PLAN:
{chr(10).join(missing_required) if missing_required else "  (all required courses are accounted for)"}
{review_block}{history_block}
INSTRUCTIONS:
- Be specific and actionable. Name actual course codes when recommending.
- Consider prerequisites — never recommend a course before its prereqs.
- Balance workload: 12–18 credits per semester is typical.
- Respect the graduation timeline.
- When recommending a full multi-semester plan, include a JSON block in this exact format so the app can parse it:

```json
{{
  "semesters": [
    {{"term": "Fall", "year": 2025, "courses": ["CSCI-241", "MATH-201"]}},
    {{"term": "Spring", "year": 2026, "courses": ["CSCI-281", "PHYS-101"]}}
  ]
}}
```

- Keep answers clear and encouraging.

Student's question: {message}"""


def get_advisor_reply(
    message: str,
    profile: dict,
    plan: dict | None,
    labels: dict,
    total_credits: int,
    reviews: list[dict],
    history: list[dict] | None = None,
) -> str:
    if genai is None:
        raise RuntimeError(
            "Google Generative AI dependency is not installed. "
            "Run: pip install google-generativeai"
        )

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL)

    prompt = build_prompt(message, profile, plan, labels, total_credits, reviews, history)
    response = model.generate_content(prompt)
    return response.text
