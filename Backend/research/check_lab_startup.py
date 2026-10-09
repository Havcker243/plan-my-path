"""HTTP startup check only; does not verify signed-in or visual browser behavior."""
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen


def main():
    checks = []
    for url, expected in [("http://127.0.0.1:3000/research", 200), ("http://127.0.0.1:8000/api/research/runs", 401)]:
        try:
            with urlopen(url, timeout=10) as response:
                actual = response.status
        except HTTPError as exc:
            actual = exc.code
        checks.append({"url": url, "status": actual, "expected": expected, "passed": actual == expected})
    result = {"checked_at_utc": datetime.now(timezone.utc).isoformat(), "checks": checks,
              "scope": "HTTP reachability and unauthenticated API protection only; not signed-in or visual browser verification"}
    output = Path(__file__).resolve().parents[2] / "docs/research/progress-report-1/evidence/site-startup-check-20261007.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(checks)
    if not all(row["passed"] for row in checks):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
