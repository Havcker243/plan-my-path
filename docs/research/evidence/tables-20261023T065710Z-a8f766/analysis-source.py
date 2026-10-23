"""Snapshot saved recovery evidence without API calls or overwriting old reports.

Conditions/tasks stay separate. Repeated attempts cannot supply a chosen pair.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import csv
import hashlib
import json
import math
from pathlib import Path
import statistics
import uuid

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "docs/research/baselines/results"
PROVENANCE = ("protocol_sha256", "adapter_sha256", "input_sha256", "configuration", "upstream")
METRICS = ("total_attempt_steps", "model_calls", "tool_executions", "validation_tool_calls",
           "total_tool_invocations", "cached_reads_reused", "duration", "estimated_attempt_cost_usd")


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def load_snapshot(paths):
    rows, sources, excluded, groups = [], [], [], {}
    seen = set()
    for path in sorted(Path(p).resolve() for p in paths):
        if path in seen:
            raise ValueError(f"Input listed twice: {path}")
        seen.add(path)
        try:
            raw = path.read_bytes()
        except OSError as exc:
            excluded.append({"path": str(path), "reason": type(exc).__name__})
            continue
        sha = hashlib.sha256(raw).hexdigest()
        try:
            doc = json.loads(raw)
        except (ValueError, UnicodeError):
            excluded.append({"path": str(path), "sha256": sha, "reason": "invalid_json_at_snapshot"})
            continue
        if not isinstance(doc, dict) or doc.get("action") != "tau-recovery" or not isinstance(doc.get("results"), list):
            excluded.append({"path": str(path), "sha256": sha, "reason": "not_recovery_artifact"})
            continue
        if not doc.get("ended_at") or not doc["results"]:
            excluded.append({"path": str(path), "sha256": sha, "reason": "unfinished_artifact"})
            continue
        if any(not isinstance(result, dict) for result in doc["results"]):
            excluded.append({"path": str(path), "sha256": sha, "reason": "invalid_result_schema"})
            continue
        conditions = {key: doc.get(key) for key in PROVENANCE}
        complete = all(conditions.values()) and all(
            isinstance(conditions[key], dict) for key in ("input_sha256", "configuration", "upstream"))
        config = doc.get("configuration") if isinstance(doc.get("configuration"), dict) else {}
        # Missing provenance cannot establish comparability by sharing nulls.
        identity = conditions if complete else {"conditions": conditions, "path": str(path), "sha256": sha}
        group = hashlib.sha256(canonical(identity).encode()).hexdigest()
        groups[group] = {"conditions": conditions, "provenance_complete": complete}
        sources.append({"path": str(path), "sha256": sha, "attempts": len(doc["results"]), "group": group})
        for index, result in enumerate(doc["results"]):
            config_seed = config.get("seed")
            row = {
                "group": group, "matrix": path.parent.name, "cell": path.stem, "result_index": index,
                "source_sha256": sha, "method_version": doc.get("method_version"),
                "adapter_hash": doc.get("adapter_sha256"), "protocol_hash": doc.get("protocol_sha256"),
                "task": str(result.get("task_id", "unknown")), "seed": result.get("seed"),
                "fault": result.get("fault", "unknown"), "strategy": result.get("strategy", "unknown"),
                "reward": result.get("reward") if number(result.get("reward")) else None,
                "fault_exercised": result.get("fault_exercised"),
                "provenance_valid": complete and result.get("seed") is not None
                    and (config_seed is None or config_seed == result.get("seed")),
                "execution_error_class": (result.get("execution_error") or "").split(":", 1)[0],
                "termination_reason": result.get("termination_reason", result.get("exit_reason")),
                "cost_usage_complete": result.get("cost_usage_complete") is True,
            }
            for metric in METRICS:
                value = result.get(metric)
                if metric == "duration" and value is None:
                    value = result.get("wall_seconds")
                row[metric] = value if number(value) else None
            for key in ("reflection_injected", "correction_delivered"):
                values = [e[key] for e in result.get("events", []) if key in e]
                row[key] = any(v is True for v in values) if values else None
            rows.append(row)
    return {"created_at_utc": datetime.now(timezone.utc).isoformat(), "rows": rows,
            "sources": sources, "excluded_sources": excluded, "groups": groups}


def graded_with_coverage(row):
    return number(row["reward"]) and (row["fault"] == "none" or row["fault_exercised"] is True)


def summarize(rows):
    buckets = defaultdict(list)
    for row in rows:
        buckets[(row["group"], row["task"], row["fault"], row["strategy"])].append(row)
    summaries = []
    for (group, task, fault, strategy), attempts in sorted(buckets.items()):
        graded = [r for r in attempts if number(r["reward"])]
        eligible = [r for r in attempts if graded_with_coverage(r)]
        identities = Counter(r["seed"] for r in attempts)
        summary = {"group": group, "task": task, "fault": fault, "strategy": strategy,
                   "attempts": len(attempts), "graded": len(graded), "ungraded": len(attempts) - len(graded),
                   "fault_exercised": sum(r["fault_exercised"] is True for r in attempts),
                   "fault_not_exercised": sum(r["fault_exercised"] is False for r in attempts),
                   "fault_coverage_unknown": sum(r["fault_exercised"] is not True and r["fault_exercised"] is not False for r in attempts),
                   "graded_with_coverage": len(eligible), "successful_with_coverage": sum(r["reward"] == 1 for r in eligible),
                   "mean_reward_with_coverage": statistics.mean(r["reward"] for r in eligible) if eligible else None,
                   "repeated_conditions": sum(count > 1 for count in identities.values()),
                   "extra_attempts_at_repeated_conditions": sum(count - 1 for count in identities.values()),
                   "provenance_invalid_attempts": sum(not r["provenance_valid"] for r in attempts)}
        for metric in METRICS:
            values = [r[metric] for r in eligible if number(r[metric])
                      and (metric != "estimated_attempt_cost_usd" or r["cost_usage_complete"])]
            summary[metric + "_n"] = len(values)
            summary[metric + "_mean"] = statistics.mean(values) if values else None
        for key in ("reflection_injected", "correction_delivered"):
            summary[key + "_true"] = sum(r[key] is True for r in attempts)
            summary[key + "_false"] = sum(r[key] is False for r in attempts)
        summaries.append(summary)
    return summaries


def matched_comparisons(rows):
    buckets = defaultdict(lambda: defaultdict(list))
    for row in rows:
        buckets[(row["group"], row["task"], row["fault"], row["seed"])][row["strategy"]].append(row)
    comparisons = []
    for (group, task, fault, seed), strategies in sorted(buckets.items(), key=lambda item: canonical(item[0])):
        contrasts = [("no_recovery", c) for c in sorted(strategies) if c != "no_recovery"]
        contrasts += [(a, b) for a, b in (("visible_retry", "verbal_correction"),
                                          ("source_rollback", "rollback_with_reflection"))
                      if a in strategies or b in strategies]
        for reference, candidate in contrasts:
            a, b = strategies.get(reference, []), strategies.get(candidate, [])
            comparison = {"group": group, "task": task, "fault": fault, "seed": seed,
                          "reference": reference, "candidate": candidate,
                          "reference_attempts": len(a), "candidate_attempts": len(b), "deltas": {}}
            if len(a) != 1 or len(b) != 1:
                status = "missing_or_ambiguous_pair"
            elif not all(r["provenance_valid"] for r in a + b):
                status = "incomplete_or_inconsistent_provenance"
            elif fault == "none" or not all(graded_with_coverage(r) for r in a + b):
                status = "ungraded_or_fault_not_exercised"
            else:
                status = "eligible"
                comparison["deltas"] = {m: b[0][m] - a[0][m] for m in ("reward",) + METRICS
                                        if number(a[0][m]) and number(b[0][m])
                                        and (m != "estimated_attempt_cost_usd" or
                                             (a[0]["cost_usage_complete"] and b[0]["cost_usage_complete"]))}
            comparison["status"] = status
            comparisons.append(comparison)
    return comparisons


def build_report(snapshot):
    rows = snapshot["rows"]
    report = dict(snapshot, summary=summarize(rows), comparisons=matched_comparisons(rows))
    report["analyzer"] = {"path": "Backend/research/build_results_table.py",
                          "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    report["totals"] = {"attempts": len(rows), "graded": sum(number(r["reward"]) for r in rows),
                        "ungraded": sum(not number(r["reward"]) for r in rows),
                        "groups": len(snapshot["groups"]), "source_files": len(snapshot["sources"]),
                        "excluded_sources": len(snapshot["excluded_sources"])}
    report["limitations"] = [
        "Only completed cell artifacts are included; excluded/in-progress files are listed explicitly.",
        "Full protocol, adapter, input, configuration and upstream identity, and task identity remain separate.",
        "Missing or inconsistent provenance cannot establish a matched comparison.",
        "Null rewards are ungraded, never reward zero. A fired fault need not affect downstream behavior.",
        "Unfaulted references are summarized separately and never enter recovery contrasts.",
        "Descriptive means retain repetitions; repeated identities cannot be arbitrarily paired.",
        "Each contrast needs exactly one attempt per method, both graded with the fault exercised.",
        "Positive deltas mean candidate minus reference. Contrasts share attempts and are not independent samples.",
        "Seeds do not guarantee identical model/user trajectories; no causal or significance claim is made.",
        "Work means use graded covered attempts with measurements; missing overhead is never zero.",
    ]
    return report


def write_csv(path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def write_dashboard_html(report, out_path):
    payload = {k: report[k] for k in ("created_at_utc", "groups", "summary", "comparisons", "totals", "limitations")}
    data = json.dumps(payload, ensure_ascii=True).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    page = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recovery evidence snapshot</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:32px auto;padding:0 20px;max-width:1400px;background:#fafaf9;color:#202020}h1{font-size:25px}h2{font-size:20px;margin-top:30px}label{display:inline-block;margin:8px 20px 8px 0}select{max-width:90vw;padding:7px}table{border-collapse:collapse;width:100%;font-size:13px;background:white}th,td{border:1px solid #ddd;padding:8px;text-align:left;white-space:nowrap}th{background:#eee}pre{white-space:pre-wrap;font-size:12px;background:#eee;padding:14px}section{overflow-x:auto}.note{color:#555}</style>
<h1>Recovery evidence snapshot</h1><p id="totals"></p><p class="note">Descriptive results. Conditions and tasks remain separate. Missing rewards and repetitions remain visible.</p>
<label>Recorded conditions <select id="group"></select></label><label>Task <select id="task"></select></label>
<details><summary>Selected provenance</summary><pre id="conditions"></pre></details>
<h2>Outcomes and coverage</h2><section><table><thead><tr><th>Fault</th><th>Strategy</th><th>Attempts</th><th>Graded</th><th>Ungraded</th><th>Fault fired</th><th>Success / covered graded</th><th>Mean reward</th><th>Repeated conditions</th><th>Total tools (mean; n)</th><th>Cache hits (mean; n)</th><th>Reflection delivered (yes / no)</th><th>Correction delivered (yes / no)</th></tr></thead><tbody id="outcomes"></tbody></table></section>
<h2>Matched contrasts</h2><p class="note">Exactly one attempt per method is required. Positive deltas are candidate minus reference.</p>
<section><table><thead><tr><th>Fault / seed</th><th>Reference</th><th>Candidate</th><th>Attempts ref / candidate</th><th>Status</th><th>Reward delta</th><th>Total tools delta</th></tr></thead><tbody id="pairs"></tbody></table></section>
<h2>Interpretation limits</h2><ul id="limits"></ul><script>
const DATA = __DATA__;
const group=document.getElementById('group'),task=document.getElementById('task');
const fmt=x=>x===null||x===undefined?'unrecorded':Number.isInteger(x)?String(x):x.toFixed(3);
function row(body,values){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td)}body.appendChild(tr)}
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}
for(const id of Object.keys(DATA.groups)){const c=DATA.groups[id].conditions;option(group,id,`${id.slice(0,10)} | adapter ${(c.adapter_sha256||'missing').slice(0,8)} | seed ${(c.configuration||{}).seed??'unknown'}`)}
function render(){const id=group.value,t=task.value;document.getElementById('conditions').textContent=JSON.stringify(DATA.groups[id]||{},null,2);const out=document.getElementById('outcomes'),pairs=document.getElementById('pairs');out.replaceChildren();pairs.replaceChildren();
for(const r of DATA.summary.filter(r=>r.group===id&&r.task===t))row(out,[r.fault,r.strategy,r.attempts,r.graded,r.ungraded,`${r.fault_exercised}; unknown ${r.fault_coverage_unknown}`,`${r.successful_with_coverage} / ${r.graded_with_coverage}`,fmt(r.mean_reward_with_coverage),`${r.repeated_conditions}; extra ${r.extra_attempts_at_repeated_conditions}`,`${fmt(r.total_tool_invocations_mean)}; n=${r.total_tool_invocations_n}`,`${fmt(r.cached_reads_reused_mean)}; n=${r.cached_reads_reused_n}`,`${r.reflection_injected_true} / ${r.reflection_injected_false}`,`${r.correction_delivered_true} / ${r.correction_delivered_false}`]);
for(const p of DATA.comparisons.filter(p=>p.group===id&&p.task===t))row(pairs,[`${p.fault} / ${p.seed}`,p.reference,p.candidate,`${p.reference_attempts} / ${p.candidate_attempts}`,p.status,fmt(p.deltas.reward),fmt(p.deltas.total_tool_invocations)]);}
function selectGroup(){task.replaceChildren();for(const t of [...new Set(DATA.summary.filter(r=>r.group===group.value).map(r=>r.task))].sort())option(task,t,t);render()}
group.addEventListener('change',selectGroup);task.addEventListener('change',render);const t=DATA.totals;document.getElementById('totals').textContent=`${t.attempts} attempts: ${t.graded} graded, ${t.ungraded} ungraded. ${t.groups} condition groups. ${t.excluded_sources} excluded files. Snapshot ${DATA.created_at_utc}`;
for(const text of DATA.limitations){const li=document.createElement('li');li.textContent=text;document.getElementById('limits').appendChild(li)}selectGroup();</script></html>"""
    Path(out_path).write_text(page.replace("__DATA__", data), encoding="utf-8")


def write_report(report, output):
    output = Path(output)
    analyzer_source = Path(__file__).read_bytes()
    if hashlib.sha256(analyzer_source).hexdigest() != report["analyzer"]["sha256"]:
        raise RuntimeError("Analyzer changed after snapshot construction; rebuild the report")
    output.mkdir(parents=True, exist_ok=False)
    (output / "analysis-source.py").write_bytes(analyzer_source)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    write_csv(output / "results_table.csv", report["rows"])
    write_csv(output / "summary_table.csv", report["summary"])
    comparisons = [{**{k: v for k, v in p.items() if k != "deltas"},
                    **{m + "_delta": p["deltas"].get(m) for m in ("reward",) + METRICS}}
                   for p in report["comparisons"]]
    write_csv(output / "matched_comparisons.csv", comparisons)
    write_dashboard_html(report, output / "results_dashboard.html")
    totals = report["totals"]
    lines = ["# Recovery evidence snapshot", "", f"Created: {report['created_at_utc']}", "",
             f"Attempts: {totals['attempts']}; graded: {totals['graded']}; ungraded: {totals['ungraded']}; condition groups: {totals['groups']}.", "",
             "[Interactive results](results_dashboard.html), [report and source hashes](report.json), "
             "[attempts](results_table.csv), [summaries](summary_table.csv), [contrasts](matched_comparisons.csv).", "",
             "## Limits", ""] + ["- " + limit for limit in report["limitations"]]
    lines += ["", "## Excluded files", ""]
    lines += [f"- `{r['path']}`: {r['reason']}" for r in report["excluded_sources"]] or ["None."]
    (output / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results-dir", type=Path, default=RESULTS_DIR)
    parser.add_argument("--output-dir", type=Path, help="New directory; default is a timestamped evidence snapshot")
    args = parser.parse_args()
    output = args.output_dir or ROOT / "docs/research/evidence" / (
        "tables-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:6])
    report = build_report(load_snapshot(args.results_dir.glob("tau-matrix-*/cell-*.json")))
    write_report(report, output)
    print(json.dumps({"output_dir": str(output), **report["totals"]}, indent=2))


if __name__ == "__main__":
    main()
