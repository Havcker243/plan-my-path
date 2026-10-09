# October Progress Reference — Outside Weeks 5 and 6

**Name:** Oludolapo Adegbesan  
**Course:** Senior Seminar II  
**Project:** Selective State Recovery for Reliable AI Agents  
**Assigned Weeks 5–6 dates:** September 16–25, 2026  
**Evidence available through:** October 9, 2026

**Status:** This document records later work, primarily October 8–9. It is not the September 16–25 report and must not be submitted as work completed during that period. It is retained as a reference for a later report.

## Project overview

My project investigates whether a tool-using AI agent can recover from an error while preserving valid work. The system records execution history, identifies inconsistent tool results and uses dependencies and saved state to choose a recovery boundary. Fisk University's B.S. in Computer Science is the academic-planning case study, using catalog requirements and synthetic student records. Current live recovery experiments use released retail benchmark tasks to test the recovery mechanism separately from academic-rule correctness.

## Work completed and approaches used

On October 8–9, I reviewed recent failure-diagnosis and recovery research, including AgentRx, AgentRewind and Dependency-Guided Rollback Repair. I compared their approaches with my implementation and documented the differences. My controller is a custom experimental implementation; it is not a completed reproduction of these published systems.

I ran and preserved controlled recovery experiments on released retail tasks using the official evaluator. The strategies include no added recovery, full restart, visible-step retry, periodic checkpoint restoration, source rollback and selective recovery. Results are saved with execution traces, source and protocol hashes, fault coverage, grading and work measurements. Provider errors and unsuccessful outcomes remain in the record rather than being replaced by favorable runs.

The earlier experiments did not demonstrate valid-read reuse or a work-saving advantage for selective recovery. I therefore redesigned the recovery cache. In version 3, saved read results must match the tool, arguments, requestor and database version and pass a fresh value-validation check before reuse. The detected corrupt source and error results are excluded, writes bypass the cache, and caching begins only after recovery. This verifies tool values; it does not prove that the agent's reasoning is independent of the original error.

I also improved the analysis to include validation overhead. It now reports executed tools, validation calls and total tool invocations, with measurement counts and missing values handled explicitly. I prepared a bounded three-method comparison of no-recovery, source rollback and selective recovery. This plan is saved, but it has not yet been executed under version 3.

## Results and evidence

| Completed check or experiment | Outcome | Interpretation |
| --- | --- | --- |
| Version-3 integration tests | 12 passed | Checked restoration, detection and cache behavior using scripted speakers and released tools |
| Matrix-scheduling tests | 3 passed | Checked trial identities and protocol ordering |
| Saved-evidence analysis tests | 8 passed | Checked missing data, version separation, pairing and validation overhead |
| Earlier six-strategy task-0 / seed-300 comparison | All six received official reward 1.0; visible retry did not encounter its planned fault | Preliminary task outcomes, not six successful recovery demonstrations |
| Earlier reference/selective comparison | Equal steps, model calls and executed tool counts; no cached-read reuse | No demonstrated selective work savings |
| Version-3 live comparison | Prepared only | No live performance conclusion yet |

The tests establish correctness of the checked software behavior, not general recovery effectiveness. In the earlier comparison, full restart took approximately 196 seconds, exceeding the nominal cooperative 180-second timeout; its original score is preserved with that limitation disclosed.

Evidence for review:

- [Earlier six-strategy results and raw-record links](evidence/recovery-six-strategies-20261009/findings.md).
- [Version-3 redesign and test evidence](verified-cache-redesign-20261009.md).
- [Source-hashed integration verification](evidence/verified-cache-redesign-20261009/verification.json).
- [Analysis verification](evidence/v3-comparison-readiness-20261009/verification.json).
- [Prepared three-method comparison](v3-bounded-comparison-20261009.md).
- [Dated research log](research-log.md) and [assumptions](assumptions.md).

**GitHub link:** Add the accessible repository URL and ensure these files are published before submitting. Local evidence is not proof that it has been pushed.

## Challenges and responses

Live retail benchmark experiments were interrupted because the Gemini API quota for **`gemini-3.5-flash-lite`**, the model powering both the research agent and the benchmark's simulated user, was exhausted. A saved provider error reported a limit of **500 requests per day** for that model. These are model/API requests, not 500 benchmark trials. The affected rows have null rewards and are retained as execution failures rather than graded task failures. I paused further live launches and continued offline validation and experiment preparation. API capacity must be checked before resuming; the recorded retry delay does not guarantee availability.

Other challenges include differing model trajectories despite matching requested seeds, overlapping campaigns, faults that were not exercised and a cooperative timeout that can overrun. I documented these limitations and separated results by source/protocol version. The next comparison is deliberately small and should run without competing campaigns. Its fixed ordering and single condition still cannot establish statistical superiority.

## Plans for the next stage

After confirming API capacity, I plan to execute the predeclared version-3 comparison and inspect the traces for fault occurrence, source detection and validated reuse. I will compare official task success, total tool work including validation, model calls and elapsed time. If selective recovery provides no savings or fails, I will retain and explain those outcomes.

I will then determine which additional tasks, faults and repeated trials are justified. I also plan to continue verifying the Fisk prerequisite and degree-requirement mapping and complete one supported published-method reproduction. Those activities remain pending and are not reported as completed here.

## Second-week completion checklist

Before submission, confirm the reporting dates, remove work outside the period, add dated second-week activities and actual outcomes, update live-execution status, verify evidence links and the GitHub publication, and remove these draft instructions. Do not convert planned work into completed work without evidence.
