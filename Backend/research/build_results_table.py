"""
Aggregate all tau-recovery matrix results into a clean table.
Reads every cell-*.json under docs/research/baselines/results/tau-matrix-*/
and produces:
  - docs/research/baselines/results/results_table.csv  — one row per cell
  - docs/research/baselines/results/summary_table.csv  — mean reward by fault x strategy (fault_exercised only)
  - Printed reward grid to stdout
"""
import json, csv, pathlib, statistics
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "docs/research/baselines/results"

STRATEGIES = ["no_recovery", "restart", "visible_retry", "checkpoint", "source_rollback", "selective",
              "rollback_with_reflection", "verbal_correction", "adaptive"]
FAULTS     = ["empty_read", "wrong_user_id", "tool_error"]

def load_all_cells():
    rows = []
    for mx_dir in sorted(RESULTS_DIR.glob("tau-matrix-*")):
        for cell_file in sorted(mx_dir.glob("cell-*.json")):
            try:
                data = json.loads(cell_file.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"  SKIP {cell_file}: {e}")
                continue
            for res in data.get("results", []):
                rows.append({
                    "matrix":          mx_dir.name,
                    "cell":            cell_file.stem,
                    "task":            res.get("task_id", "?"),
                    "seed":            res.get("seed", "?"),
                    "fault":           res.get("fault", "none"),
                    "strategy":        res.get("strategy", "?"),
                    "reward":          res.get("reward"),
                    "fault_exercised": res.get("fault_exercised", None),
                    "steps":           res.get("total_attempt_steps"),
                    "tool_execs":      res.get("tool_executions"),
                    "wall_seconds":    res.get("wall_seconds"),
                    "exit_reason":     res.get("exit_reason", ""),
                    "adapter_hash":    (data.get("adapter_sha256") or "")[:8],
                    "protocol_hash":   (data.get("protocol_sha256") or "")[:8],
                })
    return rows

def print_grid(rows):
    # Only include cells where fault was exercised (or fault=none for baseline)
    exercised = [r for r in rows if r["fault_exercised"] or r["fault"] == "none"]
    # Group: (task, fault) -> strategy -> list of rewards
    grid = defaultdict(lambda: defaultdict(list))
    for r in exercised:
        if r["reward"] is None:
            continue
        key = (r["task"], r["fault"])
        grid[key][r["strategy"]].append(r["reward"])

    print("\n=== REWARD GRID (fault_exercised=True only, mean over seeds) ===")
    header = f"{'task-fault':<22}" + "".join(f"{s:<16}" for s in STRATEGIES)
    print(header)
    print("-" * (22 + 16 * len(STRATEGIES)))
    for (task, fault) in sorted(grid.keys()):
        row_str = f"{str(task)+'-'+fault:<22}"
        for strat in STRATEGIES:
            vals = grid[(task, fault)][strat]
            if not vals:
                row_str += f"{'—':<16}"
            else:
                mean = statistics.mean(vals)
                n    = len(vals)
                row_str += f"{mean:.2f} (n={n})".ljust(16)
        print(row_str)

    print("\n=== FULL CELL COUNT BY FAULT x STRATEGY (all seeds) ===")
    all_grid = defaultdict(lambda: defaultdict(list))
    for r in rows:
        if r["reward"] is None:
            continue
        key = (r["task"], r["fault"])
        all_grid[key][r["strategy"]].append(r)

    header2 = f"{'task-fault':<22}" + "".join(f"{s:<16}" for s in STRATEGIES)
    print(header2)
    print("-" * (22 + 16 * len(STRATEGIES)))
    for (task, fault) in sorted(all_grid.keys()):
        row_str = f"{str(task)+'-'+fault:<22}"
        for strat in STRATEGIES:
            cells = all_grid[(task, fault)][strat]
            if not cells:
                row_str += f"{'—':<16}"
            else:
                rewards = [c["reward"] for c in cells]
                exercised_count = sum(1 for c in cells if c["fault_exercised"])
                mean = statistics.mean(rewards)
                row_str += f"{mean:.2f} [{exercised_count}/{len(cells)} ex]".ljust(16)
        print(row_str)

def write_csvs(rows):
    flat_path = RESULTS_DIR / "results_table.csv"
    cols = ["matrix","cell","task","seed","fault","strategy","reward",
            "fault_exercised","steps","tool_execs","wall_seconds","exit_reason",
            "adapter_hash","protocol_hash"]
    with open(flat_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c,"") for c in cols})
    print(f"\nWrote {len(rows)} rows -> {flat_path.relative_to(ROOT)}")

    # Summary: mean reward by fault x strategy (fault_exercised only)
    exercised = [r for r in rows if (r["fault_exercised"] or r["fault"]=="none") and r["reward"] is not None]
    summary = defaultdict(lambda: defaultdict(list))
    for r in exercised:
        summary[(r["task"], r["fault"])][r["strategy"]].append(r["reward"])

    sum_path = RESULTS_DIR / "summary_table.csv"
    with open(sum_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["task","fault","strategy","mean_reward","n","seeds"])
        for (task, fault) in sorted(summary.keys()):
            for strat in STRATEGIES:
                vals = summary[(task,fault)][strat]
                if vals:
                    w.writerow([task, fault, strat, f"{statistics.mean(vals):.3f}", len(vals), ""])
    print(f"Wrote summary    -> {sum_path.relative_to(ROOT)}")

def print_fault_coverage(rows):
    print("\n=== FAULT EXERCISE COVERAGE BY SEED x FAULT ===")
    cov = {}
    for r in rows:
        if r["fault"] == "none":
            continue
        k = (r["task"], r["seed"], r["fault"])
        if k not in cov:
            cov[k] = {"total": 0, "exercised": 0}
        cov[k]["total"] += 1
        if r["fault_exercised"]:
            cov[k]["exercised"] += 1

    header = f"{'task-seed-fault':<30} exercised/total"
    print(header)
    for key in sorted(cov.keys()):
        task, seed, fault = key
        d = cov[key]
        print(f"  {str(task)+'-'+str(seed)+'-'+fault:<28} {d['exercised']}/{d['total']}")

def build_js_data(rows):
    """Return a JS const declaration with all cell data for the dashboard."""
    import json as _json
    cells = []
    for r in rows:
        if r["reward"] is None:
            continue
        cells.append({
            "seed":     r["seed"],
            "fault":    r["fault"],
            "strategy": r["strategy"],
            "reward":   r["reward"],
            "exercised": bool(r["fault_exercised"]),
        })
    # Coverage
    cov = {}
    for r in rows:
        if r["fault"] == "none":
            continue
        k = f"{r['seed']}-{r['fault']}"
        if k not in cov:
            cov[k] = {"seed": r["seed"], "fault": r["fault"], "ex": 0, "total": 0}
        cov[k]["total"] += 1
        if r["fault_exercised"]:
            cov[k]["ex"] += 1
    cov_list = sorted(cov.values(), key=lambda x: (x["seed"], x["fault"]))
    last_matrix = max((r["matrix"] for r in rows), default="?")
    total_cells = len(set((r["matrix"], r["cell"]) for r in rows))
    return _json.dumps({"cells": cells, "coverage": cov_list,
                        "last_matrix": last_matrix, "total_cells": total_cells}, indent=2)


def write_dashboard_html(rows, out_path):
    """Write a self-contained results dashboard HTML to out_path."""
    data_json = build_js_data(rows)
    html = r"""<title>Recovery Results</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{--bg:#f8f8f7;--surface:#fff;--border:#e0ddd8;--fg:#1a1917;--fg2:#5a5753;--accent:#2563eb;--good:#16a34a;--warn:#d97706;--bad:#dc2626;--na:#94908a;--good-bg:#dcfce7;--warn-bg:#fef3c7;--bad-bg:#fee2e2;--na-bg:#f0eeec;--mono:'IBM Plex Mono','Courier New',monospace;--sans:'IBM Plex Sans',system-ui,sans-serif;color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141412;--surface:#1f1e1c;--border:#2e2c29;--fg:#e8e5e0;--fg2:#888480;--good-bg:#14532d;--warn-bg:#451a03;--bad-bg:#450a0a;--na-bg:#2a2825;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141412;--surface:#1f1e1c;--border:#2e2c29;--fg:#e8e5e0;--fg2:#888480;--good-bg:#14532d;--warn-bg:#451a03;--bad-bg:#450a0a;--na-bg:#2a2825;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--fg);font-family:var(--sans);font-size:14px;line-height:1.5;padding-inline:16px;padding-block:24px}
header{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-block-end:16px;border-bottom:1px solid var(--border);margin-block-end:24px}
h1{font-size:18px;font-weight:600;letter-spacing:-.3px}
.meta{font-size:12px;color:var(--fg2);font-family:var(--mono)}
h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--fg2);margin-block-end:10px}
section{margin-block-end:36px}
.controls{display:flex;gap:8px;margin-block-end:14px;flex-wrap:wrap}
.toggle-btn{font:500 12px var(--sans);padding:4px 12px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--fg2);cursor:pointer;transition:background .15s,color .15s}
.toggle-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.grid-wrap{overflow-x:auto}
table{border-collapse:collapse;min-width:600px;width:100%;font-size:12px}
thead th{background:var(--surface);border:1px solid var(--border);padding:7px 10px;font-family:var(--mono);font-weight:500;font-size:11px;white-space:nowrap;text-align:center;color:var(--fg2)}
thead th:first-child{text-align:left;min-width:120px}
tbody td{border:1px solid var(--border);padding:6px 10px;text-align:center;font-family:var(--mono);white-space:nowrap}
tbody tr:first-child td{border-top:2px solid var(--border)}
tbody td:first-child{text-align:left;font-weight:500;font-size:11px;color:var(--fg2);background:var(--surface)}
.cell-good{background:var(--good-bg);color:var(--good);font-weight:600}
.cell-warn{background:var(--warn-bg);color:var(--warn);font-weight:500}
.cell-bad{background:var(--bad-bg);color:var(--bad)}
.cell-na{background:var(--na-bg);color:var(--na);font-size:11px}
.cov-pct{display:inline-block;height:8px;background:var(--accent);opacity:.5;border-radius:2px;vertical-align:middle;margin-inline-start:6px}
.note{font-size:11px;color:var(--fg2);margin-block-start:8px;font-style:italic}
</style>
<header>
  <div><h1>Recovery Results — tau-bench Retail</h1><div class="meta" id="meta-line">loading…</div></div>
  <div class="controls">
    <button class="toggle-btn active" onclick="setMode('exercised')">Fault exercised only</button>
    <button class="toggle-btn" onclick="setMode('all')">All cells</button>
  </div>
</header>
<section>
  <h2>Reward Grid — task 0 <span id="mode-label" style="text-transform:none;font-weight:400;color:var(--fg)">(fault_exercised=True, mean over seeds)</span></h2>
  <div class="grid-wrap"><table><thead><tr><th>fault</th><th>no_recovery</th><th>restart</th><th>visible_retry</th><th>checkpoint</th><th>source_rollback</th><th>selective</th><th>rollback_w_refl</th><th>verbal_corr</th><th>adaptive</th></tr></thead><tbody id="tbl"></tbody></table></div>
  <div class="note" id="ex-note">Only cells where the fault was injected and observed are counted.</div>
</section>
<section>
  <h2>Fault Exercise Coverage</h2>
  <div class="grid-wrap"><table><thead><tr><th style="text-align:left">seed</th><th style="text-align:left">fault</th><th style="text-align:left">exercised/total</th><th style="text-align:left">rate</th></tr></thead><tbody id="cov"></tbody></table></div>
  <div class="note">Low coverage (&lt;70%) means agent bypassed get_user_details via an alternate path.</div>
</section>
<script>
const DATA = """ + data_json + r""";
const STRATS=["no_recovery","restart","visible_retry","checkpoint","source_rollback","selective","rollback_with_reflection","verbal_correction","adaptive"];
const FAULTS=["empty_read","wrong_user_id","tool_error"];
let mode="exercised";
document.getElementById("meta-line").textContent=`task 0 · ${DATA.total_cells} cells from ${DATA.last_matrix.slice(0,26)}…`;
function cls(v){if(v===null)return"cell-na";if(v>=.9)return"cell-good";if(v>=.45)return"cell-warn";return"cell-bad";}
function buildGrid(){
  const body=document.getElementById("tbl");body.innerHTML="";
  for(const fault of FAULTS){
    const tr=document.createElement("tr");
    const td0=document.createElement("td");td0.textContent=fault;tr.appendChild(td0);
    for(const st of STRATS){
      const vals=DATA.cells.filter(c=>c.fault===fault&&c.strategy===st&&(mode==="all"||c.exercised)).map(c=>c.reward);
      const td=document.createElement("td");
      if(!vals.length){td.className="cell-na";td.textContent="—";}
      else{const m=vals.reduce((a,b)=>a+b,0)/vals.length;td.className=cls(m);td.innerHTML=`${m.toFixed(2)}<span style="font-size:10px;opacity:.65"> n=${vals.length}</span>`;}
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}
function buildCov(){
  const body=document.getElementById("cov");body.innerHTML="";
  for(const row of DATA.coverage){
    const pct=Math.round(row.ex/row.total*100);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${row.seed}</td><td>${row.fault}</td><td>${row.ex}/${row.total}</td><td>${pct}%<span class="cov-pct" style="width:${pct*.7}px"></span>${pct<70?"<span style='color:var(--warn);font-size:11px'> ⚠ low</span>":""}</td>`;
    body.appendChild(tr);
  }
}
function setMode(m){
  mode=m;
  document.querySelectorAll(".toggle-btn").forEach((b,i)=>b.classList.toggle("active",i===(m==="exercised"?0:1)));
  document.getElementById("mode-label").textContent=m==="exercised"?"(fault_exercised=True, mean over seeds)":"(all cells including unexercised)";
  document.getElementById("ex-note").style.display=m==="exercised"?"":"none";
  buildGrid();
}
buildGrid();buildCov();
</script>"""
    pathlib.Path(out_path).write_text(html, encoding="utf-8")
    print(f"Wrote dashboard   -> {pathlib.Path(out_path).relative_to(ROOT)}")


if __name__ == "__main__":
    rows = load_all_cells()
    print(f"Loaded {len(rows)} cells from {len(set(r['matrix'] for r in rows))} matrix runs")
    print_fault_coverage(rows)
    print_grid(rows)
    write_csvs(rows)
    write_dashboard_html(rows, ROOT / "docs/research/baselines/results/results_dashboard.html")
