# Research Lab demonstration and evidence guide

New official-task demonstration: select the saved **Official-task recovery pilot** paced run. Both methods earned reward 1.0 with the fault reached. Show the source-match event, restored boundary, full trace and cost/work counters. Explain that selective used 25 attempt steps/17 model calls versus 21/15 for the reference in this one pair; it did not show improvement. Show earlier connection/quota failures as ungraded attempts. The **Fisk catalog case-study checks** display source-grounded partial calculations and manual-review boundaries. **AgentRx full public-sample pipeline** remains access-blocked. Do not claim the full 171-cell matrix or published-method reproduction is complete.

Use this guide when running experiments and explaining progress. This is an explanation of implemented work, not a claim that the full research study is finished.

## Show and explain

Current evidence navigation: the main workspace has **Run experiments**, **Results**, and a shared **Method & data** reference. Within a selected result, compact **Summary / Trace / Provenance** tabs show one view at a time. Trace supports method selection, event search, issues/invalidated filtering, dependency jumps and event details; original JSON stays collapsed. Provenance summarizes identifiers, saved files/hashes and recorded settings. Historical protocol/configuration is distinguished from current reference text; a missing historical field is not inferred.

Latest navigation cleanup (October 8): use **Run experiments** or **Results**, with the **Category** dropdown for official benchmarks, custom official-task extensions, synthetic demonstrations or Fisk checks. In Results, select a run using **Choose a saved run**; its Summary, Method & data, Trace and Provenance appear below. Scope and remaining work are under **About this research**. Earlier navigation descriptions below refer to prior layouts.

The October 7 layout opens on **Saved evidence**. Use **Run experiments** to launch a new run, with **Show** filtering offline checks or live AI. Starting a run returns to Saved evidence automatically. The research scope and remaining-work sections expand on demand; Method & data, Trace, Provenance and Export JSON remain available for each selected run.

1. Open `/research` after completing the local setup in [research-lab.md](research-lab.md). Explain the main question: can an agent locate the earlier source of a failure and safely preserve unaffected work?
2. Show each experiment's category and expand **What this experiment tests**. Identify public released benchmark data separately from the synthetic academic fixture. Five recovery strategies are five methods on one scenario, not five scenarios or five repeated trials.
3. Run **Synthetic recovery comparison**. Select the new site run and show its Run ID. Expected fixture outcomes: restart, source rollback and selective recovery succeed; visible retry and the simulated late-checkpoint strategy fail. Selective recovery repeats three task steps and retains four initially valid task steps. Explain that diagnosis is counted separately and this first comparison uses a deterministic locator.
4. Open **Method & data**. Show the algorithm descriptions and evaluation scope. The checkpoint baseline is a simulation of a fixed late boundary, not a reproduced checkpointing framework. The selective method is our prototype, not AgentRx or another published method.
5. Open **Trace**. For the selective fixture row, point to corrupted audit step 3 and affected descendants 6 and 7. Independent outputs remain available. The hidden injected source is used for scoring; it is not supplied to the Gemini locator.
6. Open **Provenance** and export JSON. Match the Run ID, model, command/source hashes and evidence paths. Inspection hashes identify artifact bytes; original manifests record execution-time information. Preserve each run's output rather than replacing unfavorable results.
7. Show the recorded official **tau-bench live retail baseline**. Explain the task/split/seed/model and official evaluator. The first recorded run has reward 0.0 despite successful process completion. Show the reward breakdown and conversation/tool trace without inventing a root-cause diagnosis. This is one task, not suite accuracy. A fresh live run uses paid API calls; all attempts count as evidence.
8. Show **AgentRx public samples** and **tau-bench environment checks**. These are preprocessing/setup stages. They provide concrete artifacts and tool-test evidence, but no recovery or diagnosis accuracy score. Full AgentRx diagnosis remains pending.
9. If running **Gemini selective recovery**, explain that the model diagnoses the source, while replay and final checks are deterministic. Show the actual outcome, including provider failure if it occurs. Do not describe a provider failure as an evaluated wrong diagnosis.
10. Finish with the page's remaining-work list: published-method reproduction, official-task recovery adapter, matched experiment conditions and repeated trials. Explain that the Fisk catalog case study still requires verified requirement extraction; the nine-credit fixture is illustrative.

## Evidence inventory

Current navigation: the lab opens **Run experiments**. Under All categories, expand one category at a time, check an experiment's **Details**, then select **Run**. Category and Mode share the toolbar; Mode applies only to experiments. **Results** contains the saved-run selector and Summary / Trace / Provenance views. **Method & data** is the shared reference. The compact last-run status links to its saved results, while an active run keeps its elapsed timer visible. This flow supersedes earlier navigation descriptions in this guide.

Both workspace views separate **Official benchmarks**, **Custom recovery on official tasks**, **Synthetic demonstrations**, and **Fisk catalog case study**. Use the section navigation to focus on one category, or All sections to see grouped headings. Official benchmark data can still represent simulated customers; the custom fault controller is an experimental modification. Fisk rules are official catalog facts, while student records are synthetic.

| Evidence | What it supports | What it does not establish |
|---|---|---|
| New site run JSON, console and dependency trace | Actual execution of the selected prototype experiment | General improvement across tasks |
| Official tau result + pinned revision/input hashes | Outcome on an unchanged released task under the recorded model/configuration | Paper reproduction or full-suite accuracy |
| AgentRx generated IR artifacts | Official public-sample preprocessing works | Full AgentRx diagnosis or recovery works |
| Official retail tool tests | Tool/environment checks pass | Agent decisions are correct |
| Backend/API tests and frontend build | Implemented interface and tested execution paths function | Visual browser verification or all live-provider paths tested |
| Assumption register and dated log | Scope, decisions, uncertainty and changes are recorded | Assumptions have all been empirically validated |

For a submission, retain the exported JSON, a screenshot of the results and selected Run ID, a trace excerpt, the source revision, and the relevant assumptions. Report failures and pending stages alongside successes. Do not state that a screenshot or video has been recorded until it actually exists.
