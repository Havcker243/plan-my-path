"""Run pinned official baselines unchanged; record commands and provenance.

This is an execution wrapper, not an implementation of AgentRx or tau-bench.
Default actions are offline. Only tau-smoke invokes paid external models.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
import shutil

ROOT = Path(__file__).resolve().parents[2]
BASELINES = ROOT / "docs/research/baselines"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_checkout(spec: dict) -> Path:
    checkout = ROOT / spec["local_path"]
    revision = subprocess.check_output(
        ["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
    if revision != spec["commit"]:
        raise RuntimeError("Upstream revision differs from upstream-lock.json")
    # Generated, gitignored outputs are allowed; tracked upstream edits are not.
    changed = subprocess.check_output(
        ["git", "-C", str(checkout), "status", "--porcelain", "--untracked-files=no"], text=True)
    if changed.strip():
        raise RuntimeError("Tracked upstream files have changed; refuse an unmodified-baseline claim")
    return checkout


def redact(text: str, env: dict) -> str:
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        value = env.get(name)
        if value:
            text = text.replace(value, "[REDACTED]")
    text = re.sub(r"AIza[0-9A-Za-z_-]+", "[REDACTED]", text)
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("agentrx-ir", "agentrx-full", "tau-check", "tau-smoke"))
    parser.add_argument("--endpoint", choices=("copilot", "azure"), default="copilot")
    parser.add_argument("--model", default="gemini/gemini-3.5-flash-lite")
    args = parser.parse_args()
    lock = json.loads((BASELINES / "upstream-lock.json").read_text())
    key = "agentrx" if args.action.startswith("agentrx") else "tau_bench"
    upstream = verify_checkout(lock[key])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = BASELINES / "results" / f"{args.action}-{stamp}-{uuid.uuid4().hex[:6]}"
    output.mkdir(parents=True)
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["UV_CACHE_DIR"] = str(ROOT / ".research-upstream/.uv-cache")
    records = []
    files = {}
    manifest = {
        "action": args.action, "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "upstream": lock[key], "upstream_tracked_files_unchanged": True,
        "assumption_register": "docs/research/assumptions.md", "executions": records,
        "input_sha256": files,
        "evidence_scope": "preprocessing/setup smoke test, not a benchmark-wide reproduction",
    }

    def execute(command: list[str], name: str, timeout: int = 180) -> None:
        started = datetime.now(timezone.utc).isoformat()
        print(f"Running official {name}", flush=True)
        try:
            result = subprocess.run(command, cwd=upstream, env=env, capture_output=True,
                                    text=True, encoding="utf-8", errors="replace", timeout=timeout)
            code = result.returncode
            log = result.stdout + result.stderr
        except subprocess.TimeoutExpired as exc:
            code = 124
            stdout = exc.stdout or b""
            stderr = exc.stderr or b""
            log = (stdout.decode("utf-8", "replace") if isinstance(stdout, bytes) else stdout)
            log += (stderr.decode("utf-8", "replace") if isinstance(stderr, bytes) else stderr)
            log += "\nWrapper timeout; record as failed, not missing data.\n"
        path = output / f"{name}.txt"
        path.write_text(redact(log, env), encoding="utf-8")
        records.append({"command": command, "cwd": str(upstream), "started_at_utc": started,
                        "ended_at_utc": datetime.now(timezone.utc).isoformat(),
                        "exit_code": code, "log": path.name, "log_sha256": sha256(path)})
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"{name}: exit={code}; log={path}", flush=True)
        if code:
            raise SystemExit(code)

    if args.action.startswith("agentrx"):
        samples = sorted((upstream / "trajectories/tau-retail").glob("*.json"))
        if args.action == "agentrx-full":
            samples = samples[:1]  # Fixed public sample pilot, not all gated trajectories.
            python = upstream / ".venv/Scripts/python.exe"
            if not python.exists() or not shutil.which("copilot" if args.endpoint == "copilot" else "az"):
                manifest.update(status="blocked", evidence_scope="Full pipeline preflight only; no inference executed",
                                limitation="Isolated environment or supported authenticated provider CLI unavailable; not a completed reproduction")
                (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                print(f"Blocked: install/authenticate supported provider CLI. Artifacts: {output}", flush=True)
                raise SystemExit(2)
            manifest.update(evidence_scope="One fixed public sample, all official pipeline stages; full dataset accuracy not measured",
                            endpoint=args.endpoint)
        else:
            python = Path(sys.executable)
        for sample in samples:
            files[str(sample.relative_to(upstream))] = sha256(sample)
            command = [str(python), "run.py", str(sample), "--domain", "tau", "--run-dir", str(output / sample.stem)]
            command += ["--stage", "ir"] if args.action == "agentrx-ir" else ["--endpoint", args.endpoint]
            execute(command, sample.stem, timeout=180 if args.action == "agentrx-ir" else 900)
        manifest["limitation"] = "Public released samples only; no full-benchmark accuracy measured. " + ("Preprocessing only; no diagnosis." if args.action == "agentrx-ir" else "Inspect stage reports; successful execution is not localization correctness.")
    else:
        python = upstream / ".venv/Scripts/python.exe"
        cli = upstream / ".venv/Scripts/tau2.exe"
        for name in ("tasks.json", "split_tasks.json", "policy.md", "db.json"):
            path = upstream / "data/tau2/domains/retail" / name
            files[str(path.relative_to(upstream))] = sha256(path)
        files["uv.lock"] = sha256(upstream / "uv.lock")
        execute([str(python), "-m", "pip", "freeze"], "installed-dependencies") if (upstream / ".venv/Scripts/pip.exe").exists() else execute(
            ["uv", "pip", "freeze", "--python", str(python)], "installed-dependencies")
        if args.action == "tau-check":
            execute([str(cli), "check-data"], "check-data")
            execute([str(python), "-m", "pytest", "tests/test_domains/test_retail/test_tools_retail.py", "-q"], "official-retail-tests")
        else:
            from dotenv import dotenv_values
            config = dotenv_values(ROOT / "Backend/.env")
            api_key = (env.get("GEMINI_API_KEY") or env.get("GOOGLE_API_KEY")
                       or config.get("GEMINI_API_KEY") or config.get("GOOGLE_API_KEY"))
            if args.model.startswith("gemini/"):
                if not api_key:
                    raise RuntimeError("Gemini key unavailable; configure it locally, never in result files")
                env["GEMINI_API_KEY"] = api_key
                env["GOOGLE_API_KEY"] = api_key
            save_name = output.name
            manifest["evidence_scope"] = "one official retail task, one trial; model-substituted baseline smoke test"
            manifest["deviations"] = ["Gemini replaces upstream default agent and user models.",
                                      "A 180-second per-simulation timeout and 240-second wrapper timeout bound this setup run."]
            manifest["task_ids"] = ["0"]
            execute([str(cli), "run", "--domain", "retail", "--task-split-name", "base",
                     "--task-ids", "0", "--num-trials", "1", "--agent-llm", args.model,
                     "--user-llm", args.model, "--max-concurrency", "1", "--seed", "300",
                     "--timeout", "180", "--save-to", save_name], "official-tau-run", timeout=240)
            source = upstream / "data/simulations" / save_name / "results.json"
            if not source.exists():
                raise RuntimeError("CLI finished without expected official results.json; inspect logs")
            text = redact(source.read_text(encoding="utf-8"), env)
            (output / "official-results.json").write_text(text, encoding="utf-8")
            manifest["official_result_sha256"] = sha256(output / "official-results.json")
            manifest["grading_note"] = "Read official reward and termination reason. CLI exit zero alone does not mean task success."
    manifest["ended_at_utc"] = datetime.now(timezone.utc).isoformat()
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Artifacts: {output}")


if __name__ == "__main__":
    main()
