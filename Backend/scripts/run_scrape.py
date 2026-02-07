#!/usr/bin/env python3
"""
Run course scrapes for a list of subjects defined in scripts/courses.txt.

Outputs one file per subject (txt/json), named after the course label.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple, Optional, Set
from urllib.parse import urlparse, parse_qs

from scrape_courses import clean_course, collect_all_courses, load_payload

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import SessionNotCreatedException, WebDriverException
    from webdriver_manager.chrome import ChromeDriverManager
except Exception:  # pragma: no cover - optional dependency
    webdriver = None


def parse_courses_file(path: Path, only_subject: str | None = None) -> List[Tuple[str, str, str]]:
    items: List[Tuple[str, str, str]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if ":" not in line:
            continue
        name, url = [part.strip() for part in line.split(":", 1)]
        if not url:
            continue
        subject = extract_subject_from_url(url)
        if not subject:
            continue
        if only_subject and subject != only_subject:
            continue
        items.append((name, url, subject))
    return items


def extract_subject_from_url(url: str) -> str:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    subjects = qs.get("subjects") or qs.get("subject")
    if subjects:
        return subjects[0].strip().upper()
    return ""


def slugify_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")
    return slug or "course"


def courses_to_text(
    courses: List[Dict[str, object]],
    sections_by_course: Optional[Dict[str, List[str]]] = None,
) -> str:
    blocks: List[str] = []
    for course in courses:
        code = course.get("code") or ""
        title = course.get("title") or ""
        credits = course.get("credits") or course.get("min_credits") or course.get("max_credits") or ""
        header = f"{code} - {title}".strip(" -")
        if credits:
            header = f"{header} ({credits} credits)"
        parts = [header]
        description = course.get("description")
        if description:
            parts.append(str(description).strip())
        requisites_text = course.get("requisites_text")
        if isinstance(requisites_text, list) and requisites_text:
            parts.append("Requisites:")
            parts.extend([f"{line}" for line in requisites_text])
        else:
            prerequisites = course.get("prerequisites")
            if prerequisites:
                parts.append(f"Requisites: {prerequisites}")
        offered_terms = course.get("offered_terms")
        if offered_terms:
            parts.append(f"Offered terms: {offered_terms}")
        locations_text = course.get("locations_text")
        if isinstance(locations_text, list) and locations_text:
            parts.append("Locations:")
            parts.extend([f"{line}" for line in locations_text])
        else:
            location_codes = course.get("location_codes") or course.get("locations")
            if not location_codes and isinstance(course.get("raw"), dict):
                location_codes = course["raw"].get("LocationCodes")
            if location_codes:
                parts.append(f"Locations: {location_codes}")
        if sections_by_course and code in sections_by_course:
            sections = []
            for raw_text in sections_by_course.get(code, []):
                sections.extend(parse_sections_text(raw_text, code))
            sections_text = sections_to_text(sections)
            if sections_text:
                parts.append("Sections:")
                parts.append(sections_text.strip())
        blocks.append("\n".join(parts).strip())
    return "\n\n".join(block for block in blocks if block)


def build_api_url(search_url: str) -> str:
    parsed = urlparse(search_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return f"{base}/student/Courses/PostSearchCriteria"


def extract_label_block(lines: List[str], label: str, stop_labels: Set[str]) -> List[str]:
    collected: List[str] = []
    label_lower = label.lower()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.lower().startswith(label_lower):
            # Consume the label line itself; if it has trailing content, keep it.
            trailing = line[len(label) :].strip()
            if trailing:
                collected.append(trailing)
            i += 1
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line:
                    i += 1
                    continue
                lower = next_line.lower()
                if lower.startswith("view available sections") or lower.startswith(
                    "hide available sections"
                ):
                    break
                if lower.endswith(":") and lower.rstrip(":") in stop_labels:
                    break
                collected.append(next_line)
                i += 1
            break
        i += 1
    return collected


def detect_sections_presence_selenium(
    search_url: str,
    subject: str,
    timeout: int = 25,
    debug_dir: Optional[Path] = None,
    chromedriver_path: Optional[str] = None,
) -> Tuple[Set[str], int, Dict[str, Dict[str, List[str]]]]:
    if webdriver is None:
        raise RuntimeError("selenium is not installed. Run: pip install selenium")

    params = f"?subjects={subject}"
    target_url = search_url if "?" in search_url else f"{search_url}{params}"

    driver_path = chromedriver_path or shutil.which("chromedriver")
    if driver_path:
        service = Service(executable_path=driver_path)
    elif ChromeDriverManager is not None:
        # Fallback requires internet access to download a matching driver.
        service = Service(ChromeDriverManager().install())
    else:
        raise RuntimeError("ChromeDriver not found. Set --chromedriver or add to PATH.")

    chrome_binary = os.environ.get("CHROME_BINARY")
    if not chrome_binary:
        default_chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        chrome_binary = str(default_chrome) if default_chrome.exists() else None

    profile_root = (Path.cwd() / "data" / ".chrome_profile").resolve()
    profile_dir = (profile_root / uuid.uuid4().hex).resolve()
    profile_dir.mkdir(parents=True, exist_ok=True)

    driver = None
    attempts = [
        ("headless_new", True, True),
        ("headless_legacy", True, False),
        ("headed", False, False),
    ]
    last_exc: Optional[Exception] = None
    for _label, headless, use_new_headless in attempts:
        options = ChromeOptions()
        if headless:
            options.add_argument("--headless=new" if use_new_headless else "--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--window-size=1400,900")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--remote-debugging-port=0")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--disable-background-networking")
        options.add_argument("--disable-backgrounding-occluded-windows")
        options.add_argument("--disable-sync")
        options.add_argument("--metrics-recording-only")
        options.add_argument("--mute-audio")
        options.add_argument("--disable-features=RendererCodeIntegrity,VizDisplayCompositor,Crashpad")
        options.add_argument("--disable-crash-reporter")
        options.add_argument("--no-service-autorun")
        options.add_argument("--disable-component-update")
        options.add_argument("--disable-background-timer-throttling")
        options.add_argument("--disable-renderer-backgrounding")
        options.add_argument("--disable-ipc-flooding-protection")
        options.add_argument("--remote-debugging-pipe")
        options.add_argument("--remote-allow-origins=*")
        options.add_argument(f"--user-data-dir={profile_dir}")
        if chrome_binary:
            options.binary_location = chrome_binary
        try:
            driver = webdriver.Chrome(service=service, options=options)
            break
        except (SessionNotCreatedException, WebDriverException) as exc:
            last_exc = exc
            continue

    if driver is None:
        shutil.rmtree(profile_dir, ignore_errors=True)
        raise last_exc or RuntimeError("Chrome failed to start.")

    codes_with_sections: Set[str] = set()
    total_buttons = 0
    details_by_course: Dict[str, Dict[str, List[str]]] = {}
    try:
        driver.get(target_url)
        try:
            WebDriverWait(driver, timeout).until(
                EC.any_of(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "#course-results")),
                    EC.presence_of_element_located((By.CSS_SELECTOR, "#course-resultul")),
                    EC.presence_of_element_located(
                        (By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]")
                    ),
                    EC.presence_of_element_located(
                        (By.XPATH, "//*[contains(normalize-space(.), 'No results')]")
                    ),
                )
            )
        except Exception:
            try:
                search_btn = driver.find_element(
                    By.CSS_SELECTOR,
                    "form#search-form button[type='submit'], form#search-form input[type='submit'], button#search-button",
                )
                driver.execute_script("arguments[0].click();", search_btn)
            except Exception:
                pass
            try:
                WebDriverWait(driver, timeout).until(
                    EC.any_of(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "#course-results")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, "#course-resultul")),
                        EC.presence_of_element_located(
                            (By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]")
                        ),
                        EC.presence_of_element_located(
                            (By.XPATH, "//*[contains(normalize-space(.), 'No results')]")
                        ),
                    )
                )
            except Exception:
                if debug_dir:
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    html_path = debug_dir / f"selenium_{subject.lower()}_presence_page.html"
                    png_path = debug_dir / f"selenium_{subject.lower()}_presence_page.png"
                    html_path.write_text(driver.page_source, encoding="utf-8")
                    try:
                        driver.save_screenshot(str(png_path))
                    except Exception:
                        pass
                # Don't fail hard if the page loads but has no section buttons.

        view_buttons = driver.find_elements(
            By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]"
        )
        total_buttons = len(view_buttons)
        stop_labels = {
            "requisites",
            "prerequisites",
            "locations",
            "location",
            "offered terms",
            "credits",
            "sections",
            "section",
        }
        for btn in view_buttons:
            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                container = driver.execute_script(
                    """
                    let el = arguments[0];
                    while (el && el.parentElement) {
                        const cls = (el.className || '').toString();
                        if (/(course|result|esg|panel|card)/i.test(cls)) {
                            return el;
                        }
                        el = el.parentElement;
                    }
                    return arguments[0];
                    """,
                    btn,
                )
                text = container.text if container else ""
                if not text:
                    continue
                match = re.search(rf"{re.escape(subject)}\\s*-?\\s*(\\d{{3}}[A-Z]?)", text)
                if not match:
                    continue
                base_code = f"{subject}-{match.group(1)}"
                codes_with_sections.add(base_code)

                lines = [normalize_line(line) for line in text.splitlines() if line.strip()]
                if base_code not in details_by_course:
                    details_by_course[base_code] = {"requisites": [], "locations": []}
                requisites = extract_label_block(lines, "Requisites:", stop_labels)
                if not requisites:
                    requisites = extract_label_block(lines, "Prerequisites:", stop_labels)
                if requisites:
                    details_by_course[base_code]["requisites"] = requisites
                locations = extract_label_block(lines, "Locations:", stop_labels)
                if not locations:
                    locations = extract_label_block(lines, "Location:", stop_labels)
                if locations:
                    details_by_course[base_code]["locations"] = locations
            except Exception:
                continue

        # Best-effort: parse course cards even if they do NOT have section buttons.
        try:
            candidate_texts = driver.execute_script(
                """
                const results = [];
                const seen = new Set();
                const nodes = document.querySelectorAll('[class]');
                for (const el of nodes) {
                  const cls = (el.className || '').toString();
                  if (!/(course|result|esg|panel|card)/i.test(cls)) continue;
                  const text = (el.innerText || '').trim();
                  if (!text || text.length < 40) continue;
                  if (seen.has(text)) continue;
                  seen.add(text);
                  results.push(text);
                }
                return results;
                """
            )
        except Exception:
            candidate_texts = []

        for text in candidate_texts or []:
            match = re.search(rf"{re.escape(subject)}\\s*-?\\s*(\\d{{3}}[A-Z]?)", text)
            if not match:
                continue
            base_code = f"{subject}-{match.group(1)}"
            lines = [normalize_line(line) for line in text.splitlines() if line.strip()]
            if base_code not in details_by_course:
                details_by_course[base_code] = {"requisites": [], "locations": []}
            requisites = extract_label_block(lines, "Requisites:", stop_labels)
            if not requisites:
                requisites = extract_label_block(lines, "Prerequisites:", stop_labels)
            if requisites:
                details_by_course[base_code]["requisites"] = requisites
            locations = extract_label_block(lines, "Locations:", stop_labels)
            if not locations:
                locations = extract_label_block(lines, "Location:", stop_labels)
            if locations:
                details_by_course[base_code]["locations"] = locations
    finally:
        if driver is not None:
            driver.quit()
        shutil.rmtree(profile_dir, ignore_errors=True)

    return codes_with_sections, total_buttons, details_by_course


def scrape_sections_selenium(
    search_url: str,
    subject: str,
    timeout: int = 25,
    debug_dir: Optional[Path] = None,
    chromedriver_path: Optional[str] = None,
) -> Dict[str, List[str]]:
    if webdriver is None:
        raise RuntimeError("selenium is not installed. Run: pip install selenium")

    params = f"?subjects={subject}"
    target_url = search_url if "?" in search_url else f"{search_url}{params}"

    driver_path = chromedriver_path or shutil.which("chromedriver")
    if driver_path:
        service = Service(executable_path=driver_path)
    elif ChromeDriverManager is not None:
        # Fallback requires internet access to download a matching driver.
        service = Service(ChromeDriverManager().install())
    else:
        raise RuntimeError("ChromeDriver not found. Set --chromedriver or add to PATH.")

    sections_by_course: Dict[str, List[str]] = {}

    chrome_binary = os.environ.get("CHROME_BINARY")
    if not chrome_binary:
        default_chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        chrome_binary = str(default_chrome) if default_chrome.exists() else None

    profile_root = (Path.cwd() / "data" / ".chrome_profile").resolve()
    profile_dir = (profile_root / uuid.uuid4().hex).resolve()
    profile_dir.mkdir(parents=True, exist_ok=True)

    driver = None
    attempts = [
        ("headless_new", True, True),
        ("headless_legacy", True, False),
        ("headed", False, False),
    ]
    last_exc: Optional[Exception] = None
    for _label, headless, use_new_headless in attempts:
        options = ChromeOptions()
        if headless:
            options.add_argument("--headless=new" if use_new_headless else "--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--window-size=1400,900")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--remote-debugging-port=0")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--disable-background-networking")
        options.add_argument("--disable-backgrounding-occluded-windows")
        options.add_argument("--disable-sync")
        options.add_argument("--metrics-recording-only")
        options.add_argument("--mute-audio")
        options.add_argument("--disable-features=RendererCodeIntegrity,VizDisplayCompositor,Crashpad")
        options.add_argument("--disable-crash-reporter")
        options.add_argument("--no-service-autorun")
        options.add_argument("--disable-component-update")
        options.add_argument("--disable-background-timer-throttling")
        options.add_argument("--disable-renderer-backgrounding")
        options.add_argument("--disable-ipc-flooding-protection")
        options.add_argument("--remote-debugging-pipe")
        options.add_argument("--remote-allow-origins=*")
        options.add_argument(f"--user-data-dir={profile_dir}")
        if chrome_binary:
            options.binary_location = chrome_binary
        try:
            driver = webdriver.Chrome(service=service, options=options)
            break
        except (SessionNotCreatedException, WebDriverException) as exc:
            last_exc = exc
            continue

    if driver is None:
        shutil.rmtree(profile_dir, ignore_errors=True)
        raise last_exc or RuntimeError("Chrome failed to start.")
    try:
        driver.get(target_url)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]")
                )
            )
        except Exception:
            try:
                search_btn = driver.find_element(
                    By.CSS_SELECTOR,
                    "form#search-form button[type='submit'], form#search-form input[type='submit'], button#search-button",
                )
                driver.execute_script("arguments[0].click();", search_btn)
            except Exception:
                pass
            try:
                WebDriverWait(driver, timeout).until(
                    EC.presence_of_element_located(
                        (By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]")
                    )
                )
            except Exception as exc:
                if debug_dir:
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    html_path = debug_dir / f"selenium_{subject.lower()}_page.html"
                    png_path = debug_dir / f"selenium_{subject.lower()}_page.png"
                    html_path.write_text(driver.page_source, encoding="utf-8")
                    try:
                        driver.save_screenshot(str(png_path))
                    except Exception:
                        pass
                raise exc
        view_buttons = driver.find_elements(
            By.XPATH, "//*[contains(normalize-space(.), 'View Available Sections')]"
        )
        for btn in view_buttons:
            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                container = driver.execute_script(
                    """
                    let el = arguments[0];
                    while (el && el.parentElement) {
                        const cls = (el.className || '').toString();
                        if (/(course|result|esg|panel|card)/i.test(cls)) {
                            return el;
                        }
                        el = el.parentElement;
                    }
                    return arguments[0];
                    """,
                    btn,
                )
                before_text = container.text if container else ""
                expanded = btn.get_attribute("aria-expanded") == "true"
                if not expanded:
                    try:
                        driver.execute_script("arguments[0].click();", btn)
                    except Exception:
                        btn.click()
                try:
                    WebDriverWait(driver, timeout).until(
                        lambda d: (
                            (btn.get_attribute("aria-expanded") == "true")
                            or (
                                container
                                and container.text
                                and container.text != before_text
                                and any(
                                    marker in container.text
                                    for marker in (
                                        "Seats",
                                        "Times",
                                        "Locations",
                                        "Instructors",
                                        "Fall",
                                        "Spring",
                                        "Summer",
                                        "Winter",
                                    )
                                )
                            )
                        )
                    )
                except Exception:
                    # Best-effort: continue with whatever the DOM contains.
                    pass
            except Exception:
                continue

            text = container.text if container else ""
            if not text:
                continue

            # Extract base course code like CSCI-100
            match = re.search(rf"{re.escape(subject)}\\s*-?\\s*(\\d{{3}}[A-Z]?)", text)
            if not match:
                continue
            base_code = f"{subject}-{match.group(1)}"
            sections_by_course.setdefault(base_code, [])

            # Attempt to isolate the section list portion
            split_markers = ["View Available Sections", "Hide Available Sections"]
            for marker in split_markers:
                if marker in text:
                    text = text.rsplit(marker, 1)[-1].strip()
                    break
            sections_by_course[base_code].append(text.strip())
    finally:
        if driver is not None:
            driver.quit()
        shutil.rmtree(profile_dir, ignore_errors=True)

    return sections_by_course


def normalize_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_term_line(text: str) -> bool:
    return bool(re.fullmatch(r"(Spring|Summer|Fall|Winter)\s+\d{4}", text))


def classify_detail_line(text: str) -> str:
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b\s*-\s*\d{1,2}/\d{1,2}/\d{4}\b", text):
        return "Dates"
    if re.search(r"\b(AM|PM)\b", text, re.IGNORECASE):
        return "Time"
    if re.search(r"\bTBD\b", text, re.IGNORECASE):
        return "Time"
    if re.search(r"\b(M|T|W|Th|F|Sa|Su)(/|$)", text):
        return "Time"
    if re.search(r"\bCampus\b", text, re.IGNORECASE) or re.search(r"\bONLINE\b", text):
        return "Location"
    if text.lower() in {"lecture", "lab", "seminar", "studio", "independent study"}:
        return "Type"
    if "(" in text and ")" in text and len(text) <= 80:
        return "Instructor"
    return "Detail"


def parse_sections_text(text: str, base_code: str) -> List[Dict[str, object]]:
    lines = [normalize_line(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    sections: List[Dict[str, object]] = []
    current_term = ""
    current_section: Optional[Dict[str, object]] = None
    seats_header = False

    for line in lines:
        if is_term_line(line):
            current_term = line
            continue
        if "view available sections" in line.lower():
            continue
        if "hide available sections" in line.lower():
            continue

        code_match = re.search(rf"\b{re.escape(base_code)}-[A-Z0-9]+\b", line)
        if code_match:
            code = code_match.group(0)
            title = normalize_line(line.replace(code, "", 1).strip(" -"))
            if current_section:
                sections.append(current_section)
            current_section = {
                "code": code,
                "title": title,
                "term": current_term,
                "details": [],
            }
            continue

        if current_section is None:
            continue

        if line == current_section["code"]:
            continue

        if seats_header:
            current_section["details"].append(("Seats", line))
            seats_header = False
            continue

        if "Seats" in line and "Times" in line and "Locations" in line:
            seats_header = True
            continue

        label = classify_detail_line(line)
        current_section["details"].append((label, line))

    if current_section:
        sections.append(current_section)

    return sections


def sections_to_text(sections: List[Dict[str, object]]) -> str:
    blocks: List[str] = []
    for section in sections:
        code = section.get("code", "")
        title = section.get("title", "")
        term = section.get("term", "")
        header = f"{code} — {title}".strip(" —")
        lines = [header]
        if term:
            lines.append(f"Term: {term}")
        for label, value in section.get("details", []):
            if label == "Detail":
                lines.append(str(value))
            else:
                lines.append(f"{label}: {value}")
        blocks.append("\n".join(lines).strip())
    return "\n\n".join(blocks)


def run_scrape(
    name: str,
    search_url: str,
    subject: str,
    payload_path: Path,
    out_dir: Path,
    clean: bool,
    fmt: str,
    with_sections: bool,
    presence_only: bool,
    chromedriver_path: Optional[str],
) -> List[Dict[str, object]]:
    payload = load_payload(str(payload_path))
    payload["subjects"] = [subject]

    api_url = build_api_url(search_url)
    csrf_url = search_url.split("?", 1)[0]

    courses = collect_all_courses(api_url, payload, 0.5, csrf_url, subject)
    if clean:
        courses = [clean_course(course) for course in courses]

    filename_base = f"{slugify_name(name)}_{subject.lower()}"

    sections_by_course = None
    codes_with_sections: Set[str] = set()
    if with_sections or presence_only:
        codes_with_sections, total_buttons, details_by_course = detect_sections_presence_selenium(
            csrf_url, subject, debug_dir=out_dir, chromedriver_path=chromedriver_path
        )
        for course in courses:
            code = course.get("code")
            if not code:
                continue
            details = details_by_course.get(code)
            if not details:
                continue
            if details.get("requisites"):
                course["requisites_text"] = details["requisites"]
            if details.get("locations"):
                course["locations_text"] = details["locations"]
        audit_path = out_dir / f"{filename_base}_sections_presence.json"
        audit_path.write_text(
            json.dumps(
                {
                    "label": name,
                    "subject": subject,
                    "search_url": csrf_url,
                    "total_buttons": total_buttons,
                    "count_courses_with_sections": len(codes_with_sections),
                    "courses_with_sections": sorted(codes_with_sections),
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                },
                indent=2,
                ensure_ascii=True,
            ),
            encoding="utf-8",
        )
        if with_sections and not presence_only:
            sections_by_course = scrape_sections_selenium(
                csrf_url, subject, debug_dir=out_dir, chromedriver_path=chromedriver_path
            )

    if with_sections or presence_only:
        for course in courses:
            code = course.get("code")
            if not code:
                continue
            has_sections = code in codes_with_sections
            sections: List[Dict[str, object]] = []
            if sections_by_course and code in sections_by_course:
                for raw_text in sections_by_course.get(code, []):
                    sections.extend(parse_sections_text(raw_text, code))
                has_sections = has_sections or bool(sections)
            course["has_sections"] = has_sections
            if sections:
                course["sections"] = sections

    if fmt in ("json", "both"):
        out_path = out_dir / f"{filename_base}.json"
        out_path.write_text(json.dumps(courses, indent=2, ensure_ascii=True), encoding="utf-8")

    if fmt in ("txt", "both"):
        out_path = out_dir / f"{filename_base}.txt"
        out_path.write_text(courses_to_text(courses, sections_by_course), encoding="utf-8")

    return courses


def main() -> int:
    parser = argparse.ArgumentParser(description="Run multi-subject course scrapes.")
    script_dir = Path(__file__).resolve().parent
    parser.add_argument("--courses-file", default=str(script_dir / "courses.txt"))
    parser.add_argument("--payload", default=str(script_dir.parent / "payload.json"))
    parser.add_argument("--out-dir", default="data")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--format", choices=["txt", "json", "both"], default="txt")
    parser.add_argument("--with-sections", action="store_true")
    parser.add_argument(
        "--sections-presence",
        action="store_true",
        help="Only detect which courses show 'View Available Sections' and write an audit JSON.",
    )
    parser.add_argument("--subject", default=None, help="Optional subject code filter, e.g. CSCI")
    parser.add_argument("--chromedriver", default=None, help="Path to chromedriver.exe")
    args = parser.parse_args()

    courses_file = Path(args.courses_file)
    payload_path = Path(args.payload)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    only_subject = args.subject.upper() if args.subject else None
    consolidated: List[Dict[str, object]] = []
    for name, url, subject in parse_courses_file(courses_file, only_subject):
        subject_courses = run_scrape(
            name,
            url,
            subject,
            payload_path,
            out_dir,
            args.clean,
            args.format,
            args.with_sections,
            args.sections_presence,
            args.chromedriver,
        )
        for course in subject_courses:
            course["subject_label"] = name
            course["subject_code"] = subject
            course["source_search_url"] = url.split("?", 1)[0]
        consolidated.extend(subject_courses)

    consolidated_path = out_dir / "course_library.json"
    consolidated_path.write_text(
        json.dumps(consolidated, indent=2, ensure_ascii=True), encoding="utf-8"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
