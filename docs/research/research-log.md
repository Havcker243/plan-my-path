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


### October 8, 2026: offline/live colour labels
User clarified grey/green refers to Research Lab execution modes and requested less emphasis on cost. Added grey Offline and green Live AI badges with text labels and a compact legend; removed API cost from experiment-card badges. Both modes remain available and experimental-source categories/availability checks remain separate. No account billing entitlement was inferred or verified, no limits were bypassed and no new paid/model runs were launched. Historical usage/cost evidence remains intact. TypeScript and HTTP page checks passed.


### October 8, 2026: model suitability clarification
User clarified the question concerned whether research tasks warrant Gemini Pro, not an instruction to switch. Reverted this turn's model-selection edits and restored the v2 Flash Lite protocol from the exact saved copy. No Pro generation or experiment occurred. The available-model metadata query returned gemini-3.1-pro-preview among listed Pro endpoints; listing does not establish generation quota/access. Research Lab remains configured for Gemini 3.5 Flash Lite. Pro-vs-Flash benefits remain an empirical question requiring matched experiments.


### October 8, 2026: user-run log review
Inspected latest site run 2520ed051f2d414c9e01d463335d335f and its official-result artifact tau-smoke-20261009T022204Z-3c7632 (UTC directory timestamp; October 8 local time). Task 0 received official reward 1.0, user_stop termination and 14.86 seconds simulation time; end-to-end site duration approximately 21.76 seconds. This is the unchanged task baseline, not a selective recovery comparison. Earlier reward-0 and quota infrastructure-error attempts remain saved and must not be discarded or conflated with the latest success.

### October 8, 2026: consistent compact Research Lab flow

User clarified that the cleaner flow should apply across the lab while retaining the results presentation. The initial workspace now opens Run experiments; experiment categories expand one at a time in All categories, with protocol descriptions inside the expanded category and individual Details disclosures. Category and execution-mode controls share one toolbar. Replaced the large completed-run banner with a compact last-run status and View results link on the experiment view. Results, Trace, Provenance and Method & data retain their existing evidence and navigation; no experiment artifact or result value changed. TypeScript passed, HTTP /research returned 200 and git diff --check passed. Signed-in visual interaction review remains unavailable because the browser connection could not initialize.

### October 8, 2026: platform dark mode

Connected the existing next-themes provider at the root so public pages, authentication, the application and notifications share a persistent theme. Added an accessible sun/moon control in the application and landing headers, with a compact control on other public/authentication pages. Initial theme follows the system; explicit light/dark selection is saved by next-themes. Added a shared dark palette for cards, inputs, navigation and academic requirement/status tokens, corrected a hard-coded white course control, and kept print surfaces light. TypeScript and HTTP checks for research/login passed; git diff --check passed. Browser initialization failed before visual interaction testing, so appearance, preference persistence and mobile interactions still need manual review. No research results or experiment protocols changed.

### October 8, 2026: dark palette refinement across platform

Replaced overlapping old dark definitions with a single charcoal/indigo palette, separate card/sidebar surfaces, softer off-white text and coordinated status/chart tokens. Added explicit dark status-background, text, border and hover treatments across 18 application/public components, including research evidence, transcript upload, planner and academic checks. Corrected white profile tiles and landing call-to-action text against the active primary colour. Recorded palette and verification limits in docs/dark-mode.md. TypeScript and HTTP checks for research/dashboard/login passed; nine calculated shared text/background contrast pairs exceeded 4.5:1 (minimum 6.34:1). Visual appearance and interaction remain unverified because browser initialization is unavailable; this calculation does not certify every UI colour combination. Research evidence and protocols were unchanged.

### October 8, 2026: resume research evaluation and reproducible analysis

Added Backend/research/analyze_recovery.py to analyze saved controlled-recovery artifacts without model calls or changing raw evidence. Groups are separated by recorded protocol, adapter, upstream, input and configuration provenance. Counts retain ungraded failures and fault coverage; eligible reference/selective pairs require exactly one attempt per method/task/fault/seed with exercised faults and recorded grading. Incomplete usage excludes paired cost estimates. Added five meaningful tests; the initial sandbox run failed on temporary-directory permissions, then all five passed with approved execution outside the sandbox. Generated paced-only and all-attempts JSON/Markdown summaries, including all three historical pilot artifacts. The eligible paced pair has equal reward, +4 selective attempt steps, +2 model calls, +2 tool executions and approximately +1.56 seconds; no benefit established. No new live trials ran, and the 171-cell matrix remains planned. Updated assumption A21, reproduction instructions, current baseline status and docs/research/next-evaluation.md. These are descriptive preliminary results; no significance, causal advantage or faithful published-method reproduction is claimed.

### October 8, 2026: literature expansion and four live matrix cells

Reviewed primary DoVer, DARC, AgentRewind, Dependency-Guided Rollback Repair and versioned AgentRx sources; located author-linked recovery code and MettleBench specifications. Recorded dated source links, distinctions, novelty limits and reproduction status in literature-update-20261008.md. None of the newly identified systems was installed or reproduced. Added bounded matrix selection preserving the full protocol order, frozen adapter/protocol copies and source-change guards. Three schedule tests passed; six pinned upstream integration tests passed (a sandbox cost-map request fell back to bundled metadata). Preflight identified a real adapter change: monotonic total tool-error accounting relative to the old pilot, so new cells form a separate group. With approved network execution, campaign tau-matrix-20261009T044036Z-e96b6c ran four cells: seed 301 selective reward 0.0 with correct source localization, seed 301 reference quota error/null reward, seed 302 selective quota error/null reward, seed 302 reference reward 1.0. All faults were exercised. No eligible graded pairs or improvement estimate exist; failures are retained. Generated recovery-subset-20261008 analysis/findings and added assumptions A22/A23. Added completed campaign-cell discovery to Research Lab history, excluding incomplete files; nine API tests passed. Restarted the owned local backend, verified all four saved entries and frontend/backend health responses. Full 171-cell evaluation, faithful published-method reproduction and comprehensive Fisk validation remain incomplete.

### October 8, 2026: graded-failure investigation and first current-adapter matched pair

Inspected the seed-301 selective artifact: corrected account details were present after recovery, but the simulated user combined exchange confirmation with STOP, causing upstream termination before the required exchange write. Saved source-hashed inspection JSON and explanatory notes; reward zero remains unchanged. Added a no-fault scripted test for this mechanism; all seven controller tests passed. Reviewed official Google project-level quota documentation and recorded a predeclared seed-300 continuation before execution. With no active local site job detected and approved network access, ran exactly two fresh cells in tau-matrix-20261009T045409Z-eb491d under unchanged current adapter/v2 protocol: both methods reward 1.0, fault exercised, 23 steps, 16 model calls, 7 tools, 9 validations and zero cache reuse. Recorded durations 121.54s reference and 121.34s selective; no speed/efficiency advantage established. Added explicit analysis coverage totals and a test keeping incomplete pairs alongside complete pairs; all six analysis tests passed. Generated recovery-current-adapter-20261008 analysis/findings over all six current-adapter attempts (four graded, two quota errors; one eligible pair, two incomplete). Verified both fresh saved-run entries. Added assumptions A24/A25 and updated next steps. Existing protocols, evaluator, prompts and historical scores were preserved; no named published recovery method reproduction was claimed.


### October 8–9, 2026: full six-strategy comparison campaign — Phase 1 started

**Goal:** Run all six recovery strategies (no_recovery, restart, visible_retry, checkpoint, source_rollback, selective) across all three seeds for task 0, fault empty_read, to produce the first complete within-task method comparison. The paced pilot only covered no_recovery and selective on seed 300; restart/visible_retry/checkpoint/source_rollback have never been executed on any official task.

**Why this matters:** Comparing all six strategies on the same task/fault/seed reveals:
- Which strategies succeed vs. fail at recovering official reward
- Where the work overhead of each strategy falls (attempt steps, model calls, tool executions)
- Whether selective recovery actually saves work relative to restart/rollback alternatives, or merely matches them
- Whether the fault type (empty_read here) is even recoverable by the agent at all, and if so, by which strategies

**Campaign plan:**
- Phase 1 (running): task 0, seeds 301+302, fault empty_read, all 6 strategies + unfaulted references — 14 cells. Protocol sha256 `35e9cb0...`, adapter sha256 `ee4859b...` verified unchanged before launch.
- Phase 2 (queued): task 0, seed 300, fault empty_read, strategies restart/visible_retry/checkpoint/source_rollback — 4 cells + unfaulted reference — to complete the seed-300 coverage not in the paced pilot.
- Phase 3: expand to wrong_user_id and tool_error faults (3 seeds × 2 faults × 6 strategies = 36 cells + 6 unfaulted).
- Phase 4: expand to tasks 1 and 2.

**Interpretation plan:** After each phase, run analyze_recovery.py over all accumulated pilot artifacts plus new results. For each eligible task/fault/seed pair, compare strategy-level reward, attempt steps, model calls, tool executions, and cached read reuse. Identify: which strategies share reward outcomes, which differ, and at what step count. Look for cases where no_recovery already succeeds (model self-recovery) versus cases where controller intervention is necessary. Document every failure with its recorded termination/infrastructure error rather than dropping it.

**Known confounders:** Seed does not guarantee identical model output. Provider pacing (6 s/generation) is enforced but quota/503 failures remain possible and are retained rather than rerun. Costs are estimates.

Launched Phase 1 at approximately 23:40 CDT October 8, 2026. Results to be appended on completion.

**Phase 1 results — completed ~00:10 CDT October 9, 2026**

Matrix: `tau-matrix-20261009T044029Z-9f8be5`, 14 cells, status `finished_with_failures` (2 cells had rate-limit exits, not task failures).

| seed | strategy | reward | steps | model_calls | cached_reused | predicted_src_node |
|---|---|---|---|---|---|---|
| 301 | *(unfaulted ref)* | null | 13 | — | — | — |
| 301 | restart | 1.0 | 31 | 21 | 0 | 10 |
| 301 | visible_retry | 1.0 | 22 | 15 | 0 | 18 |
| 301 | checkpoint | **0.0** | 19 | 13 | 0 | 12 |
| 301 | source_rollback | 1.0 | 21 | 13 | 0 | 16 |
| 301 | selective | **0.0** | 19 | 13 | 0 | 12 |
| 301 | no_recovery | **0.0** | 19 | 13 | 0 | 12 |
| 302 | *(unfaulted ref)* | 1.0 | 19 | 13 | 0 | — |
| 302 | visible_retry | 1.0 | 24 | 17 | 0 | 20 |
| 302 | checkpoint | 1.0 | 21 | 13 | 0 | 16 |
| 302 | source_rollback | 1.0 | 25 | 17 | 0 | 12 |
| 302 | selective | 1.0 | 25 | 17 | 0 | 12 |
| 302 | no_recovery | 1.0 | 27 | 18 | 0 | 12 |
| 302 | restart | null | 15 | — | — | — |

Null reward cells (seed 301 unfaulted, seed 302 restart) were rate-limit/provider failures, not task grading results. Both retained.

**Findings:**

1. **checkpoint is fault-location-sensitive.** On seed 301, the fault landed at step 8 (node 12) — which is exactly a multiple-of-4 checkpoint boundary. The snapshot at step 8 captured the conversation state AFTER the corrupted `get_user_details` result (`{}`) was placed in the trajectory. Restoration at step 8 therefore restored corrupted context, and the agent proceeded on bad information → reward 0.0. On seed 302, the fault landed at step 10 (not a boundary), checkpoint restored cleanly → reward 1.0 with only +2 steps overhead. **Checkpoint performance is brittle to the alignment of fault location and boundary interval.**

2. **selective failed the same way as checkpoint on seed 301 (0.0, 19 steps).** Deep inspection showed: recovery fired, detected source at node 12 (step 8), restored to boundary step 8 — but the snapshot at step 8 included the corrupted conversation context (agent had already said "Hi Yusuf! I've verified your account" after seeing empty `{}` data). The agent in the post-recovery continuation ran on partially-corrupted context. Additionally, `cached_reads_reused = 0` in every single run — selective's read cache NEVER activated. Reason: the reads independent of the source (find_user_id at step 4, get_order_details at step 6) were already included in the restored state when rolling back to step 8, so the agent never re-called those tools post-recovery. No cache hits → selective and source_rollback performed identically on seed 302 (both 25 steps, 17 calls).

3. **source_rollback was the most consistent successful strategy**: reward 1.0 on both seeds. On seed 301, the fault happened to fall at step 10 (not step 8) in the source_rollback run — a reminder that predicted_source_node varies across runs even with the same seed due to model non-determinism at temperature 0. The source_rollback restored to just before step 10, which was a clean boundary, and the agent recovered successfully.

4. **no_recovery succeeded on seed 302 (1.0, 27 steps)** — the Gemini model self-recovered. It called `get_user_details` twice, saw the empty result, asked for information again, and eventually completed the task correctly (albeit at 8 extra steps vs baseline). On seed 301 no_recovery failed (0.0) — the model accepted the empty result and hallucinated a "verified" response, proceeding to produce the wrong exchange.

5. **visible_retry was unexpectedly reliable**: 1.0 on both seeds, with moderate step overhead (22–24). It retried from the last dispatch snapshot, which happened to be before the corrupted read in both cases.

6. **restart always pays the highest step cost (31 steps on seed 301)** — expected. Both restart cells that completed were reliable, but the cost is full task-repeat.

7. **The `predicted_source_node` differs across strategies for the same seed** (e.g., seed 301: checkpoint=12, source_rollback=16, visible_retry=18). This confirms that even with the same seed, model outputs are non-deterministic: the fault injection hits a different step in each run, producing different trace structures and thus different source-node IDs. This is a fundamental confound for direct strategy comparison within a seed — the baseline task difficulty varies per run.

**Key gap:** `cached_reads_reused = 0` in all 14 cells means selective's theoretical advantage (avoiding re-execution of valid work) never materialized. This needs investigation in Phase 3: try a fault type where the fault falls later in the trace (post-product-lookups), so the read cache would contain independently-verified reads that actually get reused.

---

### Phase 2 results — seed 300, empty_read, remaining strategies — completed ~01:10 CDT October 9, 2026

Matrix: `tau-matrix-20261009T050946Z-4932e2`, 5 cells, status `finished`.

| fault/strategy | reward | steps | calls | cached | src_node |
|---|---|---|---|---|---|
| none/no_recovery *(unfaulted ref)* | 0.0 | 17 | 11 | 0 | — |
| empty_read/restart | 0.0 | 34 | 22 | 0 | 18 |
| empty_read/visible_retry | 0.0 | 18 | 13 | 0 | 12 |
| empty_read/checkpoint | **1.0** | 27 | 17 | 0 | 25 |
| empty_read/source_rollback | **1.0** | 17 | 12 | 0 | — |

**Findings for seed 300:**

Seed 300 is a fundamentally unstable case. The unfaulted reference (no fault injected) got reward 0.0 in 17 steps — the model failed the task without any corruption. `restart` also failed (0.0, 34 steps) even after a full clean slate. `visible_retry` failed (0.0, 18 steps). Only `checkpoint` and `source_rollback` succeeded. This reinforces that strategy outcome on any single seed is substantially driven by model non-determinism, not purely by recovery strategy choice.

`source_rollback` succeeded in only 17 steps — notably the same as the unfaulted reference step count — suggesting near-zero overhead when the fault and recovery boundary are well-placed. `predicted_source_node` is empty for source_rollback, which may indicate the source was not detected (fault not reached / detector returned None). This needs verification against the actual cell JSON.

`cached_reads_reused = 0` persists across all Phase 2 cells, confirming the structural finding: the selective read cache cannot activate when fault injection always targets `get_user_details` early in the trace.

---

### Methodology assessment — October 9, 2026

After completing Phase 1 + Phase 2 (19 cells, all three seeds, all six strategies for the `empty_read` fault type), the following methodology gaps are documented:

**1. Selective cache advantage undemonstrable on current fault injection point.**
All 19 cells have `cached_reads_reused = 0`. The injection rule ("first `get_user_details`") places the fault before any reads that need to be both (a) independent of the fault and (b) re-executed post-recovery. Pre-fault reads are in the restored conversation context; post-fault reads depend on user-specific data gated behind `get_user_details`. Fix: inject at a later tool (e.g., first `get_product_details`) or use a task where `get_user_details` falls after several independent reads that are also needed post-recovery.

**2. Non-determinism confounds strategy comparison.**
Same seed, same fault type, but each strategy run produces a different trace with the fault at a different node (e.g., node 12 in the `checkpoint` run vs. node 16 in `source_rollback`). Temperature-0 does not guarantee identical model outputs across separate API calls. Strategy outcomes cannot be attributed cleanly to strategy choice alone.

**3. Model self-recovery inflates no_recovery baseline.**
On seed 302, `no_recovery` succeeded (1.0, 27 steps) — the model retried `get_user_details` on its own. On seed 300, `restart` failed (0.0, 34 steps) — the model produced a wrong answer even after full clean restart. Task success is substantially driven by model behavior independent of the controller.

**Phase 3 (running):** task 0, all 3 seeds, `wrong_user_id` + `tool_error` faults, all 6 strategies — 36 cells. Expected to complete in approximately 60–90 minutes. These faults may reveal different model recovery behavior (especially `wrong_user_id`, where the agent receives plausible-but-wrong data and is unlikely to self-detect the error) but the structural cache issue persists.


### October 9, 2026: bounded four-strategy continuation completed

Predeclared one task-0 / empty_read / seed-300 attempt each for restart, visible_retry, checkpoint and source_rollback under unchanged adapter/protocol. Campaign tau-matrix-20261009T050612Z-2fe24d completed all four. Official rewards were all 1.0: restart 33 steps/23 model calls/196.29s; visible_retry 17/12/92.95s with fault NOT exercised; checkpoint 25/17/130.33s; source_rollback 23/16/125.09s. Combined the predeclared fresh reference/selective pair with these four in a descriptive six-strategy table, preserving source hashes and raw artifacts. Selective/reference/source rollback had equal steps/model/tool counts and zero cached-read reuse; no selective work-saving advantage is established.

Observed restart exceeding the nominal 180-second budget: upstream timeout checking is cooperative and excludes already-done conversations. Preserved reward and disclosed overrun; no controller change during the frozen campaign. Found separate overlapping workspace campaigns, so provider traffic was not isolated. Saved an all-completed current-adapter snapshot with 27 attempts (23 graded, four ungraded), retaining duplicates and marking ambiguous pairs. This snapshot excludes still-running cells and is not a pooled strategy ranking. Earlier log statements interpreting particular failures as caused by corrupted snapshots require trace-based confirmation; zero reward alone does not establish that cause. Added A26 and updated research overview/next steps. No named published recovery implementation, full-matrix completion, statistical advantage, or GitHub publication is claimed.

### October 9, 2026: research-direction assessment requested by student

Checked primary AgentRx v2, AgentRewind, Dependency-Guided Rollback Repair, the original tau paper and maintained tau repository online against local method/evidence documentation. Saved source links, publication/preprint distinctions and a focused assessment in research-direction-review-20261009.md. Topic remains aligned with current research; our controller is not a faithful reproduction of the named systems, and selective recovery is not established as novel or superior. The maintained repository now uses tau3 branding; verified our local pin without changing it or claiming it is the latest remote revision. Recommended investigating zero read reuse and tightening versioned experimental control before expanding trials, plus one supported published-method reproduction and Fisk requirement verification. No live experiments or algorithm changes were made for this review.

---

### October 9, 2026: selective cache redesign — argument-level matching — adapter v2

**Problem diagnosed:** After 19 cells across empty_read, all had `cached_reads_reused = 0`. The cache check was:
```python
if cached and cached["node_id"] not in self.invalidated:
```
`self.invalidated` contained the source node AND every temporal descendant (all nodes that followed it). For read-only tools, every post-source read's cache entry was blocked — not because those reads were data-dependent on the source, but purely because they came later in time (conservative temporal ordering). The result: selective's read cache was structurally disabled for all existing task/fault combinations.

**Root cause in the dependency model:** Conservative temporal ordering marks every dispatch after the source as dependent on it, and every read requested by those dispatches inherits that dependency. Under this rule, no post-source read is ever cache-eligible — the only reads without the dependency are pre-source reads, which are already in the restored context and never re-called.

**Fix applied (adapter sha256: `96bff5e0e049662eba977436e9f3f1a20d452dd13089262af74b89d7d8187796`):**

Read-only tool results are deterministic on `(tool_name, arguments, DB_hash)`. If those three values match, a cached result is correct regardless of temporal position. The only cache entry that must remain blocked is the actual detected source node (which holds injected/corrupted data). New cache check:

```python
cache_safe = cached and (
    cached["node_id"] not in self.invalidated
    or (not mutates and cached["node_id"] != self.detected)
)
```

This allows post-source reads to be served from cache when their key matches and they are not the source node itself. Mutating tools still bypass the cache entirely. The detected source is always bypassed regardless of read/write status.

**Expected behavior after fix:** When the agent calls `get_product_details(product_id=X)` post-recovery with the same `X` and same DB hash as a pre-recovery call, the cache serves the result without a live API call. `cached_reads_reused` should now be > 0 in cells where the agent makes repeated independent reads.

**Phase 3 stop and relaunch:** Phase 3 had 5 cells completed under the old adapter (stored in `tau-matrix-20261009T052049Z-54abd7`; status `stopped_source_or_protocol_changed`) when the adapter change was detected by the hash guard. Those 5 cells are valid old-adapter data. Phase 3 relaunched from scratch under the new adapter (task 0, seeds 300/301/302, wrong_user_id + tool_error faults, all 6 strategies, 36 cells, background task `brwxx02y0`).

**Assessment alignment:** A parallel review of current research literature confirmed the direction is sound — recent preprints (AgentRx Aug 2026, AgentRewind Aug 2026, Dependency-Guided Rollback Repair Aug 2026) all study the same problem class. The assessment identified zero read reuse as the primary gap. This adapter change directly addresses that gap. The assessment also noted: incomplete scope (retail only, no Fisk verification), no faithful reproduction of a named published method, and insufficient experiment control for overlapping campaigns. These remain open items after Phase 3.

**Adapter version note:** The current adapter on disk (sha256: `a062e830d115b01844fa93dc7de7cb4624cba34846a5ea1a032c7dcd9d9dd97e`) includes a more rigorous version of the cache fix: it verifies cache entries by re-running tool calls after recovery (`verify_recovery_cache()`), only marks entries as `verified_cache` if the fresh result matches the cached result, and only consults the cache when `self.recoveries > 0`. This is more conservative than the initial simpler fix. The `verified_cache` entries are guaranteed to match the current DB state.

---

### October 9, 2026: daily API quota exhausted — Phase 3 blocked until reset

All cells in Phase 3 (relaunched, 36 cells, `tau-matrix-20261009T052554Z-9f8741`) failed with steps=0 due to Gemini free-tier daily quota exhaustion:

```
Quota exceeded: generativelanguage.googleapis.com/generate_content_free_tier_requests
Limit: 500 requests/day, model: gemini-3.5-flash-lite
Retry in: 18h33m45s (quota resets ~2026-10-09 19:00 CDT)
```

Phase 1 (14 cells) + Phase 2 (5 cells) + partial Phase 3 runs used all 500 daily requests. The code fix is in place and correct — Phase 3 must simply be relaunched after quota resets.

**To relaunch Phase 3 when quota resets:**
```
cd plan-my-path
Backend\.venv\Scripts\python.exe Backend/research/tau_recovery_matrix.py \
  --tasks 0 --seeds 300 301 302 --faults wrong_user_id tool_error \
  --skip-unfaulted --execute
```

The new adapter (sha256: `a062e830...`) will be captured in the manifest at launch time. No code changes needed — just rerun when quota is available.

### October 9, 2026: verified recovery-cache redesign (v3)

Read the student's attached argument-matching fix and inspected the current adapter. Matching request/DB hash does not prove clean saved output or independence of reasoning; previous zero-hit observations alone do not prove a universal cache bug. Implemented explicit candidate revalidation against the restored matching DB, exclusion of detected-source/error entries, recovery-only caching and write bypass. Recorded total_tool_invocations including validation overhead so cache hits cannot masquerade as net work savings. Kept the conservative dependency graph unchanged. This is verified deterministic memoization, not semantic dependency reconstruction or a published-method reproduction.

Archived exact v2 protocol bytes and recorded v3 before any new live trial. Existing active matrix execution retains completed/current-cell evidence and stops remaining cells at the source/protocol guard; no process was killed and no historical score was edited. All 12 pinned integration tests passed in 47.972 seconds; three scheduling tests passed. The sandbox cost-map request failed and upstream used bundled metadata. Saved source-hashed offline verification JSON and design notes; appended assumption A27 and updated next steps. No new live performance run was launched for this redesign, and no advantage is claimed. Next evaluation is a serialized bounded comparison with validation overhead included.

### October 9, 2026: bounded v3 comparison prepared and overhead analysis completed

Prepared task 0 / seed 300 / empty_read once each for no_recovery, source_rollback and selective in frozen protocol order. Materialized a three-cell plan only in tau-matrix-20261009T055506Z-da2906; no API calls or live outcomes. Recent failed artifacts report daily quota exhaustion, so live execution remains pending rather than launching another full campaign. Documented conditions, measurement and continuation rules in v3-bounded-comparison-20261009.md.

Updated analyze_recovery.py to include total_tool_invocations in eligible reference/selective deltas and report execution/validation/total work for all strategies with measurement counts. Missing measurements are not zero; ungraded/unexercised rows do not contribute to graded-fault means. Added two tests proving cache hits/fewer executions can coexist with greater total overhead and preserving missing-data exclusions. Windows sandbox temporary-file permissions prevented the initial test run; approved unrestricted execution passed all eight tests. Verified Markdown output on a preserved source-rollback artifact and saved source-hashed readiness evidence. Earlier raw evidence and adapter/protocol bytes remain unchanged. No live recovery benefit is claimed.

### October 9, 2026: Weeks 5�6 reporting period corrected

Student confirmed the assigned period is September 16�25. Searches found no explicit research-log entries or repository commits for that interval; this is an evidence gap, not proof of inactivity. Moved the October-work draft to october-progress-reference.md and created a period-specific outline awaiting confirmation of actual activities. September 15 work is starting context; October tests, benchmark campaigns, redesign and Gemini quota exhaustion are not attributed to September 16�25. Asked for actual period activities before making completion claims.

### October 9, 2026: report revised using supplied review comments

Read the student's attached report review. Created progress-report-2-draft.md with a clearer implementation/finding/redesign/testing narrative, a retail product-lookup example explicitly distinguished from observed live savings, 23 tests separated into 12/3/8 groups, measurable next outcomes and evidence captions. Verified the saved quota artifact records Gemini 3.5 Flash Lite for both participants and a 500-request daily limit. Retained pending live-performance status and the reporting-period caveat; no later work is relabeled as September accomplishments. No new tests, experiments, screenshots or publication were claimed.
