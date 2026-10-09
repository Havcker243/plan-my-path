"""Source-grounded partial academic audit with synthetic records; never degree clearance."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / "docs/research/fisk-catalog-rules.json"
POINTS = {"A": 4, "A-": 3.7, "B+": 3.3, "B": 3, "B-": 2.7, "C+": 2.3, "C": 2, "C-": 1.7, "D+": 1.3, "D": 1, "F": 0}


def audit(records: list[dict], rules: dict) -> dict:
    expected = {**rules["major_required"]["courses"], **rules["cognates"]["courses"]}
    seen, earned, quality, gpa_credits, failures, invalid, missing = set(), 0, 0, 0, [], [], []
    complete = {}
    for row in records:
        code, credits, grade = row["code"], row["credits"], row["grade"]
        if code in seen:
            invalid.append(f"Duplicate course {code}; repeat-credit policy not inferred")
            continue
        seen.add(code)
        if not isinstance(credits, (int, float)) or isinstance(credits, bool) or credits <= 0 or credits > 6:
            invalid.append(f"Invalid course credits for {code}")
            continue
        if code in expected and credits != expected[code]:
            invalid.append(f"Credit mismatch for {code}: record {credits}, catalog {expected[code]}")
            continue
        if grade not in POINTS:
            invalid.append(f"Unmodeled grade {grade} for {code}; review required")
            continue
        points = POINTS[grade]
        if points >= 1:
            earned += credits
        if row.get("institution") == "Fisk":
            quality += points * credits
            gpa_credits += credits
        complete[code] = points
    for code in expected:
        if code not in complete:
            missing.append(code)
        elif complete[code] < 2:
            failures.append(f"{code} below C")
    gpa = quality / gpa_credits if gpa_credits else None
    if earned < rules["degree_rules"]["total_credits_min"]:
        failures.append("Fewer than 120 earned credits")
    if gpa is None or gpa < rules["degree_rules"]["fisk_cumulative_gpa_min"]:
        failures.append("Fisk cumulative GPA below 2.0 or unavailable")
    if missing:
        failures.append("Known required coursework is missing")
    return {"status": "invalid_record" if invalid else "requirements_not_met" if failures else "manual_review_required",
            "degree_cleared": False, "earned_credits": earned, "fisk_gpa": round(gpa, 4) if gpa is not None else None,
            "gpa_credits": gpa_credits, "quality_points": quality, "missing_known_courses": missing,
            "failed_known_rules": failures, "invalid_records": invalid,
            "unverified_scope": rules["unresolved"] + ["Synthetic elective credits are transcript assumptions, not verified CORE, elective, residency or language satisfaction."]}


def fixtures(rules: dict) -> dict[str, list[dict]]:
    known = {**rules["major_required"]["courses"], **rules["cognates"]["courses"]}
    base = [{"code": code, "credits": credits, "grade": "B", "institution": "Fisk"} for code, credits in known.items()]
    base.append({"code": "CSCI 282L", "credits": 1, "grade": "B", "institution": "Fisk", "note": "Candidate identifier, unresolved catalog ambiguity"})
    base += [{"code": f"SYNTHETIC ELECTIVE {i:02}", "credits": 3, "grade": "B", "institution": "Fisk"} for i in range(22)]
    from copy import deepcopy
    low_grade = deepcopy(base)
    next(r for r in low_grade if r["code"] == "CSCI 241")["grade"] = "D"
    return {"known_rules_met_review_still_required": base,
            "missing_required_course": [r for r in base if r["code"] != "CSCI 241"],
            "major_grade_below_C": low_grade,
            "duplicate_credit_attempt": base + [dict(base[0])]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    rules = json.loads(RULES.read_text())
    record = {"synthetic_records": True, "catalog_edition": rules["edition"],
              "rules_sha256": hashlib.sha256(RULES.read_bytes()).hexdigest(),
              "scope": rules["scope"], "cases": []}
    for name, student in fixtures(rules).items():
        record["cases"].append({"case": name, "student": student, "result": audit(student, rules)})
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise FileExistsError("Preserve existing evidence; choose a new output path")
    target.write_text(json.dumps(record, indent=2), encoding="utf-8")
    print([(c["case"], c["result"]["status"], c["result"]["earned_credits"]) for c in record["cases"]])


if __name__ == "__main__":
    main()
