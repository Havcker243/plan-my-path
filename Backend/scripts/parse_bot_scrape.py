#!/usr/bin/env python3
"""
Fetch course data via the parse.bot scraper API and write course links to a txt file.

Examples:
  python scripts/parse_bot_scrape.py --subject CSCI --out scripts/course_links.txt
  python scripts/parse_bot_scrape.py --subject CSCI --mode all --out data/csci_all.json --format json
  python scripts/parse_bot_scrape.py --subject CSCI --course-url-template "https://example.edu/course/{course_code}"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


BASE_API = "https://api.parse.bot/scraper/ecb0bdcd-eab4-457e-9a6b-702a2da4a411"
ENDPOINTS = {
    "list": f"{BASE_API}/get_course_list",
    "details": f"{BASE_API}/get_course_details",
    "sections": f"{BASE_API}/get_available_sections",
    "all": f"{BASE_API}/get_all_courses_with_sections",
}


def load_env_file(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not path.exists():
        return env
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip("'").strip('"')
    return env


def resolve_api_key(env_path: Path, cli_key: Optional[str]) -> str:
    if cli_key:
        return cli_key
    env = load_env_file(env_path)
    for key in ("SCRAPPER_ENV_KEY", "PARSE_BOT_API_KEY", "X_API_KEY"):
        if key in os.environ and os.environ[key]:
            return os.environ[key]
        if key in env and env[key]:
            return env[key]
    raise RuntimeError(
        "API key not found. Set SCRAPPER_ENV_KEY in scripts/.env or pass --api-key."
    )


def request_json(url: str, params: Dict[str, str], api_key: str) -> Any:
    headers = {"X-API-Key": api_key}
    resp = requests.get(url, params=params, headers=headers, timeout=45)
    resp.raise_for_status()
    return resp.json()


def iter_course_like_items(payload: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
        return
    if isinstance(payload, dict):
        for key in ("courses", "Courses", "items", "Items", "results", "Results", "data", "Data"):
            if key in payload:
                nested = payload[key]
                for item in iter_course_like_items(nested):
                    yield item
                return
        if payload:
            yield payload


def normalize_course_item(item: Dict[str, Any]) -> Dict[str, Any]:
    def pick(*keys: str) -> Optional[str]:
        for key in keys:
            value = item.get(key)
            if value not in (None, ""):
                return str(value)
        return None

    return {
        "course_code": pick("course_code", "CourseCode", "code", "Code", "Course", "course"),
        "title": pick("title", "Title", "course_title", "CourseTitle", "name", "Name"),
        "url": pick("course_url", "CourseUrl", "url", "URL", "link", "Link", "course_link"),
        "raw": item,
    }


def extract_course_links(
    items: List[Dict[str, Any]],
    url_template: Optional[str],
    require_links: bool,
) -> Tuple[List[str], List[str]]:
    links: List[str] = []
    missing: List[str] = []
    for item in items:
        code = item.get("course_code") or ""
        url = item.get("url") or ""
        if not url and url_template and code:
            url = url_template.format(course_code=code)
        if url:
            links.append(url)
        elif code and not require_links:
            links.append(code)
        else:
            if code:
                missing.append(code)
    return links, missing


def write_output(path: Path, fmt: str, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "json":
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        return
    if isinstance(payload, list):
        path.write_text("\n".join(str(item) for item in payload), encoding="utf-8")
    else:
        path.write_text(str(payload), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse.bot course fetcher")
    parser.add_argument("--subject", required=True, help="Subject code, e.g. CSCI")
    parser.add_argument(
        "--mode",
        choices=["list", "details", "sections", "all"],
        default="list",
        help="API endpoint mode to use",
    )
    parser.add_argument("--course", help="Course code for details/sections, e.g. CSCI-100")
    parser.add_argument("--out", required=True, help="Output file path")
    parser.add_argument("--format", choices=["txt", "json"], default="txt")
    parser.add_argument("--api-key", default=None, help="Override API key")
    script_dir = Path(__file__).resolve().parent
    parser.add_argument(
        "--env-path",
        default=str(script_dir / ".env"),
        help="Path to .env containing SCRAPPER_ENV_KEY",
    )
    parser.add_argument(
        "--course-url-template",
        default=None,
        help="Optional URL template like https://example.edu/course/{course_code}",
    )
    parser.add_argument(
        "--require-links",
        action="store_true",
        help="Only write actual URLs; skip items without links",
    )
    args = parser.parse_args()

    api_key = resolve_api_key(Path(args.env_path), args.api_key)
    mode = args.mode
    endpoint = ENDPOINTS[mode]

    if mode in ("details", "sections") and not args.course:
        raise SystemExit("--course is required when using --mode details or --mode sections")

    if mode == "list":
        payload = request_json(endpoint, {"subject_code": args.subject}, api_key)
    elif mode == "all":
        payload = request_json(endpoint, {"subject_code": args.subject}, api_key)
    else:
        payload = request_json(endpoint, {"course_code": args.course}, api_key)

    if mode == "list":
        items = [normalize_course_item(item) for item in iter_course_like_items(payload)]
        links, missing = extract_course_links(items, args.course_url_template, args.require_links)
        if args.format == "json":
            write_output(Path(args.out), "json", items)
        else:
            write_output(Path(args.out), "txt", links)
        if missing:
            print(
                f"Warning: {len(missing)} items missing links. Example: {missing[0]}",
                file=sys.stderr,
            )
    else:
        write_output(Path(args.out), args.format, payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
