"""Refresh offline evidence using Backend's Python; never calls an external API."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / "evidence"
OUT.mkdir(exist_ok=True)
commands = [
    ("backend-tests.txt", [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"]),
    ("benchmark-console.txt", [sys.executable, "-m", "research.benchmark", "--output", str(OUT / "recovery-benchmark.json")]),
]
execution = []
for filename, command in commands:
    result = subprocess.run(command, cwd=ROOT / "Backend", capture_output=True, text=True)
    output = result.stdout + result.stderr
    (OUT / filename).write_text(output, encoding="utf-8")
    print(output)
    execution.append({"command": command, "exit_code": result.returncode, "log": filename})
    if result.returncode:
        raise SystemExit(result.returncode)

source = ROOT / "logs/agent-recovery-runs.json"
archived = json.loads(source.read_text(encoding="utf-8"))
fields = ["run", "success", "predicted_source_step", "true_source_step", "exact_source_accuracy",
          "repeated_steps", "preserved_valid_steps", "invalidation_precision", "invalidation_recall",
          "invalidation_f1", "tokens", "recovery_ms", "model_calls", "provider_error"]
summary = {
    "source": "logs/agent-recovery-runs.json",
    "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "provenance_note": "Earlier live smoke tests documented September 15, 2026; summarized October 7, not rerun today. The source JSON has no embedded collection date.",
    "model": archived["model"],
    "results": [{k: row.get(k) for k in fields} for row in archived["results"]],
}
(OUT / "archived-live-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
manifest = {"generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "fresh_external_api_calls": 0, "executions": execution,
            "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in OUT.iterdir() if p.is_file() and p.name != "manifest.json"}}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
