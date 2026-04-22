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

GRADE_TOKENS = VALID_GRADES | {"IP", "I", "W", "AU", "P", "NP", "S", "U"}

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

RE_COURSE_IN_PROGRESS = re.compile(
    r"^(.+?)\s+"
    r"([A-Z]{2,6})\s+"
    r"(\d+[A-Z0-9]*)\s+"
    r"(\w+)"
    r"(?:\s+([A-Z][+\-]?))?"
    r"(?:\s+([NTR]))?"
    r"(?:\s+(\d+\.\d))?$",
    re.IGNORECASE,
)

RE_TRANSFER_COURSE = re.compile(
    r"^(.+?)\s+"
    r"([A-Z]{2,6})\s+"
    r"(\d+[A-Z0-9]*)\s+"
    r"([NTR])\s+"
    r"([NTR])\s+"
    r"(\d+\.\d)\s+"
    r"(\d+\.\d)$",
    re.IGNORECASE,
)

# Regex: extract cumulative GPA from the TOTALS line
RE_TOTALS_GPA = re.compile(r"GPA\s*=\s*([\d.]+)")


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract transcript text with layered fallbacks for scanned and awkward PDFs."""
    pages: list[str] = []

    try:
        from pypdf import PdfReader  # lazy import so missing dep fails gracefully

        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            reader.decrypt("")
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    except Exception:
        pages = []

    text = "\n".join(pages).strip()
    if len(text) >= 80:
        return text

    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        fitz_pages: list[str] = []
        for page in doc:
            page_text = page.get_text("text")
            if page_text:
                fitz_pages.append(page_text)
        doc.close()
        fitz_text = "\n".join(fitz_pages).strip()
        if len(fitz_text) > len(text):
            text = fitz_text
    except Exception:
        pass

    if len(text) >= 80:
        return text

    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        ocr_pages: list[str] = []
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(image)
            if page_text:
                ocr_pages.append(page_text)
        doc.close()
        ocr_text = "\n".join(ocr_pages).strip()
        if len(ocr_text) > len(text):
            text = ocr_text
    except Exception:
        pass

    return text


def _split_into_lines(text: str) -> list[str]:
    """Normalise whitespace and split into non-empty lines."""
    lines = []
    for raw in text.splitlines():
        stripped = re.sub(r"\s+", " ", raw).strip()
        if stripped:
            lines.append(stripped)
    return lines


def _looks_like_course_tail(line: str) -> bool:
    return bool(
        re.search(r"\b[A-Z]{2,6}\s+\d+[A-Z0-9]*\b", line)
        or re.search(r"\b[A-Z]{2,6}-\d+[A-Z0-9]*\b", line)
    )


def _combine_wrapped_line(lines: list[str], index: int, line: str) -> tuple[str, int]:
    """
    Some PDFs split course rows across two lines:
      Intro to Computer Science I
      CSCI 110 01 A N 3.0
    Join those before matching the regexes.
    """
    if index >= len(lines):
        return line, index

    next_line = lines[index]
    if not _looks_like_course_tail(next_line):
        return line, index

    combined = f"{line} {next_line}"
    return combined, index + 1


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
    row_id = 0

    def next_row_id() -> str:
        nonlocal row_id
        row_id += 1
        return f"transcript-row-{row_id}"

    # The student name appears near the top before any term blocks.
    # Heuristic: first "Firstname Lastname" line (title-case, 2–4 words, no digits)
    _name_re = re.compile(r"^[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){1,3}$")
    _name_found = False

    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        line, i = _combine_wrapped_line(lines, i, line)

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
                line = remainder
                line, i = _combine_wrapped_line(lines, i, line)
            else:
                continue

        if current_term is None:
            transfer_match = RE_TRANSFER_COURSE.match(line)
            if transfer_match:
                title = transfer_match.group(1).strip()
                subject = transfer_match.group(2).upper()
                number = transfer_match.group(3).upper()
                credits = float(transfer_match.group(6))
                if credits <= 0:
                    continue
                courses.append({
                    "rowId": next_row_id(),
                    "code": f"{subject} {number}",
                    "title": title,
                    "grade": None,
                    "credits": credits,
                    "term": None,
                    "year": None,
                    "status": "completed",
                    "sourceType": "transfer",
                })
            continue

        # ── Course line (completed, with a real letter grade) ───────────────
        cm = RE_COURSE_COMPLETED.match(line)
        if cm:
            title = cm.group(1).strip()
            subject = cm.group(2).upper()
            number = cm.group(3).upper()
            grade = cm.group(5).upper()
            credits = float(cm.group(6))

            if grade not in VALID_GRADES or credits <= 0:
                continue

            courses.append({
                "rowId": next_row_id(),
                "code": f"{subject} {number}",
                "title": title,
                "grade": grade,
                "credits": credits,
                "term": current_term["term"],
                "year": current_term["year"],
                "status": "completed",
                "sourceType": "term",
            })
            continue

        # ── In-progress line (often current semester, no final grade yet) ───
        ip = RE_COURSE_IN_PROGRESS.match(line)
        if not ip:
            continue

        title = ip.group(1).strip()
        subject = ip.group(2).upper()
        number = ip.group(3).upper()
        grade_token = ip.group(5).upper() if ip.group(5) else None
        grade_type = ip.group(6).upper() if ip.group(6) else None
        credits_raw = ip.group(7)
        if grade_token in {"N", "T", "R"} and grade_type is None:
            grade_type = grade_token
            grade_token = None
        if grade_token and grade_token in VALID_GRADES:
            continue
        if grade_token and grade_token not in GRADE_TOKENS:
            continue
        credits = float(credits_raw) if credits_raw else None
        courses.append({
            "rowId": next_row_id(),
            "code": f"{subject} {number}",
            "title": title,
            "grade": None,
            "credits": credits,
            "term": current_term["term"],
            "year": current_term["year"],
            "status": "planned",
            "sourceType": "term",
        })

    # Sort by year then term order
    _term_order = {"Spring": 0, "Summer": 1, "Fall": 2, "Winter": 3}
    courses.sort(
        key=lambda c: (
            -1 if c.get("sourceType") == "transfer" else (c["year"] if c["year"] is not None else 9999),
            -1 if c.get("sourceType") == "transfer" else _term_order.get(c["term"], 9),
            c["code"],
            c["title"],
        )
    )

    return {
        "student_name": student_name,
        "gpa": cumulative_gpa,
        "courses": courses,
    }
