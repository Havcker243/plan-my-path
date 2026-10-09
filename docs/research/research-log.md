# Research Log

## September 15, 2026

### Research direction clarified

The project is an AI-agent research project implemented within FiskGrad. Google Gemini is the intended reasoning and tool-calling model. FiskGrad provides student-plan state, transcript-derived coursework, catalog data, degree requirements, and deterministic checks.

### Implementation work performed before literature review

An initial uncommitted prototype was added under `Backend/app/agent/`, with synthetic fixtures and recovery tests under `Backend/research/` and `Backend/tests/`. It demonstrates a bounded Gemini tool loop, execution traces, dependency invalidation, and deterministic checks. Twelve initial tests passed before the research direction was paused. A synthetic live Gemini request did not complete successfully. These results show only that parts of the software mechanism execute; they do not demonstrate novelty or research effectiveness.

### Literature search performed

Search themes included tool-using agent architecture, self-correction, deterministic verification, checkpointing, failure localization, rollback, provenance, selective replay, side-effect safety, long-horizon failures, and academic advising.

Key sources discovered:

- ReAct, Toolformer, Self-Refine, Reflexion, CRITIC, Chain-of-Verification, and LATS.
- LangGraph persistence/time travel and LLM-Modulo verification.
- AgentDebug, AgentDebugX, HORIZON, and AgentLocate.
- ReflectAgent, Dependency-Guided Rollback Repair, AgentRewind, and ACRFence.
- AdvisingWise for the academic domain.

### Major finding

The original broad idea overlaps with recent work. ReflectAgent is especially close: it reportedly detects anomalies, constructs a dependency graph, localizes the root step, and rolls back from that point. Dependency-Guided Rollback Repair already performs selective replay while preserving benign state for memory failures. The project must not claim that selective or dependency-aware rollback is new.

### Provisional research direction

Study whether deterministic domain validators plus explicit runtime provenance can improve root localization and branch-selective reuse in academic-planning workflows. Compare this with visible-step retry, full restart, checkpoint recovery, suffix rollback, and reflection/rerun. Treat this as a candidate distinction until the closest papers and artifacts are reviewed in full.

### Next actions

1. Read and annotate the full closest papers and verify publication/artifact status.
2. Create a method-by-method comparison of inputs, dependency representation, locator, recovery unit, side-effect model, and evaluation protocol.
3. Freeze the project question only after identifying a measurable distinction.
4. Define the academic ground-truth boundary and independently test the requirement parser.
5. Convert the engineering prototype only after the method and baselines are specified.

### Full-method reading update

The first detailed reads covered Dependency-Guided Rollback Repair, AgentDebugX, AgentRewind, and ACRFence.

- Dependency-Guided Rollback Repair already records explicit typed provenance, excludes mere temporal order from contamination, checks independent support, and selectively replays an answer-relevant dependency closure. Its key simplifying assumption is that faulty memory identifiers are provided by an upstream detector.
- AgentDebugX already combines deterministic detection rules with LLM-based attribution and policy-gated reruns. Its reported exact-step attribution results show that unknown-root localization remains hard.
- AgentRewind restores an execution prefix and workspace checkpoint, then regenerates a suffix. External network/service effects are outside its rollback boundary.
- ACRFence shows that checkpoint replay can duplicate or redirect external effects when an LLM regenerates semantically different tool arguments.

The provisional distinction is therefore narrower: use deterministic domain-violation evidence to localize an unknown within-run fault, then use explicit provenance for branch-selective recovery. This distinction still requires artifact-level verification and a direct baseline comparison.

### Classical grounding and AgentRx correction

The literature map was expanded beyond LLM-agent papers. Static and dynamic program slicing provide the conceptual basis for computing an affected execution slice. Rollback-recovery research distinguishes checkpoint and log-based restoration, explains rollback propagation through dependencies, and emphasizes logging nondeterministic events. Database and scientific-workflow provenance show that lineage can support debugging, update propagation, replay, and checkpoint recovery. Therefore, the general structure of provenance-guided selective recomputation is longstanding prior art.

AgentRx materially narrows the proposed contribution again. It already synthesizes guarded constraints from tool schemas, policies, and trajectory observations, evaluates programmatic and semantic checks, and uses violation evidence to localize the first unrecoverable critical failure. Its current arXiv version reports 170 annotated failed trajectories and released code/data. AgentRx is a diagnosis system rather than a selective repair system, but it means deterministic or structured violations cannot be claimed as a new localization idea.

The safest current framing is a controlled integration study: connect fixed, independently tested academic validators to explicit runtime provenance and measure the entire path from delayed violation to root localization, invalidation, selective repair, and valid-work reuse. An algorithmic contribution should be claimed only if it outperforms a straightforward combination of AgentRx-style evidence and an existing dependency-closure planner.

### Academic-domain grounding update

A 2026 systematic review of 27 peer-reviewed academic-advising studies reports inconsistent evaluation standards, a strong dependence on offline studies, weak institutional grounding, limited external validation, privacy concerns, and maintenance risk as policies change. AdvisingWise also keeps human advisor validation in the delivery loop. The FiskGrad study will therefore use frozen catalog and requirement snapshots, synthetic or de-identified student records, and a clearly enumerated validator coverage boundary. Passing the test validator will mean only that the plan satisfies the encoded experimental constraints, not that it guarantees graduation or replaces official advising.

### Artifact and demo planning update

AgentRx provides a public GitHub implementation with sample trajectories and a staged pipeline for trajectory normalization, invariant generation, checking, judging, and reporting. Its larger Hugging Face dataset is publicly listed but gated by an access agreement. No clearly linked public implementation for Dependency-Guided Rollback Repair was found during this search, so its paper will initially define a specification-level baseline rather than a claimed code reproduction.

The current deterministic benchmark is designated Demo 0: it explains the mechanism but is not evidence. Demo 1 will use 12 frozen synthetic scenarios across transcript parsing, requirement mapping, catalog retrieval, and tool-result interpretation faults. It will hide injected-fault labels from recovery, compare five practical strategies plus an oracle-source condition, and separately score localization, invalidation, recovery, reuse, and cost.

### Demo 0 execution

The deterministic benchmark was rerun on September 15, 2026. Full restart recovered after repeating seven steps and preserved no valid work. Visible-step retry repeated one step but failed, while latest-checkpoint recovery repeated two steps and failed because it retained the corrupted intermediate result. Source-suffix rollback recovered after repeating five steps and preserved two valid steps. Selective recovery recovered after repeating three steps and preserved all four valid source/independent steps. The complete trace is stored in `logs/recovery-benchmark.json`.

All 13 backend agent tests passed using `Backend/.venv`. An initial verification command used the repository-level virtual environment and failed during test import because that environment does not include the Gemini SDK; rerunning with the backend environment resolved the setup mismatch. No live Gemini result was used in Demo 0.

### Live Gemini planning smoke test

The first external run reached Google but failed because the default `gemini-2.5-flash` model is no longer available to new users for generation, even though it still appears in the model listing. Google returned a sanitized `404 NOT_FOUND` response recommending `gemini-3.6-flash`. The backend default, environment example, and Render configuration were updated accordingly.

With `gemini-3.6-flash`, the real agent loop completed successfully against synthetic fixtures. The trace contains three Gemini calls, four model-requested tool calls, eight successful steps, no failed steps, 4,676 input tokens, 167 output tokens, and 533 thought tokens. Gemini requested `read_student`, `read_requirements`, `read_catalog`, and `propose_plan`, then generated `CSCI-201` for Fall 2026 and `CSCI-301` for Spring 2027. The ordinary validator accepted the prerequisite sequence.

The proposed course sequence was not stored as an expected result in `research/demo.py`; it was generated through the model's typed tool call from synthetic source data. However, this verifies planning and validation only. The recovery comparison in Demo 0 still uses deterministic localization and makes no live-agent recovery claim.

### Five-run live repeatability check

Five fresh `gemini-3.6-flash` planning sessions were attempted sequentially against the same frozen synthetic fixtures. One run completed fully with a generated proposal, deterministic validation, and final response. One run ended in a read timeout after three model calls, one ended with provider `503 UNAVAILABLE` after three model calls, and two were rejected with `429 RESOURCE_EXHAUSTED` on their first model calls. The batch therefore produced one complete success out of five attempts under the available API service and quota conditions.

This check also exposed a demo-harness bug: the script could previously return exit code zero after a late provider error whenever a proposal object had already been created. The success condition now requires the agent generator to finish, a proposal to exist, and deterministic validation to return `valid=true`. Provider failures remain failures in the saved result rather than being converted into successful runs.

### Agent-driven selective-recovery smoke test

A new `research.agent_recovery_demo` harness connects a real Gemini diagnosis to the dependency recovery benchmark. The injected source label is retained by the experiment and is not included in the model observation. Gemini sees the execution steps, dependencies, values, and structured validator evidence, then returns a typed `source_step_id`, confidence, and rationale. The graph, rather than Gemini, computes the invalidation closure and reruns affected work. Metrics include exact-source accuracy, safe-boundary status, invalidation precision/recall/F1, repeated work, preserved work, model calls, and tokens.

Initial calls revealed that Pydantic string-pattern, string-length, and `extra="forbid"` fields were incompatible with this Gemini endpoint's structured-output schema. Removing those transport-level constraints resolved `INVALID_ARGUMENT`; returned step IDs remain locally checked against the observed trace. The `gemini-3.6-flash` quota was then exhausted, so the completed run used the separately available `gemini-3.5-flash-lite` model and records that choice explicitly.

Three consecutive agent-driven recovery attempts completed. Gemini chose the hidden true source step `3` in all three runs. Every run recovered successfully, repeated three affected steps, preserved four valid steps, and achieved invalidation precision, recall, and F1 of `1.0`. Recorded total tokens were 868, 856, and 852; recovery times were approximately 1.76, 0.84, and 1.30 seconds. This is a successful live smoke test on one controlled scenario, not a general performance result.

## October 7, 2026

### Instructor feedback, approved scope, and submission context

The user supplied both submitted proposals and instructor feedback requesting explicit academic sources, faults, localization rules, scenario counts, and repeated trials. The case study is confirmed as Fisk University's B.S. in Computer Science, using university catalog requirements and synthetic records. Progress Report 1 is due today: a PDF and 2-5 minute demonstration video; the user will add the GitHub link.

Report source and a video script were started under `progress-report-1/`. PDF construction did not finish, and document work was paused to verify research evidence. These are drafts, not final submission artifacts. An earlier proposed custom 12-scenario matrix was not an implemented benchmark or approved replacement for the five-strategy proposal.

### Fresh offline and live prototype evidence

The deterministic comparison was reproduced: restart recovered/7 repeated task steps; visible retry failed/1; latest checkpoint failed/2; source-suffix rollback recovered/5; selective recovery recovered/3. Suffix and selective recovery each add one diagnosis step. All 15 current backend tests passed. Raw traces, console output, captured exit codes, figures, and hashes are saved in `progress-report-1/evidence/`.

Initial sandboxed Gemini requests failed to connect. With network access, the default planning model `gemini-3.6-flash` returned HTTP 503 twice. A process-local override to `gemini-3.5-flash-lite` completed planning: three model calls, catalog/proposal tool requests, accepted synthetic proposal, final response, and trace. No environment file was changed. All attempts remain saved.

A separate live recovery run using `gemini-3.5-flash-lite` selected source step 3, replayed three affected task nodes, retained four correct nodes, and passed final validation. It recorded 875 tokens, one model call, approximately 1.99 seconds recovery time, and invalidation F1 of 1.0. Nine saved-trace audit checks passed. See `progress-report-1/evidence/live-run-review-2026-10-07.md` and the machine-readable flow audit.

These are one-scenario mechanism checks. Planning and recovery use separate harnesses; recovery replay is deterministic; the checkpoint baseline simulates a boundary; catalog fixtures are illustrative rather than verified Fisk rules; costs/source versions remain incomplete. Retained-node counts include an unused section lookup. No integrated live selective-replanning, benchmark-wide superiority, or novelty claim is supported.

### Direction changed: published method and benchmark reproduction first

The user explicitly requires reproduction of established methods on released, recognized benchmarks before developing custom improvements. Custom scenarios are no longer the primary evaluation. The existing synthetic demos remain engineering artifacts. AgentRx is the initial diagnosis target; maintained tau-bench is the executable tool-agent evaluation candidate. Diagnosis accuracy and environment-graded recovery are separate outcomes: static failure traces alone cannot establish replay success.

Official repositories were downloaded to isolated, gitignored `.research-upstream/` checkouts. `baselines/upstream-lock.json` records AgentRx revision `7a18c79708e7671be15124460f4f7296107c2a55` and maintained tau-bench revision `4ce7c0397c1eb65c9bbe59aeacfe1ca44a1cd699` (package 1.0.1). Legacy tau-bench documentation directs users to the maintained release. Upstream source, tasks, and evaluator remain unchanged. Using Gemini instead of paper models will be labeled a model-substituted baseline, not reproduction of reported paper scores.

### Official baseline work and environment issues

The unmodified AgentRx CLI normalized all seven released public tau-retail samples successfully. Commands, exit codes, logs, input hashes, and normalized trajectories are saved in `baselines/results/agentrx-ir-20261007T150510Z-0ac0b6/`. This completes IR preprocessing only, not invariant generation, diagnosis, or accuracy evaluation. Its full Hugging Face dataset requires accepting an access agreement. Full inference needs a supported authenticated endpoint; the pinned code supports Copilot as well as Azure/TRAPI. User access clarification was requested without requesting secrets.

The official tau-bench dependencies were installed in a separate environment. The current text CLI imports voice modules, so official voice/knowledge extras were needed. Python 3.13 removed `audioop`; `audioop-lts==0.2.2` was installed as a compatibility dependency. Initial checks exposed Windows console encoding and uv-cache permission problems. The wrapper uses UTF-8 and a workspace cache. These are recorded environment accommodations, not source or scoring changes. Check/live-run outcomes will be updated in `baselines/README.md` and per-run manifests.

### Assumptions and reproducibility records

`assumptions.md` records numbered decisions, evidence, consequences, uncertainty, and revisit conditions. `research.official_baselines` verifies the pinned revision and absence of tracked upstream edits; invokes official code; records commands, settings, timestamps, input hashes, output logs, and exit codes; redacts known credentials; and retains failed runs. Setup samples and single-task smoke runs are excluded from benchmark-wide claims. No selective-recovery extension has been inserted into an official baseline.

### Official tau offline verification

The official data-directory check and all 15 upstream retail-tool tests passed, recorded in `baselines/results/tau-check-20261007T150735Z-6a8eb7/`. Two pytest warnings concern an upstream option and cache permissions; there were no test failures. The earlier wrapper failure caused by uv's default user cache is retained separately. A single official task-0 Gemini smoke run was then started with released tasks, policies, agent/user implementations, and evaluator unchanged. Its outcome is pending until the saved official reward and termination reason are inspected; CLI completion alone will not establish task success.

### First official live benchmark outcome

The task-0 run completed and was inspected: **official reward 0.0**, `db_match=false`, termination `user_stop`, 16 messages, approximately 59.41 seconds. Four expected reads matched; the expected exchange write did not match. This is a failed agent task with successful execution/grading infrastructure, not successful recovery and not a benchmark-wide score. No root cause is inferred from action matching alone, and no task was modified or replaced after observing the result.

The complete artifact is `baselines/results/tau-smoke-20261007T150829Z-ec909b/official-results.json`, accompanied by a manifest, installed-dependency list, and run log. It retains official tasks/policies, model configurations, messages/tool calls, grading breakdown, termination reason, and usage. Upstream cost estimates are $0.01454813 agent plus $0.00236250 simulated user, totaling $0.01691063; billing was not independently verified. The task has no natural-language assertions; the official evaluator reports an empty assertion set, with no manual grading suppression. The run used Gemini in place of upstream default models and the declared setup timeouts, so it is an official-method/model-substitution smoke run, not numerical paper reproduction. Full AgentRx inference and annotated-dataset access remain pending user access information.

### Public benchmark and method inventory

`baselines/benchmark-method-inventory.md` now distinguishes AgentRx and maintained tau-bench (downloaded/pinned, partially exercised) from additional public candidates AgentBench/AgentBench FC and WebArena (reviewed, not run). It records current method candidates AgentRx, AgentRewind, AgentDebugX, and Dependency-Guided Rollback Repair separately from executed baselines. Only the official tau tool-calling reference has completed a live task run; AgentRx has completed preprocessing only. Tau retail/airline domains are not independent benchmark suites, and AgentRx's tau-derived data overlaps tau-bench in domain. Broad multi-benchmark recovery evidence is not yet available.

# October 7, 2026 — Site experiment integration

Follow-up: user requested clear labeling and concrete evidence for running/explaining all experiments. Added shared protocol metadata per control (category, benchmark, method, data, evaluator, design, question and supported claim), a Method & data tab, full strategy names/definitions, explicit simulated-checkpoint labeling, rule-based vs Gemini locator labels, visible Run IDs, metric definitions and file/hash evidence references. Provider errors now appear as not evaluated rather than evaluated recovery failures. Added a demonstration/evidence guide and artifact-integrity verification coverage. No additional paid model trials or new scientific performance claims were introduced.

The first follow-up validation passed 21 backend tests and the frontend type check. Expanded archive loading to include the earlier failed Gemini recovery attempt as well as the successful retry, so the page does not select only favorable archived recovery runs. Added coverage that an archived provider failure remains visible without a fabricated source-accuracy score. Visual browser verification is still pending.

Final focused verification: all seven Research Lab tests passed after archive expansion. Saved a fresh artifact inventory, statuses, actual outcomes and inspection hashes in `progress-report-1/evidence/lab-evidence-index.json`. This inventory is derived from existing records and is not an additional model trial.

Final production build: **passed**, exit 0, 24 static routes generated including `/research`; TypeScript and static page generation completed. Remaining build warning: existing multiple lockfiles/workspace-root inference.

Mounted-app check: both research routes are registered in `app.main`; unauthenticated GET and POST each returned HTTP 401. The final frontend type check passed after adding source hashes to the Provenance tab. No real credentials were used in API tests; the test-only identity is injected into a separate in-memory FastAPI instance.

User requested live public benchmarks and a comparison with the custom method inside FiskGrad. Added `/research` and sidebar navigation, authenticated research API, fixed experiment controls, saved run history, within-scenario strategy comparison, official reward display, trace/provenance inspection and JSON export. Integrated the existing pinned official AgentRx IR and τ-bench wrappers rather than relabeling custom methods as published implementations. Existing public τ task reward 0.0 and failed setup records remain visible.

Access uses the existing verified login plus an explicit research operator email allowlist. Execution defaults disabled; single backend worker only. New records are saved locally, failures retained, concurrent launches rejected. Added five meaningful API/scoring tests; all 20 backend tests passed, including an actual offline API-to-subprocess-to-artifact run. Frontend type check passed. Initial test attempt failed on sandbox temporary-file permissions; permitted retry passed. Initial production build failed on restricted Google Fonts access; permitted retry compiled and continued through build checks. Browser bootstrap failed due to missing sandbox metadata, so visual/signed-in browser checks are pending. No new paid benchmark trial was needed for this integration; existing live evidence is displayed, and live controls use the same fixed CLI paths.

Full published-method implementations and official-task selective recovery are still incomplete and labeled pending in the page. Same-task/same-evaluator head-to-head trials are the next research stage. Recorded local/single-worker, model substitution and comparison-scope assumptions in the assumption register. Setup and limitations: [Research Lab](research-lab.md).
# October 7, 2026 — Official-task recovery and grounded case study

Implemented `research.tau_recovery`, an external controller using pinned official retail tasks/tools/agent/user and unchanged grading. It supports no recovery, restart, visible retry, real periodic in-memory checkpoints, source rollback and dependency-aware recovery. Detection re-executes observed reads at the identical DB version; injected labels are scoring-only. Snapshots restore agent/user/DB/routing together. Conservative dependencies, version-keyed caching, one recovery and monotonic budgets are documented in `recovery-method.md`.

Recorded 3 task IDs × 3 faults × 3 seeds × 6 strategies = 162 controlled executions plus 9 unfaulted references in a **planned 171-cell matrix**. The matrix runner writes a complete plan before any calls and stops if adapter source changes. Full execution has not been run.

Live evidence retained: sandbox pilot could not connect; network v1 reference earned reward 1.0 with the fault reached, while selective hit HTTP 429 and remained ungraded. Preserved v1 adapter/protocol. Protocol v2 adds identical six-second pacing per agent/user generation within the time budget. The paced pair completed with reward 1.0 for both methods. Reference: 21 attempt steps, 15 model calls, 6 tool executions, 9 validation calls, no cache reuse, estimated cost $0.02614170, 127.20s. Selective: 25 steps, 17 model calls, 8 tool executions, 9 validation calls, no cache reuse, estimated cost $0.02800838, 128.76s. Selective found the source and restored state, but showed no efficiency/task-success advantage in this one trial. Evidence: `baselines/results/tau-recovery-pilot-paced-20261007/recovery-results.json`; costs are estimates, not verified billing.

Added pilot and partial Fisk checks to the site, with coverage/localization/usage/cost fields. Configured the provided operator email only in ignored `.env`, and fixed research settings to read that file. Retrieved five official Fisk catalog pages with URL/time/hash provenance. Structured 2024–2025 facts and ambiguities in `fisk-catalog-rules.json`; this edition is not assumed latest or universally applicable. Added four synthetic partial-audit cases for credits/GPA, missing coursework, low major grade and duplicate-credit rejection. Full degree clearance remains disabled, and production requirements were not silently replaced.

Prepared AgentRx's isolated environment (53 installed packages), verified official CLI loading, and added an all-stage public-sample runner. Preflight is access-blocked: no supported authenticated provider CLI. No full diagnosis/accuracy claim or gated-dataset acceptance. Environment/preflight evidence is under `baselines/results/agentrx-full-20261007T160911Z-bb49ae/`.

Final verification: primary backend discovery passed 26 tests with one optional tau-module skip; all six official-environment adapter tests passed separately. Production frontend build passed. Saved actual test/build transcripts and `progress-report-1/evidence/research-verification-20261007.json`. A test caught and fixed cached-response timestamps that broke official evaluator replay. Browser connection again rejected missing sandbox metadata, so signed-in visual verification remains pending. Full campaign, published-method reproduction and unresolved university conditions remain unfinished.

Started a single local backend worker and the built frontend for the user's demonstration. The first frontend bind was sandbox-denied; permitted retry started successfully. Local `/research` returned HTTP 200 and unauthenticated research API returned HTTP 401. Saved `progress-report-1/evidence/site-startup-check-20261007.json`. These are HTTP startup/auth checks, not signed-in visual verification.

### October 7, 2026: local frontend startup repair
The user encountered Tailwind CSS resolution against the repository root, which has Tailwind 3 while the web app uses Tailwind 4. Set an explicit app directory in web/next.config.mjs using turbopack.root. A Node configuration check confirmed the web root and resolved web/node_modules/tailwindcss/index.css. This is a development configuration repair, not a research outcome; signed-in visual verification remains pending.


### October 7, 2026: local sign-in connectivity repair
The frontend reported profile/plan HTTP 401 responses. A direct check of the existing backend signing-key loader failed in the sandbox with connection refused, then retrieved two Supabase public signing keys with approved network access. Restarted the local backend with network access; startup completed. No token verification was bypassed and no user credentials were requested. User-session verification after browser refresh remains pending.


### October 7, 2026: method/data claim audit
User reiterated baseline-first research grounding and saved provenance. Rechecked official AgentRx, maintained tau repository and Fisk catalog sources. Added method-data-audit.md distinguishing published resources, local execution, custom exploratory components and pending reproduction. Added sources and validation status to every Research Lab protocol; corrected stale v1 benchmark label to artifact-specific versioning. Custom recovery is not research-proven and no superiority claim is supported. Raw results and previous protocols were preserved.


### October 7, 2026: Research Lab layout cleanup
Separated Saved evidence and Run experiments views to reduce crowding. Added offline/live filters, larger spacing and controls, responsive run navigation, collapsible research scope/remaining work and run identifiers, and a spaced Method & data definition layout. Existing source/validation labels, results, traces, provenance and JSON export remain accessible. TypeScript passed; /research returned HTTP 200; diff whitespace check passed. Visual browser review remains blocked by the browser connection metadata error, so no screenshot or signed-in visual test is claimed.


### October 7, 2026: separate official and synthetic evidence
Grouped experiment controls and saved runs into Official benchmarks, Custom recovery on official tasks, Synthetic demonstrations, and Fisk catalog case study. Added shared section navigation and an explicit data/method category on selected evidence. The official-task custom extension is not labeled an official recovery benchmark; Fisk synthetic records remain identified even though rules come from official sources. TypeScript passed and the updated page returned HTTP 200. Browser visual verification remains pending.


### October 8, 2026: Progress Report 1 package prepared
Created build_submission.py using preserved official-task pilot, deterministic comparison, Fisk cases and dated verification records. Generated and visually reviewed the four-page PDF plus editable HTML, input-hash manifest and page previews. Added final video-script-final.md and submission-checklist.md. GitHub URL taken from configured origin; push and instructor access remain unverified. The report states equal pilot rewards with greater selective work, distinguishes custom work from published resources, and labels the 171-cell matrix as planned. No fresh model calls, video recording or Canvas upload occurred.


### October 8, 2026: experiment timing feedback
Added a running-experiment banner with an elapsed timer calculated from server started_at, activity spinner, prior completed local-run median when available, initial labeled duration guidance otherwise, and navigation to the active run. Estimated timing never reports a completion percentage or stops the elapsed counter. Longer waits remain running until backend status changes; completed/failed site records display total duration from server timestamps. Spinner respects reduced-motion preferences. TypeScript passed; visual browser connection verification was attempted separately.


### October 8, 2026: visible completed-run results
User observed the activity indicator disappear without an obvious result. Inspected latest local tau-smoke run 8313b0e8edaa4e80999c7d4457972edb: process completed but the saved official row has infrastructure_error, null reward and zero messages. Added Lab results navigation, persistent latest-run outcome/banner, automatic selection when a watched run finishes, chronological saved-run sorting, explicit ungraded execution-error messaging and expandable saved console details. Process completion remains separate from task success; prior artifacts were not rewritten. TypeScript and HTTP /research checks passed. Visual browser connection remains unavailable.


### October 8, 2026: consolidate Research Lab navigation
User found simultaneous navigation and repeated headings overwhelming. Consolidated to Run experiments / Results and one Category dropdown. Replaced the persistent saved-run sidebar with a grouped Choose a saved run dropdown. Selected evidence now uses its experiment name and Summary tab instead of duplicated Lab results headings. Moved prototype scope, coverage, next steps and source links into a single closed About this research disclosure. Latest-result banner only appears outside Results; running timer and automatic completed-result selection remain. TypeScript and HTTP page checks passed; visual browser review remains unavailable.


### October 8, 2026: compact controls and contextual guidance
Reduced Research Lab content width, heading size, card padding and repeated introductory copy. Added an optional Where to find things guide with direct navigation to experiments, results and Method & data. Experiment cards show name, offline/live cost label, Details and Run; scope, protocol and timing estimates expand on demand. Category explanations, console excerpts and result interpretation remain accessible through disclosures; errors, running feedback and experimental category labels remain visible. TypeScript and HTTP page checks passed; interactive visual review remains blocked by the browser connection.


### October 8, 2026: shared methods and readable evidence inspection
Moved current Method & data to a stable top-level reference view with experiment selection and clickable source links. Results use compact horizontal Summary / Trace / Provenance controls and a method-reference shortcut. Trace now supports per-method selection, search, recorded-event status/issue filtering, dependency jumps, recovery-event disclosures and bounded scrolling with pagination. Synthetic step traces, controlled-task nodes and official conversation messages are supported without inventing missing dependencies. Provenance summarizes run identifiers, timestamps, model, comparison group and available source/protocol hashes, with file listings and recorded settings disclosures. Raw evidence loads only when expanded. Current explanatory reference is explicitly distinguished from frozen historical protocol/configuration where recorded; existing evidence was preserved. TypeScript and HTTP page checks passed; visual interaction testing remains blocked by the browser connection.


### October 8, 2026: GitHub publication boundaries
Added docs/github-publishing.md and a README link defining reviewable source/research evidence versus local credentials, runtime logs, private student data, upstream environments and recordings. Expanded ignore rules for private keys/uploads/exports, recordings, compiler caches and local audit output. Added read-only Backend/scripts/check_publish.py covering indexed and working candidates against known local credential values, selected patterns and private paths; initial scan covered 423 candidates with no findings and one warning for already tracked web/tsconfig.tsbuildinfo. Check does not certify history, personal data, compressed documents or licenses. Existing staging was preserved; no untracking, commit or push occurred. Guide records how the user can stop tracking the generated cache while keeping its local copy.

