"""Build a PDF report and evidence figures from saved results. No API calls.

Usage: python docs/research/progress-report-1/build_report.py --github URL
Requires PyMuPDF and matplotlib in the document-building Python environment.
"""
import argparse
import html
import json
from pathlib import Path

import fitz
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
parser = argparse.ArgumentParser()
parser.add_argument("--github", default="")
args = parser.parse_args()
rows = json.loads((EVIDENCE / "recovery-benchmark.json").read_text())["results"]
live = json.loads((EVIDENCE / "archived-live-summary.json").read_text())
assert len(live["results"]) == 3 and all(r["success"] for r in live["results"])
test_output = (EVIDENCE / "backend-tests.txt").read_text()
assert "Ran 15 tests" in test_output and "\nOK" in test_output
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11})

# Draw precisely the original seven-node benchmark graph, not an idealized workflow.
fig, ax = plt.subplots(figsize=(10, 4.4))
positions = {"1": (0, 2.4), "2": (0, .9), "3": (2.8, 1.65), "4": (2.8, -.05),
             "5": (5.6, -.05), "6": (5.6, 1.65), "7": (8.4, 1.65)}
labels = {"1": "1  Student", "2": "2  Requirements", "3": "3  Remaining courses\nInjected wrong result",
          "4": "4  Catalog", "5": "5  Sections", "6": "6  Proposal", "7": "7  Validator\nDelayed detection"}
edges = [("1", "3"), ("2", "3"), ("3", "6"), ("4", "6"), ("4", "5"),
         ("1", "7"), ("2", "7"), ("6", "7")]
for u, v in edges:
    x, y = positions[u]; xx, yy = positions[v]
    bend = -.36 if (u, v) == ("1", "7") else .46 if (u, v) == ("2", "7") else 0
    ax.annotate("", xy=(xx-.99, yy), xytext=(x+.99, y),
                arrowprops=dict(arrowstyle="->", color="#728096", lw=1.3,
                                connectionstyle=f"arc3,rad={bend}"), zorder=1)
for key, (x, y) in positions.items():
    color = "#F9D6D3" if key == "3" else "#FDEAC5" if key in {"6", "7"} else "#DDEDE6"
    ax.add_patch(FancyBboxPatch((x-1, y-.32), 2, .64, boxstyle="round,pad=.03,rounding_size=.08",
                              facecolor=color, edgecolor="#8A939F", zorder=2))
    ax.text(x, y, labels[key], ha="center", va="center", fontsize=10, zorder=3)
ax.set_xlim(-1.2, 9.6); ax.set_ylim(-.65, 3.4); ax.axis("off")
ax.text(-1.1, 3.15, "Observed dependency graph: one controlled synthetic fault", weight="bold", fontsize=13)
ax.text(-1.1, -.52, "Selective replay: 3, 6, 7     |     Retained correct nodes: 1, 2, 4, 5", fontsize=11)
fig.tight_layout()
fig.savefig(EVIDENCE / "dependency-graph.png", dpi=180, bbox_inches="tight", facecolor="white")
plt.close(fig)

names = {"restart": "Full restart", "visible_retry": "Visible-step retry", "checkpoint": "Latest checkpoint",
         "source_rollback": "Located suffix rollback", "selective": "Selective recovery"}
fig, ax = plt.subplots(figsize=(9, 4.5))
bars = ax.barh([names[r["strategy"]] for r in rows][::-1], [r["repeated_steps"] for r in rows][::-1],
               color=["#28765C" if r["success"] else "#A8AEB7" for r in rows][::-1])
for bar, row in zip(bars, rows[::-1]):
    ax.text(bar.get_width()+.12, bar.get_y()+bar.get_height()/2,
            f"{row['repeated_steps']}  |  {'recovered' if row['success'] else 'unresolved'}", va="center", fontsize=10)
ax.set_xlim(0, 9.8); ax.set_xticks(range(8)); ax.set_xlabel("Repeated workflow steps (diagnosis excluded)")
ax.set_title("Demo 0: one deterministic scenario, October 7, 2026", loc="left", fontsize=13, pad=16)
ax.spines[["top", "right"]].set_visible(False)
fig.text(.02, .015, "Suffix and selective recovery each add one diagnostic step. No Gemini calls; no statistical comparison.", fontsize=9)
fig.tight_layout(rect=(0, .05, 1, 1))
fig.savefig(EVIDENCE / "recovery-comparison.png", dpi=180, bbox_inches="tight", facecolor="white")
plt.close(fig)

github = (f'<a href="{html.escape(args.github, quote=True)}">{html.escape(args.github)}</a>'
          if args.github else "Repository URL: to be added by Oludolapo before submission.")
table_rows = "".join(f"<tr><td>{names[r['strategy']]}</td><td>{'Yes' if r['success'] else 'No'}</td>"
                     f"<td>{r['repeated_steps']}</td><td>{r['diagnostic_steps']}</td>"
                     f"<td>{r['preserved_valid_steps']}</td></tr>" for r in rows)
live_rows = "".join(f"<tr><td>{r['run']}</td><td>{r['predicted_source_step']}</td><td>Yes</td>"
                    f"<td>{r['invalidation_f1']:.1f}</td><td>{r['tokens']}</td></tr>" for r in live["results"])

pages = [f"""
<p class="eyebrow">SENIOR SEMINAR II / OCTOBER 7, 2026</p>
<h1>Progress Report 1</h1>
<p class="subtitle">Selective State Recovery for Reliable AI Agents</p>
<p><b>Oludolapo Adegbesan</b><br>Case study: Fisk University, B.S. in Computer Science</p>
<h2>1. Project Overview</h2>
<p>My project investigates how a tool-using AI agent can recover when an early error becomes visible several steps later. The research question is how to identify a safe recovery boundary, invalidate affected results, and preserve correct independent work. Academic planning supplies structured tasks and rules that can be checked with code. The planned case study uses Fisk's Computer Science requirements from the university catalog and entirely synthetic student records.</p>
<h2>2. Work Completed</h2>
<p>A Python prototype now supports a bounded Gemini tool loop, structured course-plan proposals, deterministic checks, and execution traces. The planning tools read student, requirement, and catalog fixtures, audit progress, and check a proposal. Checks cover unknown or duplicate courses, already completed courses, supported prerequisites and corequisites, and the prototype's 18-credit semester limit. They do not certify official degree completion.</p>
<p>The trace layer records inputs, outputs, dependencies, statuses, timing, and usage. Recovery invalidates a selected source and its descendants while retaining unaffected nodes. Five strategies are implemented in a deterministic comparison: full restart, visible-step retry, latest-checkpoint recovery, located suffix rollback, and dependency-selective recovery.</p>
<p>On October 7, I reproduced the comparison and verified all 15 current backend tests. Existing live Gemini recovery traces were also checked. A draft evaluation protocol identifies data-provenance requirements, candidate tracing rules, and a proposed 12-scenario matrix; these remain planned benchmark work.</p>
<p class="note"><b>Current evidence boundary:</b> The working demonstration uses a small illustrative nine-credit degree and synthetic courses. The fixtures have not yet been reconciled with Fisk's catalog. Today's deterministic run and the earlier live smoke tests establish prototype feasibility, not general recovery effectiveness.</p>
<p class="small">Project repository: {github}</p>
""", f"""
<h2>3. Evidence of Progress</h2>
<p><b>Fresh reproducible comparison.</b> The seven-step workflow deliberately returns an empty remaining-course list at step 3. Proposal generation consumes that result, and final validation at step 7 detects the missing requirements. The independent catalog and section branch remains correct.</p>
<img src="dependency-graph.png" width="468">
<p class="caption">Figure 1. Actual Demo 0 dependencies. Step 3 is the injected source; steps 6 and 7 are affected descendants. The section lookup is retained but is not consumed by the final proposal.</p>
<table><tr><th>Recovery strategy</th><th>Valid<br>result</th><th>Repeated<br>steps</th><th>Diagnosis<br>steps</th><th>Correct nodes<br>retained</th></tr>{table_rows}</table>
<p class="caption">Table 1. October 7 deterministic run. Repeated steps exclude diagnosis. “Retained” counts initially correct nodes left valid; it is not a measure of their usefulness to the final answer. Retry and checkpoint retain the corrupted source and fail.</p>
<p>Selective recovery repeats three workflow steps versus seven for restart and five for suffix rollback. Suffix and selective recovery each perform one additional diagnostic step. This result applies only to the constructed scenario. The benchmark makes zero Gemini calls, so its timings cannot establish model latency or cost savings.</p>
<p><b>Code and raw evidence.</b> The implementation is in <code>Backend/app/agent/</code>. The comparison is in <code>Backend/research/benchmark.py</code>; the live locator harness is in <code>Backend/research/agent_recovery_demo.py</code>. The submission evidence folder includes the complete fresh benchmark trace, console table, passing test log, graph, comparison figure, and a hash manifest.</p>
""", f"""
<h2>3. Evidence of Progress (continued)</h2>
<p><b>Earlier live model smoke tests.</b> The saved recovery artifact contains three calls using <code>gemini-3.5-flash-lite</code>. Gemini received the observable trace and validator evidence, without the hidden injected-source label. It predicted step 3 each time; graph-based replay then recovered the result.</p>
<table><tr><th>Run</th><th>Predicted<br>source</th><th>Recovered</th><th>Invalidation<br>F1</th><th>Total<br>tokens</th></tr>{live_rows}</table>
<p class="caption">Table 2. Earlier live smoke tests documented in the September 15 research log; audited October 7. All runs repeat the same scenario. These are not three distinct fault cases or new API executions today.</p>
<p><b>Verification.</b> All 15 current tests pass. They cover dependency invalidation, independent-branch caching, incorrect localization, transient reads, plan correction, prerequisite order, invalid courses, failed-course handling, trace hashing, model/tool round trips, and execution limits. Model interactions in unit tests are mocked; the separate saved live traces supply API evidence.</p>
<h2>4. Challenges</h2>
<p><b>Delayed errors and incomplete attribution.</b> Retrying the validator or restoring a late checkpoint can preserve the bad intermediate result. The prototype demonstrates local consistency diagnosis and descendant invalidation, but generalized unknown-source localization remains unfinished. The full tracing and conservative reuse rules must be implemented and tested across more faults.</p>
<p><b>Provider and transport failures.</b> Earlier live planning attempts encountered timeouts, HTTP 503 responses, and HTTP 429 quota errors. The recovery smoke tests used a separately available model, recorded in the artifact. Unsupported structured-output constraints were removed from transport schemas while returned source IDs remained locally checked. The harness now requires completion and valid output before reporting success.</p>
<p><b>Research scope and academic ground truth.</b> Related work already includes constraint-based diagnosis and dependency-aware replay. I therefore frame this as a controlled integration study. Catalog rules must be independently checked; the current validator has partial coverage, and illustrative courses cannot be presented as official Fisk requirements.</p>
<h2>5. Next Steps</h2>
<p>Before the next report, I plan to freeze the selected Fisk catalog sources; create three wholly synthetic student profiles; bind 12 proposed transcript, requirement, catalog, and proposal faults to verified rules; and independently check expected results. I will then implement the evidence-tracing and safe-boundary procedure, expand the runner, and freeze repeated-trial counts and API budgets before collecting a comparative dataset. The five existing recovery strategies remain the proposal's baseline set; the smaller primary comparison in the draft protocol is still a scope decision.</p>
<p class="small"><b>Academic source:</b> <a href="https://www.fisk.edu/academics/university-bulletins/">Fisk University bulletin index</a> and its linked <a href="https://fisk.smartcatalogiq.com/en/bulletin/undergraduate">2024-2025 Undergraduate Bulletin</a> (checked October 7). <b>Evidence:</b> <code>docs/research/progress-report-1/evidence/</code>; original live artifact: <code>logs/agent-recovery-runs.json</code>.</p>
"""]

css = """
body { font-family: sans-serif; font-size: 10.8pt; line-height: 1.28; color: #202832; }
h1 { font-size: 24pt; margin: 5pt 0 8pt; color: #1f4d78; }
h2 { font-size: 14pt; margin: 13pt 0 7pt; color: #1f4d78; }
p { margin: 0 0 8pt; }
.eyebrow { font-size: 9pt; color: #596779; letter-spacing: .5pt; }
.subtitle { font-size: 14pt; margin-bottom: 10pt; }
.small, .caption { font-size: 9pt; line-height: 1.2; color: #4d5968; }
.note { background-color: #f2f4f7; padding: 9pt; }
table { border-collapse: collapse; width: 100%; font-size: 9.4pt; margin: 7pt 0; }
th { background-color: #f2f4f7; font-weight: bold; }
td, th { padding: 6pt 5pt; border: .5pt solid #cbd2db; text-align: center; }
td:first-child { text-align: left; }
code { font-family: monospace; font-size: 8.3pt; }
a { color: #1f4d78; }
img { margin: 2pt 0; }
"""
doc = fitz.open()
archive = fitz.Archive(str(EVIDENCE))
for index, body in enumerate(pages, 1):
    page = doc.new_page(width=612, height=792)
    remaining, scale = page.insert_htmlbox(fitz.Rect(72, 55, 540, 735), body, css=css, archive=archive, scale_low=1)
    if remaining < 0 or scale != 1:
        raise RuntimeError(f"Page {index} overflows; adjust content, never shrink to fit: {remaining}, {scale}")
    page.insert_text((72, 760), "Oludolapo Adegbesan | Senior Seminar II | Progress Report 1", fontsize=8, color=(.35,.4,.46))
    page.insert_text((518, 760), str(index), fontsize=8, color=(.35,.4,.46))
doc.set_metadata({"title": "Progress Report 1 - Selective State Recovery for Reliable AI Agents",
                  "author": "Oludolapo Adegbesan", "subject": "Senior Seminar II"})
pdf = HERE / "progress-report-1.pdf"
doc.save(pdf)
qa = HERE / "qa"
qa.mkdir(exist_ok=True)
for index, page in enumerate(doc, 1):
    page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(qa / f"page-{index}.png")
(HERE / "progress-report-1.html").write_text(
    '<!doctype html><html><head><meta charset="utf-8"><title>Progress Report 1</title>'
    f'<style>{css} section {{page-break-after:always; max-width:6.5in; margin:1in auto;}}</style></head><body>'
    + "".join(f'<section>{body.replace(chr(34)+"dependency-graph.png"+chr(34), chr(34)+"evidence/dependency-graph.png"+chr(34))}</section>' for body in pages)
    + '</body></html>', encoding="utf-8")
print(f"Built {pdf} ({len(doc)} pages); all pages fit at original font sizes.")
