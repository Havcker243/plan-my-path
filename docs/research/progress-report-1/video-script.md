# Progress Report 1: Video Script

Target: approximately 4 minutes, including a short live terminal demonstration. Read the narration naturally; record a 2-5 minute video. The script and figures are preparation materials, not a completed video recording.

## Before recording

Open the PDF, `evidence/dependency-graph.png`, `evidence/recovery-comparison.png`, and `evidence/archived-live-summary.json`. Open a terminal at the repository root with readable text. Hide unrelated tabs and notifications. Use the offline demo below; it makes no paid API calls. Do not open `.env` files.

## 0:00-0:35 — Introduction

Show page 1 of the report.

“Hello, my name is Oludolapo Adegbesan. My project is Selective State Recovery for Reliable AI Agents. I am studying how an agent can recover when an early mistake only becomes visible later in a workflow. Instead of repeating every step, the goal is to find a safe recovery boundary and preserve work that is still correct. My case study is academic planning for Fisk University's B.S. in Computer Science, using university catalog requirements and synthetic student records.”

## 0:35-1:15 — Show the actual prototype

Show `Backend/app/agent/state.py`, then the dependency graph PNG.

“The current prototype records steps, their inputs and outputs, and dependencies. This figure shows the seven-step synthetic benchmark. At step three, I deliberately inject an incorrect empty list of remaining courses. The proposal uses that list, but the problem is only detected during final validation at step seven. The catalog branch is independent. The section lookup is also retained, although this simplified proposal does not use its result. The prototype traces affected descendants so it can invalidate the bad result and replay those steps.”

## 1:15-2:10 — Run the comparison

Run from the repository root:

```powershell
Set-Location Backend
.\.venv\Scripts\python -m research.benchmark --output ../docs/research/progress-report-1/evidence/video-demo.json
```

Wait for the table, then point to each relevant row.

“Here is the actual comparison running locally. Full restart succeeds but repeats seven workflow steps. Retrying only the visible validator fails because the original error remains. Restoring the latest checkpoint also fails for that reason. Rolling back from the located source succeeds and repeats five steps. Selective recovery succeeds while repeating three steps and retaining four correct nodes. The two source-based strategies also perform one diagnostic step, which is shown separately. This demonstrates the mechanism in one constructed example; it does not yet prove a general performance advantage.”

## 2:10-2:45 — Show tests

Run in the same Backend terminal:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

“All fifteen current backend tests pass. These check dependency invalidation, independent results, incorrect localization, prerequisite ordering, invalid courses, transient reads, and model-tool interaction. The unit tests use mocked model responses. The course data is currently illustrative and synthetic, so passing these checks is not an official Fisk degree audit.”

## 2:45-3:20 — Show saved live evidence

Show `evidence/archived-live-summary.json` or Table 2 in the PDF. Label this on screen: “Earlier live smoke tests — same scenario, three runs.”

“I also have earlier live Gemini recovery evidence. In three runs on this same fault, Gemini received the trace and validation evidence without the injected-source label. It selected step three each time, and dependency-based replay recovered successfully. These saved traces are earlier smoke tests, not new calls in this recording. They show that the diagnosis-to-recovery path can work with a real model, but they do not establish accuracy across different failures.”

## 3:20-4:10 — Challenges and next steps

Show page 3 of the report.

“The main challenges have been finding the original error, handling model timeouts and quota failures, and defining academic ground truth. Related research already studies selective replay, so my contribution needs a careful controlled evaluation. Next, I will verify and freeze Fisk catalog rules, create synthetic student profiles, define twelve distinct fault scenarios, and implement the more general localization and safe-boundary rules. I will then compare recovery strategies with repeated trials, measuring correctness, repeated work, model usage, and preserved valid work. The prototype is working; the broader Fisk-grounded benchmark is the next stage.”

## Recording check

Confirm the final recording is 2-5 minutes, the console table and test result are legible, and the earlier live traces are clearly distinguished from the live offline demonstration. Add your repository link to the report before exporting the final version if desired. Submit the PDF and your recorded video to Canvas.
