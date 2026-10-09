"""Summarize saved controlled-recovery evidence without making model calls."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path


METRICS = ("reward", "total_attempt_steps", "model_calls", "tool_executions",
           "validation_tool_calls", "total_tool_invocations", "cached_reads_reused", "duration",
           "estimated_attempt_cost_usd")


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def analyze(paths):
    groups = defaultdict(list)
    sources = []
    seen = set()
    for path in paths:
        path = Path(path).resolve()
        if path in seen:
            raise ValueError(f"Input listed twice: {path.name}")
        seen.add(path)
        raw = path.read_bytes()
        doc = json.loads(raw)
        if doc.get("action") != "tau-recovery" or not isinstance(doc.get("results"), list):
            raise ValueError(f"Not a controlled-recovery artifact: {path.name}")
        # Incomplete provenance cannot establish matched experimental conditions.
        required = ("protocol_sha256", "adapter_sha256", "input_sha256", "configuration", "upstream")
        if any(not doc.get(key) for key in required):
            raise ValueError(f"Missing comparison provenance: {path.name}")
        sources.append({"path": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
                        "attempts": len(doc["results"])})
        conditions = {key: doc[key] for key in required}
        key = json.dumps(conditions, sort_keys=True)
        groups[key].extend(doc["results"])

    summaries = []
    for key, rows in groups.items():
        methods = defaultdict(list)
        pairs = defaultdict(lambda: defaultdict(list))
        for row in rows:
            methods[row["strategy"]].append(row)
            pairs[(row.get("task_id"), row.get("fault"), row.get("seed"))][row["strategy"]].append(row)
        counts = {}
        for method, attempts in methods.items():
            graded = [r for r in attempts if number(r.get("reward"))]
            exercised = [r for r in attempts if r.get("fault_exercised") is True]
            eligible = [r for r in graded if r.get("fault_exercised") is True]
            counts[method] = {
                "attempts": len(attempts), "graded": len(graded),
                "ungraded": len(attempts) - len(graded),
                "fault_exercised": len(exercised),
                "fault_not_exercised": sum(r.get("fault_exercised") is False for r in attempts),
                "fault_coverage_unknown": sum(r.get("fault_exercised") not in (True, False) for r in attempts),
                "graded_fault_exercised": len(eligible),
                "successful_graded": sum(r["reward"] == 1 for r in graded),
                "successful_graded_fault_exercised": sum(r["reward"] == 1 for r in eligible),
                "mean_reward_graded": sum(r["reward"] for r in graded) / len(graded) if graded else None,
                "mean_reward_graded_fault_exercised": sum(r["reward"] for r in eligible) / len(eligible) if eligible else None,
            }
            # Never treat a missing overhead measurement as zero or mix it with
            # ungraded/unexercised rows to suggest recovery efficiency.
            counts[method]["work_metrics"] = {}
            for metric in ("tool_executions", "validation_tool_calls", "total_tool_invocations"):
                values = [r[metric] for r in eligible if number(r.get(metric))]
                counts[method]["work_metrics"][metric] = {
                    "measured_attempts": len(values),
                    "mean": sum(values) / len(values) if values else None}
        comparisons = []
        for (task, fault, seed), attempts in pairs.items():
            reference, selective = attempts.get("no_recovery", []), attempts.get("selective", [])
            comparison = {"task_id": task, "fault": fault, "seed": seed,
                          "reference_attempts": len(reference), "selective_attempts": len(selective)}
            if len(reference) != 1 or len(selective) != 1:
                comparison["status"] = "missing_or_ambiguous_pair"
            elif fault in (None, "none") or any(r.get("fault_exercised") is not True or not number(r.get("reward")) for r in reference + selective):
                comparison["status"] = "ungraded_or_fault_not_exercised"
            else:
                comparison["status"] = "eligible"
                a, b = reference[0], selective[0]
                comparison["selective_minus_reference"] = {
                    metric: b[metric] - a[metric] for metric in METRICS
                    if number(a.get(metric)) and number(b.get(metric))
                    and (metric != "estimated_attempt_cost_usd" or
                         (a.get("cost_usage_complete") is True and b.get("cost_usage_complete") is True))}
            comparisons.append(comparison)
        summaries.append({"conditions": json.loads(key), "attempts": len(rows),
                          "strategies": counts, "pairs": comparisons})
    totals = {"attempts": sum(g["attempts"] for g in summaries),
              "graded_attempts": sum(s["graded"] for g in summaries for s in g["strategies"].values()),
              "ungraded_attempts": sum(s["ungraded"] for g in summaries for s in g["strategies"].values()),
              "eligible_pairs": sum(p["status"] == "eligible" for g in summaries for p in g["pairs"]),
              "ineligible_pairs": sum(p["status"] != "eligible" for g in summaries for p in g["pairs"])}
    return {"schema_version": 1, "sources": sources, "groups": summaries, "totals": totals,
            "limitations": ["Different protocol, adapter, input, upstream or configuration records are never pooled.",
                            "Null rewards remain ungraded; reward zero is a graded failure.",
                            "Repeated attempts within one task/fault/seed are retained but not arbitrarily paired.",
                            "Pairs require recorded faults to be exercised and both rewards to be graded.",
                            "Seeds do not guarantee identical provider outputs; these are descriptive comparisons, not causal or significance claims.",
                            "No-recovery success may include ordinary model self-recovery; it is not controller recovery success."]}


def markdown(summary):
    lines = ["# Saved recovery evidence analysis", "",
             "Generated from preserved artifacts; no new model calls. Positive deltas mean selective used more work/time/cost or earned more reward.", ""]
    totals = summary["totals"]
    lines += [f"Attempts: {totals['attempts']}; graded: {totals['graded_attempts']}; ungraded: {totals['ungraded_attempts']}; eligible pairs: {totals['eligible_pairs']}; incomplete/ambiguous pairs: {totals['ineligible_pairs']}.", "",
              "These are coverage counts across the listed groups, not pooled strategy scores.", ""]
    for index, group in enumerate(summary["groups"], 1):
        lines += [f"## Comparison group {index}", "",
                  f"Protocol hash: `{group['conditions']['protocol_sha256']}`", "",
                  "| Strategy | Attempts | Graded | Ungraded | Fault reached | Successful / graded with fault |",
                  "| --- | ---: | ---: | ---: | ---: | ---: |"]
        for name, row in group["strategies"].items():
            lines.append(f"| {name} | {row['attempts']} | {row['graded']} | {row['ungraded']} | {row['fault_exercised']} | {row['successful_graded_fault_exercised']} / {row['graded_fault_exercised']} |")
        lines.append("")
        lines += ["Tool work below includes only graded attempts with exercised faults; n is the number with that metric recorded. Missing values are not zero.", "",
                  "| Strategy | Executions (mean; n) | Validations (mean; n) | Total invocations (mean; n) |",
                  "| --- | ---: | ---: | ---: |"]
        for name, row in group["strategies"].items():
            cells = []
            for metric in ("tool_executions", "validation_tool_calls", "total_tool_invocations"):
                work = row["work_metrics"][metric]
                cells.append(f"{work['mean']:.2f}; {work['measured_attempts']}" if work["mean"] is not None else "unrecorded; 0")
            lines.append("| " + name + " | " + " | ".join(cells) + " |")
        lines.append("")
        for pair in group["pairs"]:
            lines += [f"Task {pair['task_id']}, fault {pair['fault']}, seed {pair['seed']}: **{pair['status']}**.", ""]
            for metric, delta in pair.get("selective_minus_reference", {}).items():
                lines.append(f"- {metric}: {delta:+.6g}")
            lines.append("")
    lines += ["## Limits", ""] + [f"- {item}" for item in summary["limitations"]]
    lines += ["", "## Input evidence", ""]
    lines += [f"- `{item['path']}` — SHA-256 `{item['sha256']}`" for item in summary["sources"]]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", nargs="+", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True, help="New directory; existing evidence is never overwritten")
    args = parser.parse_args()
    summary = analyze(args.inputs)
    args.output_dir.mkdir(parents=True, exist_ok=False)
    (args.output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (args.output_dir / "summary.md").write_text(markdown(summary), encoding="utf-8")
    print(f"Saved {len(summary['groups'])} comparison groups to {args.output_dir}")


if __name__ == "__main__":
    main()
