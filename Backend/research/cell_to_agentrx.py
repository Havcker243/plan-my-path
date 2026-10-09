"""Convert a tau_recovery cell JSON to AgentRx trajectory format and run the pipeline.

Usage (from repo root):
    .research-upstream/AgentRx/.venv/Scripts/python.exe Backend/research/cell_to_agentrx.py \
        docs/research/baselines/results/<matrix>/cell-001.json \
        --out-dir docs/research/agentrx-runs/
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RX = ROOT / ".research-upstream/AgentRx"


def load_task_instruction(task_id: str, seed: int) -> str:
    """Try to read the tau-bench task instruction for context."""
    try:
        sys.path.insert(0, str(ROOT / ".research-upstream/tau-bench/src"))
        from tau2.data.data import get_data
        env = get_data("retail", "base")
        tasks = [t for t in env.tasks if str(t.id) == str(task_id)]
        if tasks:
            return tasks[0].instruction or ""
    except Exception:
        pass
    return ""


def convert(cell_path: Path) -> dict:
    cell = json.loads(cell_path.read_text(encoding="utf-8"))
    r = cell["results"][0]
    sim = r.get("simulation", {})
    messages = sim.get("messages", [])

    # Normalise messages to {role, content, tool_calls}
    events = []
    for m in messages:
        role = m.get("role", "unknown")
        content = m.get("content") or ""
        tool_calls = m.get("tool_calls") or []
        # Flatten list-of-string content to a single string
        if isinstance(content, list):
            content = "\n".join(
                (c.get("text", "") if isinstance(c, dict) else str(c)) for c in content
            )
        events.append({"role": role, "content": content, "tool_calls": tool_calls})

    task_id = str(sim.get("task_id", r.get("task_id", "0")))
    seed = r.get("seed", 0)
    instruction = load_task_instruction(task_id, seed)

    # Build a short summary as instruction fallback
    if not instruction:
        instruction = (
            f"tau-bench retail task {task_id} (seed {seed}), "
            f"fault={r.get('fault','none')}, strategy={r.get('strategy','unknown')}"
        )

    traj = {
        "trajectory_id": cell_path.stem,
        "task_id": int(task_id),
        "trial": 0,
        "reward": r.get("reward"),
        "fault": r.get("fault", "none"),
        "strategy": r.get("strategy", "unknown"),
        "seed": seed,
        "instruction": instruction,
        # AgentRx tau_bench_ir reads from "events"
        "events": events,
        # Also expose as "traj" and "messages" for fallback
        "traj": events,
        "messages": events,
        # Keep reward_info for reference
        "reward_info": sim.get("reward_info", {}),
    }
    return traj


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("cell", help="Path to cell-NNN.json")
    ap.add_argument("--out-dir", default=str(ROOT / "docs/research/agentrx-runs"))
    ap.add_argument("--skip-judge", action="store_true", help="Skip LLM judge stage")
    ap.add_argument("--skip-dynamic", action="store_true", help="Skip dynamic invariants")
    args = ap.parse_args()

    cell_path = Path(args.cell).resolve()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    traj = convert(cell_path)
    traj_file = (out_dir / f"{cell_path.stem}-trajectory.json").resolve()
    traj_file.write_text(json.dumps(traj, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote trajectory: {traj_file}")
    print(f"  task_id={traj['task_id']} seed={traj['seed']} fault={traj['fault']} "
          f"strategy={traj['strategy']} reward={traj['reward']} turns={len(traj['events'])}")

    # Run AgentRx pipeline
    python = RX / ".venv/Scripts/python.exe"
    if not python.exists():
        python = Path(sys.executable)
    run_py = RX / "run.py"

    cmd = [str(python), str(run_py), str(traj_file), "--domain", "tau", "--endpoint", "copilot"]
    if args.skip_judge:
        cmd.append("--skip-judge")
    if args.skip_dynamic:
        cmd.append("--skip-dynamic")

    print(f"\nRunning AgentRx: {' '.join(cmd)}\n")
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    # Point to AgentRx .env so the copilot endpoint config is loaded
    env["AGENTRX_ENV"] = str(RX / ".env")
    result = subprocess.run(cmd, cwd=str(RX), env=env)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
