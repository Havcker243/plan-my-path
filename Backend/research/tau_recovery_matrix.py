"""Materialize or execute the frozen matrix. Default is plan-only (no API calls)."""
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Backend"))
from research.official_baselines import redact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Run 171 live simulations; incurs API cost")
    args = parser.parse_args()
    protocol_path = ROOT / "docs/research/tau-recovery-protocol.json"
    protocol = json.loads(protocol_path.read_text())
    folder = ROOT / "docs/research/baselines/results" / ("tau-matrix-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:6])
    folder.mkdir(parents=True)
    cells = []
    for task in protocol["task_ids"]:
        for index, seed in enumerate(protocol["seeds"]):
            cells.append({"task": task, "seed": seed, "fault": "none", "strategy": "no_recovery"})
            for fault in protocol["faults"]:
                methods = protocol["strategies"]
                # Rotate method order by seed; record order before any results exist.
                for strategy in methods[index:] + methods[:index]:
                    cells.append({"task": task, "seed": seed, "fault": fault, "strategy": strategy})
    manifest = {"protocol_sha256": hashlib.sha256(protocol_path.read_bytes()).hexdigest(),
                "adapter_sha256": hashlib.sha256((ROOT / "Backend/research/tau_recovery.py").read_bytes()).hexdigest(),
                "status": "running" if args.execute else "planned_only", "planned_cells": len(cells), "cells": cells}
    target = folder / "matrix.json"
    target.write_text(json.dumps(manifest, indent=2))
    print(f"Matrix: {target}; {len(cells)} cells; API execution: {args.execute}", flush=True)
    if not args.execute:
        return
    python = ROOT / ".research-upstream/tau-bench/.venv/Scripts/python.exe"
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8", LOGURU_LEVEL="ERROR")
    for index, cell in enumerate(cells):
        if hashlib.sha256((ROOT / "Backend/research/tau_recovery.py").read_bytes()).hexdigest() != manifest["adapter_sha256"]:
            manifest["status"] = "stopped_adapter_changed"
            target.write_text(json.dumps(manifest, indent=2))
            raise RuntimeError("Adapter changed during matrix execution; remaining cells not run")
        output = folder / f"cell-{index:03}.json"
        command = [str(python), str(ROOT / "Backend/research/tau_recovery.py"), "--task", cell["task"],
                   "--seed", str(cell["seed"]), "--fault", cell["fault"], "--strategies", cell["strategy"], "--output", str(output)]
        cell["command"], cell["started_at"] = command, datetime.now(timezone.utc).isoformat()
        target.write_text(json.dumps(manifest, indent=2))
        try:
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, timeout=240)
            cell["exit_code"] = result.returncode
            (folder / f"cell-{index:03}.txt").write_text(redact(result.stdout + result.stderr, env), encoding="utf-8")
        except subprocess.TimeoutExpired:
            cell["exit_code"], cell["error"] = 124, "Outer cell timeout; do not drop this attempt"
        cell["ended_at"] = datetime.now(timezone.utc).isoformat()
        cell["output"] = output.name if output.exists() else None
        target.write_text(json.dumps(manifest, indent=2))
        print(f"Cell {index + 1}/{len(cells)}: exit {cell['exit_code']}", flush=True)
    manifest["status"] = "finished_with_failures" if any(c["exit_code"] for c in cells) else "finished"
    target.write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
