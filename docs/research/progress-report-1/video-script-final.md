# Progress Report 1 — recording script

Prepared October 8, 2026. Target duration: about 4 minutes with navigation and a short offline run. Spoken narration is about 450 words. Rehearse once and keep the finished recording between 2 and 5 minutes. This file is a script, not a recorded video.

## Prepare the screen

1. Open the running site's Research Lab (last used: http://127.0.0.1:3001/research). Sign in before recording. If the services are stopped, follow ../research-lab.md; use the actual frontend port printed in the terminal.
2. Locate the **Custom recovery on official tasks** section and the saved completed paced pilot. Confirm its two rows have reward 1.0 and attempt counts 21 and 25. Do not select an earlier connection/quota-failed attempt as this completed pilot.
3. Open the report PDF, the **Synthetic demonstrations** section, and the **Fisk catalog case study** section. Test the offline Run experiment control once before recording.
4. Enlarge text until tables are legible. Close personal tabs and hide notifications. Do not display .env files, credentials, authentication tokens or real student records.
5. Record your own screen and narration using your preferred recorder. The steps below do not require fresh paid AI calls. Saved live runs must be described as recorded evidence.

## 0:00–0:35 — Introduce the project

**Show:** Report page 1, then the Research Lab header.

“Hello, my name is Oludolapo Adegbesan. My project is Selective State Recovery for Reliable AI Agents. I am investigating how an agent can recover when an early mistake becomes visible several steps later. The goal is to locate a safe recovery boundary, preserve valid work, and recompute affected results. My intended case study is academic planning for Fisk University's B.S. in Computer Science, using catalog requirements and synthetic student records.”

## 0:35–1:05 — Explain the research workspace

**Show:** Section navigation; switch to Run experiments.

“I have implemented a Python recovery prototype and this Research Lab. I separated official benchmark work, custom recovery on released tasks, synthetic demonstrations, and Fisk catalog checks. Each saved run has results, method and data information, traces, provenance, and a JSON export. Official resources and my experimental modifications are labeled separately.”

## 1:05–2:00 — Demonstrate an actual offline run

**Do:** Choose Synthetic demonstrations → Synthetic recovery comparison → Run experiment. Wait for completion, then show Results and Trace. Do not start a paid run during this segment.

“Here I am running the deterministic synthetic comparison. An early result incorrectly says there are no remaining courses, and final validation detects the error later. Full restart repeats seven steps. Retrying the visible failure and restoring the simulated late checkpoint fail because the original bad state remains. Source rollback repeats five steps; selective recovery repeats three and retains four correct outputs. The source-based methods also perform a diagnostic step. This is one constructed scenario that demonstrates the mechanics, not proof of general improvement.”

**Optional fallback if the site run fails:** Show the failure honestly, then run this from Backend and explain it is the same offline harness:

```powershell
.\.venv\Scripts\python -m research.benchmark --output ../logs/video-offline-20261008.json
```

## 2:00–3:00 — Show saved live benchmark evidence

**Do:** Saved evidence → Custom recovery on official tasks → completed paced pilot. Show reward rows, diagnostics and Trace; then briefly open Method & data.

“This is a saved live Gemini experiment from October 7 on a released retail task. The tasks, tools and grading come from the official benchmark; the injected fault and recovery controller are my experimental extension. Both methods reached the fault and earned reward one. The reference used twenty-one attempt steps and fifteen model calls. Selective recovery used twenty-five steps and seventeen calls. It located the earlier inconsistent read, but did not improve reward or efficiency in this pair. I retained failed attempts too. One pair is preliminary evidence, not a benchmark-wide conclusion.”

## 3:00–3:30 — Show the Fisk case study

**Show:** Fisk catalog case study → saved four-case result. Open Method & data to identify the catalog edition and synthetic records.

“For academic grounding, I extracted facts from Fisk's 2024–2025 catalog and created four synthetic student cases. The partial checker calculates credits and GPA and flags missing coursework, low grades and duplicates. No case receives graduation clearance because several requirements and catalog ambiguities remain unresolved.”

## 3:30–4:10 — Challenges and next steps

**Show:** Report page 4, then the GitHub link on page 1.

“The main challenges are reliable error attribution, provider limits and academic ground truth. Official AgentRx preprocessing works, but full diagnosis remains access-blocked. My next steps are a faithful published baseline, repeated matched trials, and fuller Fisk validation. The saved experiment matrix contains one hundred seventy-one planned executions, not completed results. My current contribution is a working prototype, recorded evidence, and a documented evaluation plan.”

## Before submitting

- Watch the exported video: confirm audio is clear, tables are readable, and duration is 2–5 minutes.
- Describe only work you can explain and verify as your individual contribution. Adjust first-person wording if needed and follow your course's AI-assistance disclosure policy, if one applies.
- Confirm the GitHub link works for the instructor and contains the files you reference. Local work has not been verified as pushed.
- Submit progress-report-1.pdf and your actual video file through Canvas. Neither upload nor video recording has been performed by this script.
