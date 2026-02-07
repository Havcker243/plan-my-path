#!/usr/bin/env python3
"""
Lightweight course scraper for public Ellucian Colleague course search pages.

Usage examples:
  python scripts/scrape_courses.py --subject CSCI --out data/courses_csrc.json
  python scripts/scrape_courses.py --subject CSCI --api-url "https://.../api/..." --api-param subjects
  python scripts/scrape_courses.py --subject CSCI --api-url "https://.../PostSearchCriteria" --api-method post --payload payload.json --out data/courses_csci.json

Notes:
- Many Colleague pages load results via XHR after page load. If no data is
  embedded in the HTML, provide --api-url (found via browser devtools).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests
from bs4 import BeautifulSoup

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except Exception:  # pragma: no cover - optional dependency
    webdriver = None


DEFAULT_URL = (
    "https://fisk-ss.colleague.elluciancloud.com/student/Courses/Search"
)


def fetch_html(url: str, subject: str) -> str:
    params = {"subjects": subject}
    headers = {
        "User-Agent": "DegreePlannerScraper/1.0 (+https://example.local)",
        "Accept": "text/html,application/xhtml+xml",
    }
    session = requests.Session()
    # Ignore proxy-related env vars (HTTP_PROXY/HTTPS_PROXY) for direct scraping.
    session.trust_env = False
    resp = session.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text


def fetch_html_selenium(url: str, subject: str, wait_selector: str, timeout: int) -> str:
    if webdriver is None:
        raise RuntimeError("selenium is not installed. Run: pip install selenium")

    target_url = f"{url}?subjects={subject}"
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1400,900")

    driver = webdriver.Chrome(options=options)
    try:
        driver.get(target_url)
        if wait_selector:
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector))
            )
        return driver.page_source
    finally:
        driver.quit()


def fetch_api_json(api_url: str, subject: str, api_param: str) -> Any:
    headers = {
        "User-Agent": "DegreePlannerScraper/1.0 (+https://example.local)",
        "Accept": "application/json",
    }
    session = requests.Session()
    # Ignore proxy-related env vars (HTTP_PROXY/HTTPS_PROXY) for direct scraping.
    session.trust_env = False
    resp = session.get(api_url, params={api_param: subject}, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def requests_session_with_retries(retries: int = 3, backoff: float = 0.5) -> requests.Session:
    session = requests.Session()
    # Ignore proxy-related env vars (HTTP_PROXY/HTTPS_PROXY) for direct scraping.
    session.trust_env = False
    from requests.adapters import HTTPAdapter
    from requests.packages.urllib3.util.retry import Retry

    retry = Retry(
        total=retries,
        backoff_factor=backoff,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers.update(
        {
            "User-Agent": "DegreePlannerScraper/1.0 (+https://example.local)",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        }
    )
    return session


def fetch_csrf_token(session: requests.Session, url: str, subject: str) -> str:
    headers = {
        "User-Agent": "DegreePlannerScraper/1.0 (+https://example.local)",
        "Accept": "text/html,application/xhtml+xml",
    }
    original_headers = dict(session.headers)
    try:
        session.headers.clear()
        resp = session.get(url, params={"subjects": subject}, headers=headers, timeout=30)
        if resp.status_code >= 400:
            resp = session.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    finally:
        session.headers.clear()
        session.headers.update(original_headers)
    soup = BeautifulSoup(resp.text, "html.parser")
    token_el = soup.find("input", {"name": "__RequestVerificationToken"})
    if not token_el or not token_el.get("value"):
        raise RuntimeError("Could not find __RequestVerificationToken in CSRF page.")
    return token_el["value"]


def load_payload(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def post_page(session: requests.Session, api_url: str, payload: Dict[str, Any]) -> Any:
    resp = session.post(api_url, json=payload, timeout=30)
    if resp.status_code >= 400:
        body = resp.text
        if len(body) > 2000:
            body = body[:2000] + "...(truncated)"
        raise RuntimeError(
            f"POST failed: {resp.status_code} {resp.reason}. "
            f"Response body (truncated): {body}"
        )
    content_type = resp.headers.get("Content-Type", "")
    if "application/json" in content_type or "text/json" in content_type:
        return resp.json()
    try:
        return resp.json()
    except ValueError as exc:
        raise RuntimeError(
            "POST returned non-JSON (likely a login page). Check auth/cookies."
        ) from exc


def collect_all_courses(
    api_url: str,
    payload: Dict[str, Any],
    sleep_between_pages: float,
    csrf_url: Optional[str],
    subject: str,
) -> List[Dict[str, Any]]:
    session = requests_session_with_retries()
    if csrf_url:
        token = fetch_csrf_token(session, csrf_url, subject)
        session.headers.update(
            {
                "__RequestVerificationToken": token,
                "RequestVerificationToken": token,
                "Referer": csrf_url,
            }
        )
        payload.setdefault("__RequestVerificationToken", token)
    page = int(payload.get("pageNumber", 1))
    per_page = int(payload.get("quantityPerPage", 100))
    all_items: List[Dict[str, Any]] = []

    while True:
        payload["pageNumber"] = page
        print(f"Requesting page {page} (size {per_page})...")
        data = post_page(session, api_url, payload)

        results = None
        for key in ("Items", "Results", "Data", "courses", "Courses", "results", "items"):
            if isinstance(data, dict) and key in data:
                results = data[key]
                break
        if results is None and isinstance(data, list):
            results = data

        if not results:
            print("No results on this page; stopping.")
            break

        for raw_item in iter_course_like_objects(results):
            all_items.append(normalize_course(raw_item))

        if isinstance(results, list) and len(results) < per_page:
            print("Last page reached.")
            break

        page += 1
        time.sleep(sleep_between_pages)

    return all_items


def _extract_json_candidates(text: str) -> List[str]:
    candidates: List[str] = []
    # Common patterns where JSON is embedded in a script tag.
    patterns = [
        r"__INITIAL_STATE__\s*=\s*({.*?})\s*;",
        r"window\.__INITIAL_STATE__\s*=\s*({.*?})\s*;",
        r"var\s+course.*?=\s*({.*?})\s*;",
        r"var\s+course.*?=\s*(\[.*?\])\s*;",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.DOTALL):
            candidates.append(match.group(1))
    return candidates


def extract_embedded_json(html: str) -> Optional[Any]:
    soup = BeautifulSoup(html, "html.parser")
    # Look for <script type="application/json">
    for script in soup.find_all("script"):
        script_type = (script.get("type") or "").strip().lower()
        if script_type == "application/json":
            try:
                return json.loads(script.string or "")
            except json.JSONDecodeError:
                pass

    # Fallback: regex-based extraction
    candidates = _extract_json_candidates(html)
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def iter_course_like_objects(payload: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
        return

    if isinstance(payload, dict):
        # Try common nested keys
        for key in ["Courses", "courses", "Items", "items", "Results", "results", "Data", "data"]:
            if key in payload:
                nested = payload[key]
                for item in iter_course_like_objects(nested):
                    yield item
        return


def normalize_course(raw: Dict[str, Any]) -> Dict[str, Any]:
    def pick(*keys: str) -> Optional[Any]:
        for key in keys:
            if key in raw and raw[key] not in (None, ""):
                return raw[key]
        return None

    subject = pick("Subject", "SubjectCode", "subject")
    number = pick("Number", "CourseNumber", "number")
    code = pick("Course", "CourseCode", "Code", "code")
    title = pick("Title", "CourseTitle", "Name", "title")
    credits = pick("Credits", "CreditHours", "credits")
    min_credits = pick("MinCredits", "MinCreditHours", "minCredits")
    max_credits = pick("MaxCredits", "MaxCreditHours", "maxCredits")
    description = pick("Description", "CourseDescription", "description")
    prerequisites = pick("Prerequisites", "Requisites", "prerequisites")
    offered_terms = pick("Terms", "OfferedTerms", "offeredTerms")
    location_codes = pick("LocationCodes", "locationCodes", "Locations", "locations")

    if not code and subject and number:
        code = f"{subject}-{number}"

    return {
        "subject": subject,
        "number": number,
        "code": code,
        "title": title,
        "credits": credits,
        "min_credits": min_credits,
        "max_credits": max_credits,
        "description": description,
        "prerequisites": prerequisites,
        "offered_terms": offered_terms,
        "location_codes": location_codes,
        "raw": raw,
    }


def clean_course(course: Dict[str, Any]) -> Dict[str, Any]:
    allowed_keys = [
        "subject",
        "number",
        "code",
        "title",
        "credits",
        "min_credits",
        "max_credits",
        "description",
        "prerequisites",
        "offered_terms",
        "location_codes",
    ]
    cleaned: Dict[str, Any] = {key: course.get(key) for key in allowed_keys}
    return {key: value for key, value in cleaned.items() if value not in (None, "", [])}


def extract_courses_from_html(html: str) -> List[Dict[str, Any]]:
    payload = extract_embedded_json(html)
    if payload is None:
        return []

    courses = []
    for item in iter_course_like_objects(payload):
        courses.append(normalize_course(item))
    return courses


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape public course data to JSON.")
    parser.add_argument("--subject", required=True, help="Subject code, e.g. CSCI")
    parser.add_argument("--out", required=True, help="Output JSON file path")
    parser.add_argument("--url", default=DEFAULT_URL, help="Course search page URL")
    parser.add_argument("--api-url", default=None, help="Optional API URL for JSON")
    parser.add_argument(
        "--api-method",
        choices=["get", "post"],
        default="get",
        help="API method to use when --api-url is provided",
    )
    parser.add_argument("--api-param", default="subjects", help="Query param name for subject")
    parser.add_argument(
        "--payload",
        default=None,
        help="JSON payload file to POST for API endpoints",
    )
    parser.add_argument(
        "--csrf-url",
        default=None,
        help="Optional URL to fetch anti-forgery token before POSTing",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.5,
        help="Seconds to sleep between paginated API requests",
    )
    parser.add_argument("--save-html", default=None, help="Optional path to save raw HTML")
    parser.add_argument("--use-selenium", action="store_true", help="Use Selenium to render page")
    parser.add_argument("--wait-selector", default="", help="CSS selector to wait for before scraping")
    parser.add_argument("--wait-timeout", type=int, default=20, help="Seconds to wait for selector")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Write student-facing fields only (omit raw payload and nulls)",
    )
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    courses: List[Dict[str, Any]] = []

    if args.api_url:
        if args.api_method == "post" or args.payload:
            if not args.payload:
                raise SystemExit("--payload is required when using --api-method post")
            payload = load_payload(args.payload)
            if args.subject:
                if "subjects" in payload:
                    payload["subjects"] = [args.subject]
                else:
                    payload.setdefault("subjects", [args.subject])
            csrf_url = args.csrf_url or args.url
            courses = collect_all_courses(
                args.api_url, payload, args.sleep, csrf_url, args.subject
            )
        else:
            payload = fetch_api_json(args.api_url, args.subject, args.api_param)
            for item in iter_course_like_objects(payload):
                courses.append(normalize_course(item))
    else:
        if args.use_selenium:
            html = fetch_html_selenium(args.url, args.subject, args.wait_selector, args.wait_timeout)
        else:
            html = fetch_html(args.url, args.subject)
        if args.save_html:
            Path(args.save_html).write_text(html, encoding="utf-8")
        courses = extract_courses_from_html(html)

    if not courses:
        print(
            "No courses found in HTML. Provide --api-url (from browser devtools XHR) "
            "or use --save-html to inspect the page source.",
            file=sys.stderr,
        )

    output_courses = [clean_course(course) for course in courses] if args.clean else courses
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(output_courses, f, indent=2, ensure_ascii=True)

    print(f"Wrote {len(output_courses)} courses to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
