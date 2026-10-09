"""Build the October 8 submission from preserved evidence; no live API calls."""
import hashlib
import html
import json
from pathlib import Path
import fitz

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
E = HERE / "evidence"
PILOT = ROOT / "docs/research/baselines/results/tau-recovery-pilot-paced-20261007/recovery-results.json"
load = lambda p: json.loads(p.read_text(encoding="utf-8"))
pilot = load(PILOT)
pair = {r["strategy"]: r for r in pilot["results"]}
a, b = pair["no_recovery"], pair["selective"]
assert all(r["reward"] == 1 and r["fault_exercised"] for r in pair.values())
synthetic = load(E / "recovery-benchmark.json")["results"]
fisk = load(E / "fisk-case-study-20261007.json")
checks = load(E / "research-verification-20261007.json")
assert all(c["exit_code"] == 0 for c in checks["checks"])
github = "https://github.com/Havcker243/plan-my-path"
names = {"restart":"Full restart", "visible_retry":"Visible-step retry", "checkpoint":"Simulated late checkpoint", "source_rollback":"Source rollback", "selective":"Selective recovery"}
syn_rows = ''.join(f"<tr><td>{names[r['strategy']]}</td><td>{'Yes' if r['success'] else 'No'}</td><td>{r['repeated_steps']}</td><td>{r['diagnostic_steps']}</td><td>{r['preserved_valid_steps']}</td></tr>" for r in synthetic)
metrics = [("Official reward","reward",lambda v:f"{v:.1f}"),("Attempt steps","total_attempt_steps",str),("Model calls","model_calls",str),("Task tool executions","tool_executions",str),("Validation tool calls","validation_tool_calls",str),("Cached reads reused","cached_reads_reused",str),("Estimated model cost (USD)","estimated_attempt_cost_usd",lambda v:f"${v:.5f}"),("Duration including pacing (s)","duration",lambda v:f"{v:.2f}")]
pilot_rows = ''.join(f"<tr><td>{label}</td><td>{fmt(a[key])}</td><td>{fmt(b[key])}</td></tr>" for label,key,fmt in metrics)
labels = ["Known rules met; review required", "Missing required course", "Low major-course grade", "Duplicate course attempt"]
fisk_rows = ''.join(f"<tr><td>{label}</td><td>{r['result']['earned_credits']}</td><td>{html.escape(r['result']['status'].replace('_',' '))}</td></tr>" for label,r in zip(labels,fisk["cases"]))
pages = [f"""
<p class="eyebrow">SENIOR SEMINAR II / OCTOBER 8, 2026</p>
<h1>Progress Report 1</h1><p class="subtitle">Selective State Recovery for Reliable AI Agents</p>
<p><b>Oludolapo Adegbesan</b><br>Case study: Fisk University B.S. in Computer Science</p>
<h2>1. Project Overview</h2>
<p>My project investigates how a tool-using AI agent can recover when an early mistake becomes visible later in a workflow. The central question is how to identify a safe recovery boundary, invalidate affected results, and preserve valid independent work. Academic planning is the intended case study because credits, grades and requirements provide opportunities for deterministic validation.</p>
<p>I am developing and evaluating a selective recovery prototype. Its effectiveness remains a research question. Published benchmark components provide a reference environment; custom recovery modifications are labeled separately.</p>
<h2>2. Work Completed</h2>
<p>I implemented a Python execution-trace and dependency layer, a deterministic recovery demonstration, and a live Gemini diagnosis harness. The synthetic comparison includes full restart, visible-step retry, simulated late-checkpoint restoration, source rollback, and selective recovery.</p>
<p>I integrated a Research Lab into the Next.js/FastAPI application. It launches fixed experiments and displays saved results, methods, traces, provenance and JSON exports. The interface separates official benchmarks, custom recovery on official tasks, synthetic demonstrations, and the Fisk catalog case study.</p>
<p>I pinned official AgentRx and maintained tau benchmark repositories, ran official preprocessing and environment checks, and executed a live released retail task. I then implemented an external controlled-fault recovery adapter using the released tools and unchanged evaluator. I also extracted Fisk catalog facts and created four synthetic academic audit cases.</p>
<p class="note"><b>Current status:</b> a working research prototype with preliminary live evidence. Full published recovery-method reproduction, repeated experiments and complete Fisk graduation validation remain unfinished.</p>
<p class="small"><b>GitHub:</b> <a href="{github}">{github}</a><br>This is the configured repository remote. Local changes have not been verified as pushed or publicly accessible.</p>
""", f"""
<p class="eyebrow">EVIDENCE / RELEASED BENCHMARK TASKS</p><h2>3. Evidence of Progress</h2>
<p><b>Official components.</b> The pinned maintained tau repository supplies retail tasks, policy, a simulated database, agent/user implementation and grading [1]. Gemini replaces upstream model defaults, so these runs do not reproduce published aggregate scores. One unchanged task-0 smoke test earned reward <b>0.0</b>; that result is preserved separately.</p>
<p><b>Custom recovery pilot.</b> On October 7, I completed a matched pair on released retail task 0, seed 300. Once per execution, the first successful user-details read was replaced with an empty object. Both strategies used Gemini 3.5 Flash Lite for agent and user, temperature 0, six-second generation pacing, a 60-attempt-step limit and a 180-second wall-time budget. At most one automatic recovery was allowed.</p>
<table><tr><th>Observed metric</th><th>No added recovery</th><th>Selective recovery</th></tr>{pilot_rows}</table>
<p class="caption">Table 1. Completed live pair. Counts include discarded attempts; validation tool calls are reported separately. Source: paced-pilot recovery-results.json, October 7.</p>
<p>Both runs reached the injected fault and earned official reward <b>1.0</b>. The shared detector matched the injected source in both executions. The reference agent recovered without added rollback. Selective recovery restored the earlier boundary but used more work. <b>This pair shows no reward or efficiency advantage for selective recovery.</b></p>
<p class="note">This is a researcher-defined fault extension, not an official recovery benchmark. One pair cannot establish general effectiveness or statistical significance. Estimated costs are unverified against billing. Earlier connection and quota failures remain archived with null, ungraded rewards; differing protocol versions are not pooled.</p>
<p class="small"><b>Evidence:</b> baselines/results/tau-recovery-pilot-paced-20261007/recovery-results.json under docs/research/ preserves source, protocol, grading, traces and usage. report-build-manifest.json records inputs used for this PDF.</p>
""", f"""
<p class="eyebrow">EVIDENCE / SYNTHETIC DEMONSTRATIONS AND FISK CHECKS</p><h2>3. Evidence of Progress (continued)</h2>
<p><b>Synthetic recovery mechanics.</b> In the seven-step fixture, step 3 incorrectly reports no remaining courses. Step 6 consumes that output and step 7 detects the problem. Selective recovery invalidates steps 3, 6 and 7 while retaining correct nodes 1, 2, 4 and 5. This illustrative nine-credit fixture is not Fisk degree requirements.</p>
<table><tr><th>Local strategy</th><th>Recovered</th><th>Repeated</th><th>Diagnosis</th><th>Valid kept</th></tr>{syn_rows}</table>
<p class="caption">Table 2. One deterministic scenario, one execution per strategy, no model calls. Diagnosis is excluded from repeated steps. Checkpoint restoration here is a simulation, not a reproduced published checkpointing system.</p>
<p><b>Fisk source grounding.</b> I recorded official 2024–2025 catalog facts [3], including 120 degree credits, the 2.0 GPA threshold and known major/cognate coursework. A separate partial checker calculates credits/GPA and flags missing courses, low major grades and duplicates on synthetic records.</p>
<table><tr><th>Synthetic case</th><th>Credits</th><th>Partial audit result</th></tr>{fisk_rows}</table>
<p class="small">No case is cleared for graduation. Unresolved conditions include a lab-code inconsistency, CORE interpretation, complete prerequisites, residency, language placement and individual exceptions. Applicability to other catalog cohorts remains unverified.</p>
<p><b>Verification.</b> October 7 verification recorded 26 primary backend test passes and one optional-environment skip, plus six adapter tests in the official environment and a successful frontend production build. Adapter tests use scripted speakers; they are software checks, not live performance trials. Later interface changes passed TypeScript and HTTP checks; signed-in visual inspection remains pending.</p>
<p class="small"><b>Code:</b> Backend/research/benchmark.py, tau_recovery.py, official_baselines.py and fisk_case_study.py; Backend/app/research_lab.py; web/app/(app)/research/page.tsx.<br><b>Preserved evidence:</b> docs/research/baselines/results/ and docs/research/progress-report-1/evidence/. Run IDs, traces, hashes, configurations and failed attempts are retained locally.</p>
""", """
<p class="eyebrow">REFLECTION / NEXT RESEARCH STAGE</p><h2>4. Challenges</h2>
<p><b>Locating an earlier error.</b> Retrying the visible failure can preserve corrupted state. The official-task adapter re-executes recorded reads against the same database version, finds the earliest content/error mismatch and invalidates its conservative dependency closure. Recovery restores conversation state and the isolated retail database together. This assumes deterministic trusted reads and does not establish a globally minimal recovery boundary.</p>
<p><b>Provider failures and fair comparison.</b> Connection and quota errors interrupted early attempts. I preserved those failures and recorded a versioned amendment adding equal generation pacing to both strategies. Global attempt, time and model-usage counts include discarded work.</p>
<p><b>Access and academic ground truth.</b> Full AgentRx diagnosis requires supported provider access. I have not claimed end-to-end reproduction. Catalog ambiguities remain flagged rather than permitting graduation clearance. Local frontend/API integration issues were addressed; browser connection problems still prevent a claim of completed visual verification.</p>
<h2>5. Next Steps</h2>
<p>Before the next report, I plan to complete a faithful published diagnosis/recovery baseline once access is available, validate additional fault cases, and run matched repeated trials. The saved plan defines three tasks, three faults, three seeds and six strategies (162 controlled executions), plus nine unfaulted references: <b>171 planned cells, not completed results</b>. Provider limits and costs will be assessed before execution; any scope changes will be documented first.</p>
<p>I will resolve Fisk catalog ambiguities, expand independent expected-result checks, and complete visual/interface verification. Comparative reporting will include fault coverage, official reward, source accuracy, repeated work, model/tool usage and cost, including unsuccessful executions.</p>
<h2>Sources and Research Records</h2>
<p class="small">[1] <a href="https://github.com/sierra-research/tau2-bench/tree/4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699">Maintained tau benchmark, pinned official repository</a>.<br>[2] <a href="https://github.com/microsoft/AgentRx/tree/7a18c79708e7671be15124460f4f7296107c2a55">AgentRx, pinned official repository</a>; <a href="https://arxiv.org/abs/2602.02475v2">paper version</a>.<br>[3] <a href="https://fisk.smartcatalogiq.com/en/bulletin/undergraduate/school-of-natural-science-and-mathematics/department-of-mathematics-and-computer-science/computer-science-bs/">Fisk B.S. Computer Science catalog</a> (2024–2025 edition recorded).<br>Local records under docs/research/: method-data-audit.md, assumptions.md, research-log.md, tau-recovery-protocol.json, fisk-catalog-rules.json and baselines/upstream-lock.json.</p>
"""]
css = """body {font-family:sans-serif;font-size:10.5pt;line-height:1.32;color:#243347;} h1 {font-size:27pt;color:#183e60;margin:5pt 0 10pt;} h2 {font-size:14pt;color:#183e60;margin:13pt 0 8pt;} p {margin:0 0 10pt;} .eyebrow {font-size:8.5pt;color:#607086;letter-spacing:.6pt;} .subtitle {font-size:14pt;margin:0 0 15pt;} .small,.caption {font-size:8.7pt;line-height:1.28;color:#526075;} .note {background-color:#edf3f8;padding:10pt;} table {border-collapse:collapse;width:100%;font-size:9pt;margin:8pt 0 10pt;} th {background-color:#edf3f8;font-weight:bold;} td,th {padding:7pt 5pt;border-bottom:.5pt solid #cbd5df;text-align:center;} td:first-child,th:first-child {text-align:left;} a {color:#225e8a;}"""
doc = fitz.open()
for number, body in enumerate(pages, 1):
    page = doc.new_page(width=612,height=792)
    remaining, scale = page.insert_htmlbox(fitz.Rect(56,48,556,738),body,css=css,scale_low=1)
    if remaining < 0 or scale != 1:
        raise RuntimeError(f"Page {number} overflows; edit layout rather than shrinking text")
    page.insert_text((56,764),"Oludolapo Adegbesan | Senior Seminar II | Progress Report 1",fontsize=8,color=(.35,.4,.46))
    page.insert_text((542,764),str(number),fontsize=8,color=(.35,.4,.46))
doc.set_metadata({"title":"Progress Report 1 - Selective State Recovery for Reliable AI Agents","author":"Oludolapo Adegbesan"})
pdf = HERE / "progress-report-1.pdf"
doc.save(pdf)
qa = HERE / "qa"
qa.mkdir(exist_ok=True)
for i,page in enumerate(doc,1):
    page.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(qa / f"page-{i}.png")
(HERE / "progress-report-1.html").write_text('<!doctype html><html><head><meta charset="utf-8"><title>Progress Report 1</title><style>'+css+'section {max-width:7in;margin:36pt auto;page-break-after:always;}</style></head><body>'+''.join('<section>'+body+'</section>' for body in pages)+'</body></html>',encoding="utf-8")
inputs = [PILOT,E/"recovery-benchmark.json",E/"fisk-case-study-20261007.json",E/"research-verification-20261007.json"]
(HERE / "report-build-manifest.json").write_text(json.dumps({"report_date":"2026-10-08","github":github,"pages":len(doc),"fresh_model_calls":0,"inputs":[{"path":p.relative_to(ROOT).as_posix(),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()} for p in inputs],"pdf_sha256":hashlib.sha256(pdf.read_bytes()).hexdigest()},indent=2),encoding="utf-8")
print(f"Built {pdf}: {len(doc)} pages; original font sizes; rendered previews in {qa}")
