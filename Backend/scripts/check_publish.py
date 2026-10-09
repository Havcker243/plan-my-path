"""Read-only check of staged and candidate files. Prints names, never secret values.

Usage from repository root: python Backend/scripts/check_publish.py
This is a limited local check, not a complete secret/PII or history audit.
"""
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)

def secrets():
    found = {}
    for relative in ("Backend/.env", "web/.env", "web/.env.local", ".env"):
        path = ROOT / relative
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("\"'")
            if separator and re.search(r"SECRET|PASSWORD|SERVICE_ROLE|API_KEY|DATABASE_URL|POOLER_URL|ACCESS_TOKEN", key, re.I):
                if len(value) >= 12 and not re.search(r"your[-_ ]|example|placeholder|changeme|<.*>", value, re.I):
                    found[value.encode()] = key
    return found

def risky_path(name):
    p = Path(name)
    return ((p.name == ".env" or p.name.startswith(".env.")) and p.name != ".env.example") or p.suffix in {".pem", ".key", ".p12", ".pfx"} or any(part in {"private", "uploads", "logs", ".research-upstream", "node_modules", ".venv", ".next"} for part in p.parts)

def inspect(name, payload, version):
    findings = []
    if risky_path(name):
        findings.append({"file": name, "version": version, "reason": "private or generated path"})
    for value, label in known.items():
        if value in payload:
            findings.append({"file": name, "version": version, "reason": "matches local credential", "setting": label})
    patterns = [rb"AIza[0-9A-Za-z_-]{30,}", rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", rb"(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}", rb"sk-proj-[A-Za-z0-9_-]{25,}"]
    if any(re.search(pattern, payload) for pattern in patterns):
        findings.append({"file": name, "version": version, "reason": "credential-shaped content; review required"})
    if len(payload) > 100 * 1024 * 1024:
        findings.append({"file": name, "version": version, "reason": "over 100 MiB"})
    return findings

known = secrets()
names = set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").decode().split("\0")) - {""}
indexed = set(git("ls-files", "-z").decode().split("\0")) - {""}
findings = []
warnings = []
for name in sorted(names):
    path = ROOT / name
    if path.is_file():
        findings += inspect(name, path.read_bytes(), "working tree")
    if name in indexed:
        findings += inspect(name, git("show", f":{name}"), "index")
    if name.endswith(".tsbuildinfo"):
        warnings.append({"file": name, "reason": "generated compiler cache is already tracked; ignore rules do not untrack it"})
report = {"candidate_files": len(names), "findings": findings, "warnings": warnings,
          "limits": "No history, remote, compressed-document contents, complete credential inventory, personal-data or redistribution-license audit. Manual evidence review still required."}
folder = ROOT / ".publish-audit"
folder.mkdir(exist_ok=True)
(folder / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
raise SystemExit(1 if findings else 0)
