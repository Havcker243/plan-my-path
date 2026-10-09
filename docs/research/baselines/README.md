# Official Baseline Reproduction

Latest addition: [controlled recovery on released tasks](../recovery-method.md), its [171-cell planned protocol](../tau-recovery-protocol.json), and [Fisk case-study grounding](../fisk-case-study.md). A live paired faulted pilot earned reward 1.0 for both methods; selective used more steps/calls. This is separate from the first unchanged reference outcome below. Full AgentRx remains access-blocked; its isolated dependencies and complete public-sample runner are prepared. Older pending task-selection notes below describe the earlier smoke phase; the new extension has explicit tasks/seeds/counts.

Updated October 7, 2026. Reproduce published methods on released benchmarks before developing custom recovery improvements. See [assumptions](../assumptions.md), [research log](../research-log.md), and [pinned revisions](upstream-lock.json).

[Benchmark and method inventory](benchmark-method-inventory.md) distinguishes downloaded/executed resources from literature candidates and records overlapping domains and reproduction limits.

| Target | Purpose | Completed | Pending |
| --- | --- | --- | --- |
| [AgentRx](https://github.com/microsoft/AgentRx) | Constraint-assisted failure diagnosis | Unmodified IR normalization on all seven public tau-retail samples; logs, normalized traces, and manifests saved | Authorized full dataset access, authenticated inference endpoint, full pipeline, label-safe scoring, repeated evaluation |
| [Maintained tau-bench](https://github.com/sierra-research/tau2-bench) | Executable tasks and official grading | Pinned setup, official checks, live reference, external recovery adapter, planned matrix and live paired pilot | Execute full matrix; reproduce published recovery methods |

Public samples are not the full AgentRx benchmark. Preprocessing is not diagnosis. A one-task tau run is setup evidence, not a benchmark-wide score or a recovery experiment. Neither upstream source nor its evaluator has been modified.

Successful offline tau verification is recorded in `results/tau-check-20261007T150735Z-6a8eb7/`. The official tests reported two warnings (an upstream pytest option and cache permissions), with 15 passes and no test failures. An earlier wrapper attempt failed before testing because uv selected an inaccessible user cache; that attempt remains in `results/`.

## First official live outcome

`results/tau-smoke-20261007T150829Z-ec909b/official-results.json` contains one official retail task-0 simulation using `gemini/gemini-3.5-flash-lite` for the unmodified agent and user simulator. It ended with `user_stop` after about 59.41 seconds and 16 messages. The official reward is **0.0**, with `db_match=false`. Four expected read actions matched, while the expected exchange write action did not match. This is a completed run with a failed task, not a provider/setup error or a successful agent result. No root-cause attribution is claimed from action matching alone.

Upstream-reported estimated costs are $0.01454813 for the agent and $0.00236250 for the user simulator ($0.01691063 combined); these are benchmark estimates, not a checked billing statement. Grading retained the task's reward basis. This task has no natural-language assertions, so the official grader reports that there are none to evaluate; no grading component was manually disabled. The source result includes configuration, policies, task criteria, full messages, usage, rewards, and termination metadata. Do not interpret one failed task as a benchmark-wide model score.

## Commands

From `Backend`:

```powershell
.\.venv\Scripts\python -m research.official_baselines agentrx-ir
.\.venv\Scripts\python -m research.official_baselines tau-check
```

The following invokes real models on official retail task 0, one trial, with the official agent and user simulator:

```powershell
.\.venv\Scripts\python -m research.official_baselines tau-smoke --model gemini/gemini-3.5-flash-lite
```

Each invocation creates a unique `results/` directory. Manifests record revisions, commands, timestamps, input hashes, exit codes, and logs. Read official rewards and termination reasons; exit zero alone does not mean task success. Task 0 is selected before seeing outcomes. Final study task selection and repeated-trial counts are pending.

## Setup and deviations

Clone the repositories into the `local_path` entries in `upstream-lock.json` and check out the exact commits. Preserve upstream licenses. Install tau dependencies with `uv sync --python 3.13 --extra dev --extra voice --extra knowledge`. Python 3.13 also needs `audioop-lts==0.2.2`, because the official CLI imports the removed standard module. The wrapper sets UTF-8 and a workspace uv cache. Its core-only install failed on optional voice imports; a direct Windows check also failed on console encoding. These are setup failures, not agent-task failures.

Gemini replaces upstream default agent and user models if smoke mode is used. The wrapper imposes a 180-second per-simulation and 240-second process timeout to bound setup runs. Record these deviations with results. Task/policy/evaluator files remain unchanged. Natural-language grading may need another provider/model; do not silently remove grading components.

The maintained repository retains the name `tau2-bench` and CLI `tau2`, despite tau3-era branding. Pin package 1.0.1 and the exact commit rather than mixing legacy-task scores. AgentRx source version and annotated dataset version must be frozen separately. Dataset access and authenticated Azure/Copilot inference are not assumed. No Gemini adapter is silently substituted into AgentRx.

The earlier custom study design is superseded as the primary benchmark plan. Fisk CS remains the eventual case study after an official reference has been established. Synthetic demos remain mechanism illustrations.
## Complete AgentRx runner

Official requirements are installed in `.research-upstream/AgentRx/.venv`, and the CLI loads. Authenticate a supported provider CLI before running `research.official_baselines agentrx-full --endpoint copilot` (or `azure` from the CLI). The site fixes Copilot. All official stages are retained, one fixed public sample is selected before results, and no Gemini substitution or accuracy scoring is invented. The blocked preflight and exact installed versions are preserved. Full gated-dataset access and label-safe evaluation remain separate requirements.

