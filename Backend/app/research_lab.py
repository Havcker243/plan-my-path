"""Local research operator API. Fixed experiments; no student database access."""
from __future__ import annotations

from datetime import datetime, timezone
import json
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import uuid
import shutil

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import _load_env_lines

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "logs/research-lab"
BASELINES = ROOT / "docs/research/baselines/results"
EVIDENCE = ROOT / "docs/research/progress-report-1/evidence"
MODEL = "gemini-3.5-flash-lite"
LOCK = threading.Lock()


def research_setting(name: str, default: str = "") -> str:
    # Match the application's file-based configuration; uvicorn does not load .env automatically.
    return os.environ.get(name, _load_env_lines(ROOT / "Backend/.env").get(name, default))

ACTIONS = {
    "custom-offline": {"label": "Synthetic recovery comparison", "scope": "Five strategies, one controlled fault; deterministic localization", "paid": False},
    "custom-live": {"label": "Gemini selective recovery", "scope": "One synthetic trial; Gemini diagnosis and deterministic replay", "paid": True},
    "agentrx-ir": {"label": "AgentRx public samples", "scope": "Official IR preprocessing only; no failure localization score", "paid": False},
    "tau-check": {"label": "τ-bench environment checks", "scope": "Official data validation and retail tool tests; no task score", "paid": False},
    "tau-smoke": {"label": "τ-bench live retail baseline", "scope": "Official task 0, one trial, seed 300; Gemini agent and user", "paid": True},
    "tau-recovery": {"label": "Official-task recovery pilot", "scope": "Released retail task 0; controlled empty-read fault; reference vs selective recovery", "paid": True},
    "agentrx-full": {"label": "AgentRx full public-sample pipeline", "scope": "One fixed public sample; all official stages; supported provider access required", "paid": True},
    "fisk-case-study": {"label": "Fisk catalog case-study checks", "scope": "Four synthetic records; sourced 2024–2025 rules; unresolved requirements remain flagged", "paid": False},
}

# Display contracts describe the implemented stage, never the full paper method.
PROTOCOLS = {
    "agentrx-full": {
        "category": "Published pipeline · access required", "benchmark": "First lexicographically sorted public AgentRx tau-retail sample",
        "method": "All unchanged official stages: IR, static, dynamic, check, judge, report; Copilot endpoint",
        "data": "One released example; full gated dataset remains unavailable",
        "evaluator": "Official stage outputs and judge report; no locally invented diagnosis accuracy",
        "design": "One fixed public sample; upstream provider/model defaults; isolated environment; 900s wrapper timeout",
        "question": "Can the complete published pipeline execute on a released sample with supported provider access?",
        "claim": "Runner prepared; access blocked until isolated environment and authenticated Copilot CLI are available. Not reproduced yet.",
    },
    "fisk-case-study": {
        "category": "Source-grounded partial academic audit", "benchmark": "Separate Fisk B.S. Computer Science case study",
        "method": "Deterministic credit, GPA, known major/cognate grade and missing-course checks",
        "data": "2024–2025 official catalog facts plus four synthetic student records; no real student data",
        "evaluator": "Explicit known-rule checks; unresolved catalog and full-degree conditions force manual review",
        "design": "Four cases: known rules met, missing course, low major grade, duplicate credit attempt",
        "question": "Can source-grounded calculations reject errors without falsely clearing graduation?",
        "claim": "Partial academic validation only; not a public benchmark, full degree audit or university approval.",
    },
    "tau-recovery": {
        "category": "Controlled extension on official tasks", "benchmark": "Pinned tau retail task 0; researcher-defined protocol; version recorded per artifact",
        "method": "Official agent/user plus our external recovery controller; no recovery vs selective",
        "data": "Released retail task, tools, policy and simulated database; first get_user_details output replaced with an empty object",
        "evaluator": "Unchanged official evaluator; report fault coverage and localization separately from task reward",
        "design": "Two executions: task 0, seed 300, empty_read, Gemini agent/user; matched 60-step/180s budgets; one recovery maximum; v2 adds 6s model pacing",
        "question": "Can recovery restore a safe boundary on a released task, and what official reward follows?",
        "claim": "Controlled pilot only; custom fault extension is not an official suite score or published-method reproduction.",
    },
    "custom-offline": {
        "category": "Custom engineering demonstration", "benchmark": "Synthetic delayed-audit fixture v1",
        "method": "Full restart, visible-step retry, simulated late checkpoint, source rollback, selective recovery",
        "data": "Illustrative nine-credit course fixture; synthetic student; not verified Fisk degree requirements",
        "evaluator": "Deterministic requirement/plan checks and hidden injected-source scoring",
        "design": "One fault scenario; one execution per strategy; five strategies; no model calls",
        "question": "Which work is repeated or preserved after a delayed incorrect audit result?",
        "claim": "Demonstrates recovery mechanics on this fixture; does not establish general superiority.",
    },
    "custom-live": {
        "category": "Custom model smoke test", "benchmark": "Synthetic delayed-audit fixture v1",
        "method": "Gemini source diagnosis followed by dependency-aware deterministic replay",
        "data": "Same synthetic academic fixture; model receives observed trace, not hidden fault metadata",
        "evaluator": "Hidden-source match, invalidation metrics and deterministic final validation",
        "design": "One scenario and one trial per site launch; Gemini 3.5 Flash Lite",
        "question": "Can the model locate the earlier corrupted result from the visible execution trace?",
        "claim": "Tests model diagnosis on one fault; not an end-to-end published recovery method reproduction.",
    },
    "agentrx-ir": {
        "category": "Official preprocessing stage", "benchmark": "AgentRx public tau-retail samples",
        "method": "Pinned AgentRx CLI, IR normalization stage only",
        "data": "Released public example trajectories; not the full gated 170-trajectory benchmark",
        "evaluator": "Process exit and generated intermediate-representation artifacts; no diagnosis evaluator",
        "design": "One preprocessing pass per released local sample; no model calls",
        "question": "Can the official pipeline normalize the released trajectories in our environment?",
        "claim": "Demonstrates preprocessing compatibility; no localization or recovery accuracy measured.",
    },
    "tau-check": {
        "category": "Official environment verification", "benchmark": "Pinned maintained tau-bench retail environment",
        "method": "Official check-data command and retail tool unit tests",
        "data": "Released retail tasks, policy and simulated database",
        "evaluator": "Official data checks and test assertions; not the task reward evaluator",
        "design": "One data-validation pass and the official retail tool test file; no model calls",
        "question": "Are the benchmark data and retail tools usable before a model trial?",
        "claim": "Verifies setup only; tool test pass rate is not agent task accuracy.",
    },
    "tau-smoke": {
        "category": "Official task smoke test", "benchmark": "Pinned maintained tau-bench retail, base split, task 0",
        "method": "Official llm_agent and user_simulator; no custom recovery adapter",
        "data": "Unchanged released task, policy and simulated retail database; no real customers",
        "evaluator": "Official reward_info; retain grading breakdown and termination reason",
        "design": "One task, one trial, seed 300; Gemini agent/user, temperature 0; 180s simulation timeout",
        "question": "How does the official reference agent perform on this released task with our model?",
        "claim": "A model-substituted official task observation; not a suite score or numerical paper reproduction.",
    },
}

# These references support the released components, not our recovery modifications.
for _action, _protocol in PROTOCOLS.items():
    if _action.startswith("agentrx"):
        _protocol["sources"] = "https://github.com/microsoft/AgentRx/tree/7a18c79708e7671be15124460f4f7296107c2a55 ; https://arxiv.org/abs/2602.02475v2"
        _protocol["validation_status"] = "Published diagnostic framework; only IR preprocessing completed locally. Full diagnosis remains access-blocked; recovery efficacy is not established."
    elif _action.startswith("tau"):
        _protocol["sources"] = "https://github.com/sierra-research/tau2-bench/tree/4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699 ; docs/research/baselines/upstream-lock.json"
        _protocol["validation_status"] = (
            "Custom recovery extension, not a published recovery method. Official task/tools/evaluator are reused; one completed live pair does not validate general efficacy."
            if _action == "tau-recovery" else
            "Released benchmark implementation. Local setup checks or one model-substituted task run do not reproduce published aggregate scores."
        )
    elif _action == "fisk-case-study":
        _protocol["sources"] = "https://fisk.smartcatalogiq.com/en/bulletin/undergraduate/school-of-natural-science-and-mathematics/department-of-mathematics-and-computer-science/computer-science-bs/ ; docs/research/fisk-catalog-rules.json"
        _protocol["validation_status"] = "Official catalog sources; researcher-created synthetic records and partial checker. No full degree-audit validation or university approval."
    else:
        _protocol["sources"] = "Local specification: docs/research/recovery-method.md ; assumptions: docs/research/assumptions.md. No published implementation is reproduced by this demonstration."
        _protocol["validation_status"] = "Custom prototype and synthetic fixture; software checks and smoke tests only. Research effectiveness remains unestablished."


def artifact_record(path: Path) -> dict:
    return {"path": path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.name,
            "sha256_at_inspection": hashlib.sha256(path.read_bytes()).hexdigest()}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def clean(text: str) -> str:
    for name, value in os.environ.items():
        if value and len(value) > 8 and any(word in name.upper() for word in ("KEY", "TOKEN", "SECRET", "PASSWORD")):
            text = text.replace(value, "[REDACTED]")
    return re.sub(r"AIza[0-9A-Za-z_-]+", "[REDACTED]", text)


def readiness(action: str) -> str | None:
    if action == "agentrx-full":
        if not (ROOT / ".research-upstream/AgentRx/.venv/Scripts/python.exe").exists() or not shutil.which("copilot"):
            return "Requires isolated AgentRx dependencies and authenticated Copilot CLI; full diagnosis not yet reproduced."
        return None
    if action.startswith("tau"):
        if not (ROOT / ".research-upstream/tau-bench/.venv/Scripts/tau2.exe").exists():
            return "Install the pinned τ-bench checkout and isolated environment (see research-lab.md)."
    if action == "agentrx-ir" and not (ROOT / ".research-upstream/AgentRx/run.py").exists():
        return "Install the pinned AgentRx checkout."
    if ACTIONS[action]["paid"]:
        from dotenv import dotenv_values
        config = dotenv_values(ROOT / "Backend/.env")
        if not any(os.environ.get(k) or config.get(k) for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY")):
            return "Configure the Gemini API key on the backend."
    return None


def describe(path: Path, action: str) -> dict:
    """Keep execution outcome separate from the official evaluator reward."""
    data = read_json(path)
    provenance = {"protocol": PROTOCOLS[action], "artifacts": [artifact_record(path)]}
    if action == "fisk-case-study":
        provenance["artifacts"].append(artifact_record(ROOT / "docs/research/fisk-catalog-rules.json"))
        return {"comparison_group": "fisk-partial-audit-2024-2025", "rows": data["cases"], "model": "deterministic",
                "limitations": "Synthetic transcripts; partial verified facts; unresolved conditions require manual review; degree clearance disabled.", **provenance}
    if action == "tau-recovery":
        first = data["results"][0] if data["results"] else {}
        provenance["protocol"] = dict(PROTOCOLS[action])
        pacing = data.get("protocol_definition", {}).get("provider_pacing_seconds_before_each_generation")
        provenance["protocol"]["design"] = f"Recorded executions: {len(data['results'])}; task {first.get('task_id')}; seed {first.get('seed')}; fault {first.get('fault')}; pacing {str(pacing) + 's per generation' if pacing is not None else 'see original protocol artifact'}"
        return {"comparison_group": f"tau-controlled-{data['protocol_sha256'][:12]}-{data['adapter_sha256'][:12]}-task{first.get('task_id')}-seed{first.get('seed')}-{first.get('fault')}",
                "rows": data["results"], "model": data["configuration"]["llm_agent"],
                "manifest": {k: v for k, v in data.items() if k != "results"},
                "limitations": data["limitations"], **provenance}
    if action.startswith("custom"):
        return {"comparison_group": "synthetic-delayed-audit-v1", "rows": data["results"],
                "model": data.get("model", "deterministic"), "limitations": data["limitations"], **provenance}
    manifest = data
    result = {"comparison_group": "official-setup", "rows": [], "manifest": manifest,
              "limitations": manifest.get("limitation", manifest["evidence_scope"]), **provenance}
    official = path.parent / "official-results.json"
    if action == "tau-smoke" and official.exists():
        raw = read_json(official)
        result["artifacts"].append(artifact_record(official))
        result.update(comparison_group="tau-retail-task0-seed300-gemini-3.5-flash-lite",
                      model=raw["info"]["agent_info"]["llm"], official=raw)
        result["rows"] = [{"strategy": "official llm_agent", "task_id": s["task_id"],
                           "reward": (s.get("reward_info") or {}).get("reward"),
                           "termination_reason": s.get("termination_reason"),
                           "duration": s.get("duration"), "messages": len(s.get("messages", []))}
                          for s in raw.get("simulations", [])]
    return result


def history() -> list[dict]:
    items = []
    for path in sorted(RUNS.glob("*/job.json"), reverse=True):
        try:
            item = read_json(path)
            if item["status"] == "running" and not LOCK.locked():
                item.update(status="interrupted", error="Backend restarted before this run completed; inspect saved artifacts.")
            items.append(item)
        except (OSError, ValueError):
            continue
    # Previously recorded evidence remains available after deployment/restart.
    archives = [(EVIDENCE / "recovery-benchmark.json", "custom-offline"),
                (EVIDENCE / "fisk-case-study-20261007.json", "fisk-case-study")]
    archives += [(path, "custom-live") for path in sorted(EVIDENCE.glob("live-recovery-*.json"), reverse=True)]
    for path, action in archives:
        if path.exists():
            evidence = describe(path, action)
            failed = action == "custom-live" and any(not row.get("success") or row.get("provider_error") for row in evidence["rows"])
            items.append({"id": f"archive-{path.stem}", "action": action, "status": "failed" if failed else "completed",
                          "archived": True, "evidence": evidence})
    for path in sorted(BASELINES.glob("*/manifest.json"), reverse=True):
        try:
            m = read_json(path)
            if not m.get("action"):
                continue
            ok = bool(m.get("ended_at_utc")) and all(e["exit_code"] == 0 for e in m["executions"])
            items.append({"id": path.parent.name, "action": m["action"], "status": "blocked" if m.get("status") == "blocked" else "completed" if ok else "failed",
                          "archived": True, "started_at": m["started_at_utc"], "evidence": describe(path, m["action"])})
        except (OSError, ValueError, KeyError):
            continue
    recovery_paths = list(BASELINES.glob("tau-recovery*/recovery-results.json"))
    recovery_paths += list(BASELINES.glob("tau-matrix-*/cell-*.json"))
    for path in sorted(recovery_paths, reverse=True):
        try:
            data = read_json(path)
            # Matrix files are created before generation; do not present partial
            # files as completed/failed results while the CLI is still running.
            if not data.get("ended_at") or not data.get("results"):
                continue
            ok = all(not r.get("execution_error") for r in data["results"])
            identifier = path.parent.name if path.name == "recovery-results.json" else f"{path.parent.name}-{path.stem}"
            items.append({"id": identifier, "action": "tau-recovery", "status": "completed" if ok else "failed",
                          "archived": True, "started_at": data["started_at"], "ended_at": data["ended_at"],
                          "evidence": describe(path, "tau-recovery")})
        except (OSError, ValueError, KeyError):
            continue
    # The official wrapper also archives lab runs; show each execution only once.
    linked = {item.get("artifact_id") for item in items if not item.get("archived")}
    return [item for item in items if not item.get("archived") or item["id"] not in linked]


def save(folder: Path, job: dict):
    temporary = folder / "job.tmp"
    temporary.write_text(clean(json.dumps(job, indent=2)), encoding="utf-8")
    temporary.replace(folder / "job.json")


def execute_job(folder: Path, job: dict):
    try:
        action = job["action"]
        output = folder / "result.json"
        if action == "custom-offline":
            command = [sys.executable, "-m", "research.benchmark", "--output", str(output)]
        elif action == "custom-live":
            command = [sys.executable, "-m", "research.agent_recovery_demo", "--runs", "1", "--model", MODEL, "--output", str(output)]
        elif action == "fisk-case-study":
            command = [sys.executable, "-m", "research.fisk_case_study", "--output", str(output)]
        elif action == "tau-recovery":
            command = [str(ROOT / ".research-upstream/tau-bench/.venv/Scripts/python.exe"),
                       "-m", "research.tau_recovery", "--output", str(output)]
        else:
            command = [sys.executable, "-m", "research.official_baselines", action]
        env = os.environ.copy()
        env.update(PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
        job["command"] = command
        job["source_sha256"] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in [ROOT / "Backend/research/benchmark.py", ROOT / "Backend/research/fixtures.py",
                                          ROOT / "Backend/research/agent_recovery_demo.py", ROOT / "Backend/app/agent/state.py",
                                          ROOT / "Backend/research/tau_recovery.py", ROOT / "Backend/research/official_baselines.py",
                                          ROOT / "Backend/research/fisk_case_study.py", ROOT / "docs/research/fisk-catalog-rules.json",
                                          ROOT / "docs/research/tau-recovery-protocol.json"]}
        process = subprocess.Popen(command, cwd=ROOT / "Backend", env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        try:
            limit = 1020 if action == "agentrx-full" else 540 if action == "tau-recovery" else 330
            stdout, stderr = process.communicate(timeout=limit)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                # Kill only the process tree launched for this fixed experiment.
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                process.kill()
            stdout, stderr = process.communicate()
            (folder / "console.txt").write_text(clean(stdout + stderr), encoding="utf-8")
            raise
        result = subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
        job.update(status="completed" if result.returncode == 0 else "failed", exit_code=result.returncode)
        console = clean(result.stdout + result.stderr)
        (folder / "console.txt").write_text(console, encoding="utf-8")
        job["console"] = console[-16000:]
        if not action.startswith("custom"):
            # Fixed wrapper prints its output directory; never accept a browser-supplied path.
            match = re.search(r"^Artifacts: (.+)$", result.stdout, re.MULTILINE)
            if match:
                candidate = Path(match[1].strip()).resolve()
                if candidate.is_relative_to(BASELINES.resolve()):
                    output = candidate / "manifest.json"
                    job["artifact_id"] = candidate.name
        if output.exists():
            job["evidence"] = describe(output, action)
    except subprocess.TimeoutExpired:
        job.update(status="failed", error="Experiment exceeded its fixed execution time limit.")
    except Exception as exc:
        job.update(status="failed", error=clean(f"{type(exc).__name__}: {exc}"))
    finally:
        job["ended_at"] = datetime.now(timezone.utc).isoformat()
        try:
            save(folder, job)
        finally:
            LOCK.release()


class RunRequest(BaseModel):
    action: str


def create_router(current_user) -> APIRouter:
    router = APIRouter(prefix="/api/research", tags=["research"])

    def operator(user=Depends(current_user)):
        allowed = {x.strip().lower() for x in research_setting("RESEARCH_OPERATOR_EMAILS").split(",") if x.strip()}
        if str(user.get("email", "")).lower() not in allowed:
            raise HTTPException(403, "Research Lab access requires a backend RESEARCH_OPERATOR_EMAILS entry for your signed-in email.")
        return user

    @router.get("/runs")
    def runs(_=Depends(operator)):
        enabled = research_setting("RESEARCH_LAB_ENABLED", "false").lower() == "true"
        return {"runs": history(), "actions": [{"id": k, **v, "protocol": PROTOCOLS[k], "blocked": readiness(k) if enabled else "Set RESEARCH_LAB_ENABLED=true on the backend."} for k, v in ACTIONS.items()],
                "busy": LOCK.locked(), "model": MODEL,
                "unavailable": ["AgentRx full diagnosis: provider/authentication and gated dataset access pending.",
                                "AgentRewind, AgentDebugX, DGRR: literature reviewed; implementations not integrated.",
                                "AgentBench and WebArena: public suites identified; environments not installed.",
                                "Official-task recovery controller and fixed protocol added; only completed recorded trials count as evidence. Full matrix pending."]}

    @router.post("/runs", status_code=202)
    def run(request: RunRequest, user=Depends(operator)):
        if research_setting("RESEARCH_LAB_ENABLED", "false").lower() != "true":
            raise HTTPException(403, "Research execution is disabled on this backend.")
        if request.action not in ACTIONS:
            raise HTTPException(422, "Unknown experiment.")
        if reason := readiness(request.action):
            raise HTTPException(409, reason)
        if not LOCK.acquire(blocking=False):
            raise HTTPException(409, "An experiment is already running. Wait for it to finish.")
        try:
            job = {"id": uuid.uuid4().hex, "action": request.action, "status": "running",
                   "started_at": datetime.now(timezone.utc).isoformat(), "operator": user["sub"]}
            folder = RUNS / job["id"]
            folder.mkdir(parents=True)
            save(folder, job)
            threading.Thread(target=execute_job, args=(folder, job.copy()), daemon=True).start()
            return job
        except Exception:
            LOCK.release()
            raise

    return router
