"""
Transcript parser for Fisk University Ellucian Colleague PDFs.

All three observed formats:

  Format A — classic Colleague (inline term code, title-first):
    2022FA New Student Orientation CORE 100 A N 1.0 1.0
    Humanities CORE 260 B+ N 3.0 3.0
    Composition II CORE 160 01 B+ N 3.0 3.0      ← has section
    Jazz Ensemble MUS 227B A N 1.0 1.0            ← no section
    2026SP World and Its Peoples CORE 360 04 N    ← in-progress (no credits)

  Format B — compact portal style (code-first):
    BIOL101 GENERAL BIOLOGY I 3.00 A 12.00
    CSCI310 JUNIOR SEMINAR 3.00

  Pre-term / transfer blocks (before first term header):
    Survey of Arts II ART 207 T R 3.0 3.0        ← transfer (Adegbesan)
    Elementary Spanish SPAN 101 C 0.0 0.0         ← pre-Fisk grade (Newsom)

  GPA:
    TOTALS CRED.ATT = 122.00 ... GPA =
    3.729                                         ← value on NEXT line

Section numbers contain at least one digit: 01, ONL03, N01, 03, ONL02.
Grades never contain digits: A, A-, B+, C, F, S, P …
"""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import tempfile
from typing import Optional

# ── Term mappings ─────────────────────────────────────────────────────────────

TERM_CODE_MAP: dict[str, str] = {
    "FA": "Fall", "SP": "Spring", "SU": "Summer", "SM": "Summer", "WI": "Winter",
}
_WORD_TO_CODE: dict[str, str] = {
    "fall": "FA", "spring": "SP", "summer": "SU", "winter": "WI",
}

# ── Grade categories ──────────────────────────────────────────────────────────

COMPLETED_GRADES = {
    "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-",
    "D+", "D", "D-",
    "S",   # Satisfactory (GPA-neutral)
    "P",   # Pass (GPA-neutral)
    "TR",  # Transfer credit
}
# Attempted and failed — keep with "failed" status so plan shows retake needed
FAILED_GRADES = {"F", "NP", "U"}

# Withdrew or never graded — drop the row entirely
SKIP_GRADES = {"W", "WF", "WP", "AU", "NG", "NR"}

# Still in progress
IP_GRADES = {"IP", "I", "IN"}

# Keep backward-compat alias used elsewhere
PASSING_GRADES = COMPLETED_GRADES

# All grade tokens (to avoid misidentifying a title word as a grade)
ALL_GRADE_TOKENS = COMPLETED_GRADES | FAILED_GRADES | SKIP_GRADES | IP_GRADES


def _grade_status(grade: str) -> str | None:
    """
    Map a grade token to a course status, or return None to skip the row.
    """
    g = grade.upper()
    if g in COMPLETED_GRADES:
        return "completed"
    if g in FAILED_GRADES:
        return "failed"
    if g in IP_GRADES:
        return "planned"
    return None  # SKIP_GRADES or unknown → drop

# Grade pattern (no digits, so "01" section numbers won't accidentally match)
_GP = (
    r"(?:"
    r"A[+\-]?|B[+\-]?|C[+\-]?|D[+\-]?|F"
    r"|S|P|TR|WF|WP|W|IP|IN|NP|NG|NR|AU|I|U"
    r")"
)

# ── Term-header regex ─────────────────────────────────────────────────────────
# Matches the term code at the START of a line (which may also have a course on it).
# Examples:  2022FA  /  2023SP  /  FALL 2023 (date...)  /  Fall 2024
RE_TERM = re.compile(
    r"^(?:"
    r"(\d{4})(FA|SP|SU|SM|WI)"                                          # 2022FA
    r"|(?:FA|SP|SU|SM|WI)\s+(\d{4})"                                    # FA 2022
    r"|(?:Fall|Spring|Summer|Winter)(?:\s+(?:I{1,3}|Semester))?\s+(\d{4})"   # Fall 2022
    r"|(?:FALL|SPRING|SUMMER|WINTER)(?:\s+(?:I{1,3}|SEMESTER))?\s+(\d{4})"  # FALL 2022
    r")\s*(.*)",
    re.DOTALL | re.IGNORECASE,
)


def _parse_term(m: re.Match) -> tuple[str, int] | None:
    g = m.groups()
    if g[0] and g[1]:
        code, year = g[1].upper(), int(g[0])
    elif g[2]:
        # FA/SP 2022 form — rebuild from the raw match
        raw = m.group(0)
        parts = raw.split()
        code = parts[0].upper()
        year = int(parts[1])
    elif g[3]:
        raw_word = m.group(0).split()[0].lower()
        code = _WORD_TO_CODE.get(raw_word, "FA")
        year = int(g[3])
    elif g[4]:
        raw_word = m.group(0).split()[0].lower()
        code = _WORD_TO_CODE.get(raw_word, "FA")
        year = int(g[4])
    else:
        return None
    return TERM_CODE_MAP.get(code, code), year


# ── Course-line regexes ───────────────────────────────────────────────────────

# Section code always contains at least one digit (01, ONL03, N01, HYB02).
# This lets us distinguish "01 A N 3.0" from "A N 3.0" (no section).
_SEC = r"(?:\w*\d\w*)"          # section: at least one digit
_CR  = r"\d+(?:\.\d+)?"         # credits: integer or decimal

# ── Format A — classic Colleague (completed course) ───────────────────────────
# TITLE SUBJ NUM [SECTION] GRADE [N|T|R] CREDITS [CREDITS]
# Section is optional; grade type (N/T/R) is optional (absent for pre-Fisk).
RE_A_DONE = re.compile(
    r"^(.+?)\s+"                  # title
    r"([A-Z]{2,6})\s+"            # subject
    r"(\d+[A-Z0-9]*)\s+"          # number  (e.g. 110, 110L, 390CPT)
    r"(?:" + _SEC + r"\s+)?"      # optional section
    r"(" + _GP + r")"             # grade
    r"(?:\s+[NTR])?"              # optional grade type
    r"\s+(" + _CR + r")"          # first credits
    r"(?:\s+" + _CR + r")?",      # optional second credits
    re.IGNORECASE,
)

# ── Format A — classic Colleague (in-progress, no grade / no credits) ─────────
# TITLE SUBJ NUM [SECTION] [N]
RE_A_IP = re.compile(
    r"^(.+?)\s+"
    r"([A-Z]{2,6})\s+"
    r"(\d+[A-Z0-9]*)"
    r"(?:\s+" + _SEC + r")?"      # optional section
    r"(?:\s+[NTR])?"              # optional grade type
    r"\s*$",
    re.IGNORECASE,
)

# ── Format A — transfer block (two NTR tokens, no letter grade) ───────────────
# TITLE SUBJ NUM [NTR] [NTR] CREDITS CREDITS
RE_A_TRANSFER = re.compile(
    r"^(.+?)\s+"
    r"([A-Z]{2,6})\s+"
    r"(\d+[A-Z0-9]*)\s+"
    r"[NTR]\s+[NTR]\s+"
    r"(" + _CR + r")"
    r"(?:\s+" + _CR + r")?$",
    re.IGNORECASE,
)

# ── Format B — compact portal (code-first) ────────────────────────────────────
# BIOL101 TITLE CREDITS GRADE [GRADEPOINTS]
# Also handles BIOL 101 and BIOL-101.
RE_B_DONE = re.compile(
    r"^([A-Z]{2,6})[-\s]?(\d+[A-Z0-9]*)\s+"
    r"(.+?)\s+"
    r"(" + _CR + r")\s+"
    r"(" + _GP + r")"
    r"(?:\s+[\d.]+[)]*)?$",
    re.IGNORECASE,
)

# Format B in-progress (no grade)
RE_B_IP = re.compile(
    r"^([A-Z]{2,6})[-\s]?(\d+[A-Z0-9]*)\s+"
    r"(.+?)\s+"
    r"(" + _CR + r")\s*[)]*\s*$",
    re.IGNORECASE,
)

# ── GPA extraction ────────────────────────────────────────────────────────────

_GPA_PATS = [
    re.compile(r"GPA\s*=\s*([\d.]+)"),
    re.compile(r"Cumulative\s+GPA[:\s]+([\d.]+)", re.I),
    re.compile(r"CUM(?:ULATIVE)?\s+GPA[:\s]+([\d.]+)", re.I),
    re.compile(r"Overall\s+GPA[:\s]+([\d.]+)", re.I),
]


def _try_gpa(line: str) -> float | None:
    for pat in _GPA_PATS:
        m = pat.search(line)
        if m:
            try:
                v = float(m.group(1))
                if 0.0 < v <= 5.0:
                    return v
            except ValueError:
                pass
    return None


# ── Lines to skip unconditionally ─────────────────────────────────────────────

RE_SKIP = re.compile(
    r"^("
    r"Page\s+\d+|PAGE$"
    r"|COURSE\b|GRDPT\b|CRD\b"
    r"|\*{2,}.*\*{2,}"          # *** CONTINUED ***
    r"|SEMESTER\s+TOTALS?"
    r"|TERM\s+TOTALS?"
    r"|UNOFFICIAL|OFFICIAL"
    r"|END\s+OF\s+TRANSCRIPT"
    r"|Continued\s+on"
    r")",
    re.IGNORECASE,
)

# Purely-numeric lines (grade-points / sub-GPA lines like "4.0", "3.762", "16.0 16.0 58.0 3.625")
RE_NUMERIC = re.compile(r"^[\d.\s]+$")


# ── PDF text extraction ───────────────────────────────────────────────────────

def _extract_pdf_text(file_bytes: bytes) -> str:
    best = ""

    # 1. pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            reader.decrypt("")
        candidate = "\n".join(p.extract_text() or "" for p in reader.pages).strip()
        if len(candidate) > len(best):
            best = candidate
    except Exception:
        pass

    if len(best) >= 200:
        return best

    # 2. pdftotext CLI
    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        tmp = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fh:
                fh.write(file_bytes)
                tmp = fh.name
            res = subprocess.run(
                [pdftotext, "-layout", tmp, "-"],
                check=False, capture_output=True,
                text=True, encoding="utf-8", errors="ignore",
            )
            candidate = (res.stdout or "").strip()
            if len(candidate) > len(best):
                best = candidate
        except Exception:
            pass
        finally:
            if tmp:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass

    if len(best) >= 200:
        return best

    # 3. PyMuPDF
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        candidate = "\n".join(p.get_text("text") for p in doc).strip()
        doc.close()
        if len(candidate) > len(best):
            best = candidate
    except Exception:
        pass

    if len(best) >= 200:
        return best

    # 4. OCR
    try:
        import fitz, pytesseract
        from PIL import Image
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            pages.append(pytesseract.image_to_string(
                Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ))
        doc.close()
        candidate = "\n".join(pages).strip()
        if len(candidate) > len(best):
            best = candidate
    except Exception:
        pass

    return best


def _split_into_lines(text: str) -> list[str]:
    lines = []
    for raw in text.splitlines():
        s = re.sub(r"[ \t]+", " ", raw).strip()
        if s:
            lines.append(s)
    return lines


# ── Main parser ───────────────────────────────────────────────────────────────

def parse_transcript(file_bytes: bytes) -> dict:
    """
    Returns::

        {
            "student_name": str | None,
            "gpa": float | None,
            "courses": [ { rowId, code, title, grade, credits, term, year,
                            status, sourceType }, ... ]
        }
    """
    raw   = _extract_pdf_text(file_bytes)
    lines = _split_into_lines(raw)

    courses: list[dict] = []
    current_term: dict | None = None
    best_gpa: float | None = None
    student_name: str | None = None
    _rid = 0

    def nid() -> str:
        nonlocal _rid
        _rid += 1
        return f"transcript-row-{_rid}"

    # Name heuristic: first title-case line with 2–4 words, no digits
    _name_re = re.compile(r"^[A-Z][A-Za-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][A-Za-z]+){1,3}$")
    _name_ok = False

    i = 0
    while i < len(lines):
        line = lines[i]; i += 1

        # ── Always skip ──────────────────────────────────────────────────────
        if RE_SKIP.match(line):
            continue
        if RE_NUMERIC.match(line):
            continue

        # ── Student name ─────────────────────────────────────────────────────
        if not _name_ok and _name_re.match(line):
            student_name = line
            _name_ok = True
            continue

        # ── GPA (handles both inline and split-next-line forms) ───────────────
        if re.search(r"\bGPA\b", line, re.IGNORECASE):
            gpa_val = _try_gpa(line)
            if gpa_val:
                best_gpa = gpa_val
            # "GPA =" at end of line → value is on the next line
            elif re.search(r"GPA\s*=\s*$", line, re.I) and i < len(lines):
                try:
                    v = float(lines[i].strip())
                    if 0.0 < v <= 5.0:
                        best_gpa = v
                        i += 1
                except ValueError:
                    pass
            continue

        # ── TOTALS line (without GPA= at end) ────────────────────────────────
        if re.match(r"^TOTALS?\b", line, re.IGNORECASE):
            continue

        # ── Term header (may appear inline at start of course line) ──────────
        tm = RE_TERM.match(line)
        if tm:
            parsed = _parse_term(tm)
            if parsed:
                current_term = {"term": parsed[0], "year": parsed[1]}
            # Remainder after the term token (strip any date-range in parens)
            remainder = re.sub(r"^\([^)]*\)\s*", "", (tm.groups()[-1] or "").strip())
            if remainder:
                line = remainder
            else:
                continue

        # ── Pre-term / transfer block ─────────────────────────────────────────
        if current_term is None:
            # T R transfer record
            tr = RE_A_TRANSFER.match(line)
            if tr:
                subj, num = tr.group(2).upper(), tr.group(3).upper()
                cr = float(tr.group(4))
                if cr > 0:
                    courses.append({
                        "rowId": nid(), "code": f"{subj} {num}",
                        "title": tr.group(1).strip().title(),
                        "grade": None, "credits": cr,
                        "term": None, "year": None,
                        "status": "completed", "sourceType": "transfer",
                    })
            else:
                # Pre-Fisk graded course (e.g. Newsom Spanish courses)
                gd = RE_A_DONE.match(line)
                if gd:
                    grade  = gd.group(4).upper()
                    status = _grade_status(grade)
                    cr     = float(gd.group(5))
                    subj   = gd.group(2).upper()
                    num    = gd.group(3).upper()
                    if status and cr >= 0:
                        courses.append({
                            "rowId": nid(), "code": f"{subj} {num}",
                            "title": gd.group(1).strip().title(),
                            "grade": grade if status in ("completed", "failed") else None,
                            "credits": cr,
                            "term": None, "year": None,
                            "status": status, "sourceType": "transfer",
                        })
            continue

        # ── Format B — compact portal (BIOL101 TITLE 3.00 A 12.00) ───────────
        mb = RE_B_DONE.match(line)
        if mb:
            grade  = mb.group(5).upper()
            status = _grade_status(grade)
            cr     = float(mb.group(4))
            if status and cr > 0:
                courses.append({
                    "rowId": nid(),
                    "code": f"{mb.group(1).upper()} {mb.group(2).upper()}",
                    "title": mb.group(3).strip(),
                    "grade": grade if status in ("completed", "failed") else None,
                    "credits": cr,
                    "term": current_term["term"], "year": current_term["year"],
                    "status": status,
                    "sourceType": "term",
                })
            continue

        mb_ip = RE_B_IP.match(line)
        if mb_ip:
            cr = float(mb_ip.group(4)) if mb_ip.group(4) else None
            if len(mb_ip.group(3).strip()) >= 2:
                courses.append({
                    "rowId": nid(),
                    "code": f"{mb_ip.group(1).upper()} {mb_ip.group(2).upper()}",
                    "title": mb_ip.group(3).strip(),
                    "grade": None, "credits": cr,
                    "term": current_term["term"], "year": current_term["year"],
                    "status": "planned", "sourceType": "term",
                })
            continue

        # ── Format A — classic Colleague (completed) ──────────────────────────
        ma = RE_A_DONE.match(line)
        if ma:
            grade  = ma.group(4).upper()
            status = _grade_status(grade)
            cr     = float(ma.group(5))
            if not status or cr <= 0:
                continue
            courses.append({
                "rowId": nid(),
                "code": f"{ma.group(2).upper()} {ma.group(3).upper()}",
                "title": ma.group(1).strip().title(),
                "grade": grade if status in ("completed", "failed") else None,
                "credits": cr,
                "term": current_term["term"], "year": current_term["year"],
                "status": status,
                "sourceType": "term",
            })
            continue

        # ── Format A — in-progress (no grade, no credits) ────────────────────
        ma_ip = RE_A_IP.match(line)
        if not ma_ip:
            continue

        subj = ma_ip.group(2).upper()
        num  = ma_ip.group(3).upper()
        title = ma_ip.group(1).strip().title()
        # Skip very short matches that are probably noise
        if len(title) < 3 or subj == num:
            continue
        courses.append({
            "rowId": nid(), "code": f"{subj} {num}",
            "title": title, "grade": None, "credits": None,
            "term": current_term["term"], "year": current_term["year"],
            "status": "planned", "sourceType": "term",
        })

    # ── Sort: transfers first, then chronologically ───────────────────────────
    _tord = {"Spring": 0, "Summer": 1, "Fall": 2, "Winter": 3}
    courses.sort(key=lambda c: (
        0 if c.get("sourceType") == "transfer" else 1,
        c["year"] if c["year"] is not None else 9999,
        _tord.get(c["term"] or "", 9),
        c["code"],
    ))

    return {"student_name": student_name, "gpa": best_gpa, "courses": courses}
