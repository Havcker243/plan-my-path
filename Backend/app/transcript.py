"""
Transcript parser for Colleague/Ellucian-style academic transcripts.

Expected course line format (completed):
    Title... SUBJECT NUMBER SECTION GRADE N CREDITS CREDITS

Expected course line format (planned/in-progress):
    Title... SUBJECT NUMBER SECTION N

Term header format: 2024FA, 2025SP, 2025SU, 2025WI, etc.
Totals line:        TOTALS CRED.ATT = XX.XX ... GPA = X.XXX
"""

from __future__ import annotations

import io
import re
from typing import Optional

TERM_CODE_MAP = {
    "FA": "Fall",
    "SP": "Spring",
    "SU": "Summer",
    "SM": "Summer",
    "WI": "Winter",
}

# Valid letter grades that indicate a completed course
VALID_GRADES = {
    "A+", "A", "A-",
    "B+", "B", "B-",
    "C+", "C", "C-",
    "D+", "D", "D-",
    "F",
}

# Regex: a term-year prefix like "2024FA" or "2025SP"
RE_TERM_HEADER = re.compile(r"^(\d{4})(FA|SP|SU|SM|WI)\s*(.*)", re.DOTALL)

# Regex: a completed course line
# Captures: title, subject, course_num, section, grade, credits
RE_COURSE_COMPLETED = re.compile(
    r"^(.+?)\s+"           # title (non-greedy)
    r"([A-Z]{2,6})\s+"     # SUBJECT CODE
    r"(\d+[A-Z0-9]*)\s+"  # course number (e.g. 110, 110L, 282L, 390CPT)
    r"(\w+)\s+"            # section number
    r"([A-DF][+\-]?)\s+"  # letter grade (A/B/C/D/F with optional +/-)
    r"[NTR]\s+"            # grade type (N=normal, T=transfer, R=repeat)
    r"(\d+\.\d)",          # credits attempted
    re.IGNORECASE,
)

# Regex: extract cumulative GPA from the TOTALS line
RE_TOTALS_GPA = re.compile(r"GPA\s*=\s*([\d.]+)")


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract all text from a PDF file using pypdf."""
    from pypdf import PdfReader  # lazy import so missing dep fails gracefully

    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


def _split_into_lines(text: str) -> list[str]:
    """Normalise whitespace and split into non-empty lines."""
    lines = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if stripped:
            lines.append(stripped)
    return lines


def parse_transcript(file_bytes: bytes) -> dict:
    """
    Parse a Colleague/Ellucian transcript PDF and return structured data.

    Returns:
        {
            "student_name": str | None,
            "gpa": float | None,
            "courses": [
                {
                    "code":    "CSCI 110",
                    "title":   "Intro to Computer Science I",
                    "grade":   "A-",
                    "credits": 3.0,
                    "term":    "Fall",
                    "year":    2024,
                }
            ]
        }
    """
    text = _extract_pdf_text(file_bytes)
    lines = _split_into_lines(text)

    courses: list[dict] = []
    current_term: Optional[dict] = None
    cumulative_gpa: Optional[float] = None
    student_name: Optional[str] = None

    # The student name appears near the top before any term blocks.
    # Heuristic: first "Firstname Lastname" line (title-case, 2–4 words, no digits)
    _name_re = re.compile(r"^[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){1,3}$")
    _name_found = False

    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1

        # ── Student name heuristic ──────────────────────────────────────────
        if not _name_found and _name_re.match(line):
            student_name = line
            _name_found = True
            continue

        # ── TOTALS / cumulative GPA ─────────────────────────────────────────
        if "TOTALS" in line or "GPA" in line:
            m = RE_TOTALS_GPA.search(line)
            if m:
                val = m.group(1)
                try:
                    v = float(val)
                    if v > 0:
                        cumulative_gpa = v
                except ValueError:
                    pass
            # Handle "GPA =" at end of line with value on the NEXT line
            if cumulative_gpa is None and re.search(r"GPA\s*=\s*$", line) and i < len(lines):
                try:
                    cumulative_gpa = float(lines[i].strip())
                    i += 1
                except ValueError:
                    pass
            continue

        # ── Skip purely numeric lines (grade-point sub-totals) ─────────────
        try:
            float(line)
            continue
        except ValueError:
            pass

        # ── Skip lines that look like sub-total rows (NN.N NN.N NN.N N.NNN) ─
        if re.match(r"^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+", line):
            continue

        # ── Term header ─────────────────────────────────────────────────────
        term_match = RE_TERM_HEADER.match(line)
        if term_match:
            year = int(term_match.group(1))
            code = term_match.group(2)
            current_term = {"term": TERM_CODE_MAP.get(code, code), "year": year}
            # The remainder of the line (after term code) may be the first course
            remainder = term_match.group(3).strip()
            if remainder:
                line = remainder  # fall through to course parsing below
            else:
                continue

        # ── Course line (completed, with a real letter grade) ───────────────
        if current_term is None:
            continue

        cm = RE_COURSE_COMPLETED.match(line)
        if not cm:
            continue

        title   = cm.group(1).strip()
        subject = cm.group(2).upper()
        number  = cm.group(3).upper()
        grade   = cm.group(5).upper()
        credits = float(cm.group(6))

        # Only include courses with a valid grade and non-zero credits
        if grade not in VALID_GRADES:
            continue
        if credits <= 0:
            continue

        code = f"{subject} {number}"

        # De-duplicate: same code + same term (handles labs that may re-appear)
        already = any(
            c["code"] == code
            and c["term"] == current_term["term"]
            and c["year"] == current_term["year"]
            for c in courses
        )
        if already:
            continue

        courses.append({
            "code":    code,
            "title":   title,
            "grade":   grade,
            "credits": credits,
            "term":    current_term["term"],
            "year":    current_term["year"],
        })

    # Sort by year then term order
    _term_order = {"Spring": 0, "Summer": 1, "Fall": 2, "Winter": 3}
    courses.sort(key=lambda c: (c["year"], _term_order.get(c["term"], 9)))

    return {
        "student_name": student_name,
        "gpa": cumulative_gpa,
        "courses": courses,
    }
