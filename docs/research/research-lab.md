# Research Lab on FiskGrad

Latest expansion: the site now includes **Official-task recovery pilot**, **Fisk catalog case-study checks**, and the access-blocked **AgentRx full public-sample pipeline**. The official-task adapter is implemented and has a completed live paired pilot. Both methods earned reward 1.0; selective used more work in that trial. See [method/boundaries and matrix commands](recovery-method.md) and [Fisk source grounding](fisk-case-study.md). The user-provided operator is configured locally; restart the backend to pick up settings.

For an explanation sequence and claim/evidence mapping, use the [demonstration guide](lab-demonstration-guide.md). Each control now exposes its category, research question and design; each selected run has a **Method & data** tab and readable strategy definitions. Provenance lists artifact paths and SHA-256 values at inspection. Provider failures are labeled unevaluated, separately from failed recovery. Inspection hashes are not retroactive execution-time hashes or proof of scientific validity.

Added October 7, 2026. Open **Research Lab** in the site sidebar, or visit `/research` after signing in. This integrates runnable experiments and recorded evidence into the existing app; it does not yet implement every method in the literature inventory.

## Run locally

Use the existing Supabase/Fisk login. Add the following to `Backend/.env`, replacing the email with the email you use to sign in:

```dotenv
RESEARCH_LAB_ENABLED=true
RESEARCH_OPERATOR_EMAILS=your-email@my.fisk.edu
```

Start a **single backend worker**, from `Backend`:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal, from `web`:

```powershell
npm run dev
```

Visit `http://localhost:3000/research`. The existing site requires a signed-in account and initialized academic profile. Backend authorization checks the verified login email against the operator list. No real student records are supplied to these experiments. Keep research execution disabled on the public deployment. This first integration uses process-local serialization and Windows-specific official environment paths; it is not a distributed job service.

## What the buttons actually run

| Control | Actual execution | Evaluation |
|---|---|---|
| Synthetic recovery comparison | `research.benchmark` | Five strategies on one deterministic controlled failure; full dependency traces |
| Gemini selective recovery | `research.agent_recovery_demo`, one trial, Gemini 3.5 Flash Lite | Model source diagnosis; deterministic replay; source accuracy and recovery evidence |
| AgentRx public samples | Unchanged pinned official CLI, IR stage, seven public examples | Preprocessing only; no localization accuracy claim |
| τ-bench environment checks | Unchanged pinned official data validator and retail tool tests | Environment verification only |
| τ-bench live retail baseline | Unchanged pinned official CLI, task 0, base split, seed 300, one trial | Official reward and termination reason; Gemini replaces upstream default agent/user models |
| Official-task recovery pilot | Released task 0 with empty-read fault; no recovery vs selective; same Gemini/budgets/pacing | Unchanged official reward plus source detection, fault coverage, attempts, validation work, usage/cost |
| AgentRx full public-sample pipeline | All official stages on one fixed sample; supported provider authentication required | Stage outputs; not reproduced while access-blocked |
| Fisk catalog case-study checks | Four synthetic records and source-grounded partial checks | Credits/GPA, missing/low-grade coursework and duplicate rejection; no full graduation clearance |

Live buttons use the backend Gemini key and incur API charges. All parameters are fixed on the server. AgentRx/τ actions require the local pinned repositories and environments described in [baseline setup](baselines/README.md). The wrapper refuses tracked upstream modifications or revision mismatches. Missing dependencies disable the corresponding control.

## Evidence and interpretation

The page reads existing evidence as well as new runs. It retains the official first τ smoke-test reward of **0.0**: process completion is not task success. The setup failure is retained too. The Results tab shows strategy outcomes within the synthetic scenario, or official evaluator rewards. Trace exposes recorded inputs, outputs and dependencies for synthetic runs, and released task/conversation/tool/evaluator records for official runs. Provenance shows official manifests or site commands/source hashes. Export JSON downloads the selected run's evidence.

New site records, console output and custom results persist under `logs/research-lab/<run-id>/`; official wrapper artifacts remain under `docs/research/baselines/results/`. Run records are written atomically. Provider errors/nonzero exits/timeouts are retained; unfinished records after a backend restart appear as interrupted. A single in-process lock rejects concurrent execution. The API provides `GET /api/research/runs` and `POST /api/research/runs` with a fixed action name, authenticated bearer token and operator authorization. It accepts no commands, model strings, filesystem paths, or student data from the browser.

The first custom comparison uses rule-based source localization. The live custom run uses Gemini, and may fail. Neither is a published implementation of AgentRx, AgentRewind, AgentDebugX or DGRR. Official τ results and the synthetic comparison appear in separate evaluation groups; there is no cross-suite ranking or claim of statistically significant improvement.

## Remaining work for the requested head-to-head comparison

Custom selective recovery is now adapted to official retail tasks as a controlled-fault extension, with one completed live paired pilot. The planned multi-task repeated matrix is not complete. Full AgentRx diagnosis still requires supported provider authentication and dataset access; AgentRewind, AgentDebugX, DGRR, AgentBench and WebArena are not runnable integrations here yet. Their pending status is displayed explicitly.

Before adding a scientific head-to-head table: reproduce each selected published method end to end, freeze a shared task subset and evaluator, match agent/user models, seeds and budgets, define controlled faults and recovery boundaries, then run all strategies on that same protocol with repeated trials and uncertainty estimates. Use official recovery-enabled environment snapshots before replaying database mutations. Do not substitute the synthetic course fixture for public benchmark tasks or interpret a single smoke test as a suite score. The Fisk catalog case study remains a separate domain evaluation pending verified requirement extraction.

The controlled-extension task subset, boundaries, budget and seeds are now explicit in the protocol, and its live pilot supports integration evidence only. Fisk facts are now sourced to a specific catalog edition; unresolved requirements still prevent complete degree clearance. Final verification transcripts record 26 primary backend passes plus six separate official-adapter test passes and a successful production build. Signed-in visual verification remains pending because browser connection failed.

## Verification on October 7

The backend suite passed 20 tests, including a real offline subprocess launched through the API, expected successful and unsuccessful recovery outcomes, persisted trace and source hashes, operator access rejection, disabled/unknown/concurrent execution rejection, interrupted-run labeling, and preservation of an official zero reward. Frontend TypeScript passed. The initial production build was blocked by sandbox Google Fonts access; the permitted retry passed with `/research` included among 24 generated routes. Browser inspection could not start because the browser connection rejected missing sandbox metadata; visual and signed-in browser verification remain pending.
