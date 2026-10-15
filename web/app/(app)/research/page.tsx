"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Play, RefreshCw, Download, ExternalLink, LoaderCircle, Clock3, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { MethodReference, TraceViewer, ProvenanceViewer } from "@/components/research-evidence";

type Protocol = { category: string; benchmark: string; method: string; data: string; evaluator: string; design: string; question: string; claim: string };
type Row = { strategy: string; success?: boolean; reward?: number | null; repeated_steps?: number; diagnostic_steps?: number; preserved_valid_steps?: number; recovery_ms?: number; tokens?: number; termination_reason?: string; task_id?: string; duration?: number; trace?: unknown; provider_error?: unknown; execution_error?: string; fault_exercised?: boolean; exact_source_accuracy?: boolean | null; model_calls?: number; validation_tool_calls?: number; cached_reads_reused?: number; fault?: string; seed?: number; total_attempt_steps?: number; tool_executions?: number; estimated_attempt_cost_usd?: number; cost_usage_complete?: boolean; case?: string; result?: { status: string; earned_credits: number; fisk_gpa: number | null; degree_cleared: boolean } };
type Run = { id: string; action: string; status: string; archived?: boolean; started_at?: string; ended_at?: string; error?: string; console?: string; command?: string[]; source_sha256?: Record<string, string>; evidence?: { comparison_group: string; model?: string; limitations: string; rows: Row[]; official?: unknown; manifest?: unknown; protocol?: Protocol; artifacts?: { path: string; sha256_at_inspection: string }[] } };
type Action = { id: string; label: string; scope: string; paid: boolean; blocked: string | null; protocol: Protocol };
type Snapshot = { runs: Run[]; actions: Action[]; busy: boolean; model: string; unavailable: string[] };
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const GROUPS = [
  { id: "official", label: "Official benchmarks", description: "Released benchmark code and data. Includes setup, preprocessing and the unchanged task baseline; completion status is shown for each run.", actions: ["agentrx-ir", "agentrx-full", "tau-check", "tau-smoke"] },
  { id: "extension", label: "Custom recovery on official tasks", description: "Released tasks and grading with our injected faults and recovery controller. This is an experimental extension, not an official recovery benchmark.", actions: ["tau-recovery"] },
  { id: "synthetic", label: "Synthetic demonstrations", description: "Researcher-created academic fixtures for checking recovery mechanics, with offline or live model diagnosis.", actions: ["custom-offline", "custom-live"] },
  { id: "fisk", label: "Fisk catalog case study", description: "Official catalog requirements with synthetic student records and partial validation. No real student data or full graduation clearance.", actions: ["fisk-case-study"] },
];
const METHODS: Record<string, { label: string; explanation: string }> = {
  no_recovery: { label: "Official reference · no added recovery", explanation: "Uses the same instrumented official agent, detector and injected fault without automatic rollback." },
  restart: { label: "Full workflow restart", explanation: "Invalidates every initial task step and executes the workflow again." },
  visible_retry: { label: "Retry visible failure", explanation: "Retries validation where the error becomes visible; earlier corrupted state remains." },
  checkpoint: { label: "Simulated late-checkpoint restore", explanation: "Replays proposal and validation from a fixed boundary that already contains the bad audit; not a persisted framework checkpoint." },
  source_rollback: { label: "Source-based sequential rollback", explanation: "Uses the deterministic locator, then invalidates all task steps from that source onward." },
  selective: { label: "Selective recovery · rule-based locator", explanation: "Checks the audit against its inputs, then invalidates only the source and its dependency descendants." },
  agent_selective: { label: "Selective recovery · Gemini locator", explanation: "Gemini predicts the source from the observed trace; dependency tracking invalidates affected steps for deterministic replay." },
  "official llm_agent": { label: "Official tool-calling reference agent", explanation: "Pinned upstream agent with Gemini model substitution; no selective-recovery extension." },
};

// Initial guidance, not measured service guarantees. Completed local runs replace it.
const RUN_TIMES: Record<string, { label: string; upper: number }> = {
  "custom-offline": { label: "Usually a few seconds", upper: 15 },
  "fisk-case-study": { label: "Usually a few seconds", upper: 15 },
  "custom-live": { label: "Allow roughly 15–90 seconds", upper: 90 },
  "agentrx-ir": { label: "Allow roughly 10–60 seconds", upper: 60 },
  "tau-check": { label: "Allow roughly 10–60 seconds", upper: 60 },
  "tau-smoke": { label: "Allow roughly 1–3 minutes", upper: 180 },
  "tau-recovery": { label: "Allow roughly 4–6 minutes for both trials", upper: 360 },
  "agentrx-full": { label: "May take up to 17 minutes", upper: 1020 },
};

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function ExecutionBadge({ live }: { live: boolean }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${live ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-zinc-400"}`} />{live ? "Live AI" : "Offline"}</span>;
}

function runOutcome(run: Run) {
  if (run.status === "running") return "Experiment running";
  if (run.status !== "completed") return `Run ${run.status} · inspect error details`;
  if (!run.evidence) return "Run finished · no result artifact available";
  const rows = run.evidence.rows;
  if (!rows.length) return "Setup finished · no task score expected";
  if (run.action === "fisk-case-study") return "Partial academic checks available";
  if (rows.some(r => r.execution_error || r.provider_error || r.termination_reason === "infrastructure_error")) return "Run finished · execution error, inspect results";
  if (run.action.startsWith("tau") && rows.every(r => r.reward == null)) return "Run finished · no graded task result";
  return "Results ready · inspect task outcomes below";
}

function ExperimentTimer({ run, label, runs, onOpen }: { run: Run; label: string; runs: Run[]; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.id]);
  const started = Date.parse(run.started_at ?? "");
  const elapsed = Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : null;
  const durations = runs.filter(r => r.action === run.action && r.status === "completed" && !r.archived && r.ended_at && r.started_at)
    .map(r => (Date.parse(r.ended_at!) - Date.parse(r.started_at!)) / 1000)
    .filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const midpoint = Math.floor(durations.length / 2);
  const median = durations.length ? (durations[midpoint] + durations[Math.floor((durations.length - 1) / 2)]) / 2 : null;
  const guidance = RUN_TIMES[run.action];
  const longer = elapsed !== null && elapsed > (median !== null ? median * 1.5 : guidance?.upper ?? Infinity);
  return <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
    <LoaderCircle aria-hidden="true" className="h-6 w-6 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
    <div className="min-w-0 flex-1"><p role="status" className="text-sm font-medium">{longer ? "Still running · longer than expected" : "Experiment running"}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{median !== null ? `Previous completed runs: about ${formatElapsed(median)} (${durations.length} ${durations.length === 1 ? "run" : "runs"}).` : `${guidance?.label ?? "Duration varies"}. Initial estimate only.`} {longer ? "The backend has not reported completion yet." : "Actual duration can vary with API response times."}</p>
    </div>
    <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-3"><Clock3 size={16} aria-hidden="true" className="text-muted-foreground" /><span aria-label="Elapsed time" className="font-mono text-lg font-medium tabular-nums">{elapsed === null ? "—" : formatElapsed(elapsed)}</span><span className="text-xs text-muted-foreground">elapsed</span></div>
    <button onClick={onOpen} className="min-h-11 rounded-xl border bg-card px-4 py-2 text-sm transition-colors hover:bg-muted">View run</button>
    <p className="w-full text-xs text-muted-foreground">Status checks every 4 seconds. Keep this run open or return later; completion is confirmed by the backend.</p>
  </div>;
}

export default function ResearchPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, select] = useState<string>("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState("results");
  const [workspace, setWorkspace] = useState<"evidence" | "experiments" | "reference">("experiments");
  const [referenceId, setReferenceId] = useState("tau-smoke");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [showGuide, setShowGuide] = useState(false);
  const [runQuery, setRunQuery] = useState("");
  const [runLimit, setRunLimit] = useState(6);
  const [expandedGroup, setExpandedGroup] = useState("official");
  const observedRunning = useRef(new Set<string>());
  const request = useCallback(async (method = "GET", action?: string) => {
    const response = await fetch(`${BASE}/api/research/runs`, {
      method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      ...(action ? { body: JSON.stringify({ action }) } : {}),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Research request failed.");
    return body;
  }, [accessToken]);
  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try { setData(await request()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load research evidence."); }
  }, [accessToken, request]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 4000); return () => clearInterval(timer); }, [refresh]);
  // Keep the result of a watched run in view when its running banner disappears.
  useEffect(() => {
    if (!data) return;
    const finished = data.runs.filter(r => observedRunning.current.has(r.id) && r.status !== "running")
      .sort((a, b) => Date.parse(b.ended_at ?? b.started_at ?? "") - Date.parse(a.ended_at ?? a.started_at ?? ""))[0];
    observedRunning.current = new Set(data.runs.filter(r => r.status === "running" && !r.archived).map(r => r.id));
    if (finished) {
      select(finished.id);
      setCategory(GROUPS.find(group => group.actions.includes(finished.action))?.id ?? "all");
      setWorkspace("evidence");
      setTab("results");
    }
  }, [data]);
  const visibleGroups = GROUPS.filter(group => category === "all" || group.id === category);
  const sortedRuns = [...(data?.runs ?? [])].sort((a, b) => (Date.parse(b.started_at ?? "") || 0) - (Date.parse(a.started_at ?? "") || 0));
  const visibleRuns = sortedRuns.filter(run => visibleGroups.some(group => group.actions.includes(run.action)));
  const matchingRuns = visibleRuns.filter(run => `${data?.actions.find(a => a.id === run.action)?.label ?? run.action} ${run.status} ${run.id} ${run.started_at ? new Date(run.started_at).toLocaleString() : ""}`.toLowerCase().includes(runQuery.toLowerCase()));
  const active = visibleRuns.find(r => r.id === selected) ?? visibleRuns[0];
  const running = data?.runs.find(run => run.status === "running" && !run.archived);
  const latestFinished = sortedRuns.find(run => !run.archived && run.status !== "running");
  function openResult(run: Run) {
    select(run.id);
    setCategory(GROUPS.find(group => group.actions.includes(run.action))?.id ?? "all");
    setWorkspace("evidence");
    setTab("results");
  }
  async function start(action: string) {
    setPending(true);
    try { const job = await request("POST", action); observedRunning.current.add(job.id); openResult(job); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to start experiment."); }
    finally { setPending(false); }
  }
  function download() {
    if (!active) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(active, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${active.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  const synthetic = active?.evidence?.comparison_group === "synthetic-delayed-audit-v1";
  const controlled = active?.action === "tau-recovery";
  const academic = active?.action === "fisk-case-study";
  const referenceActions = data?.actions.filter(action => visibleGroups.some(group => group.actions.includes(action.id))) ?? [];
  const referenceAction = referenceActions.find(action => action.id === referenceId) ?? referenceActions[0];
  return <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><FlaskConical size={18} /> Senior Seminar II · Research workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agent Recovery Lab</h1>
        <p className="mt-2 text-sm text-muted-foreground">Experiments and evidence, in one place.</p></div>
      <div className="flex flex-wrap items-center gap-2"><button aria-expanded={showGuide} aria-controls="lab-guide" onClick={() => setShowGuide(value => !value)} className="min-h-11 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">{showGuide ? "Close guide" : "Where to find things"}</button><button onClick={() => void refresh()} aria-label="Refresh research evidence" title="Refresh evidence" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted"><RefreshCw size={16} /></button></div>
    </div>
    {showGuide && <section id="lab-guide" aria-label="Research Lab guide" className="rounded-xl border bg-card p-5"><h2 className="text-sm font-semibold">What would you like to do?</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">
      <button onClick={() => { setWorkspace("experiments"); setShowGuide(false); }} className="rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted"><span className="block text-sm font-medium">Run a new experiment</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">Choose a category, check Details, then Run.</span></button>
      <button onClick={() => { setWorkspace("evidence"); setCategory("all"); setTab("results"); setShowGuide(false); }} className="rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted"><span className="block text-sm font-medium">Find results</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">Select a saved run to see its outcome or error.</span></button>
      <button onClick={() => { setWorkspace("reference"); setShowGuide(false); }} className="rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted"><span className="block text-sm font-medium">Understand the evidence</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">Method & data is the shared reference. Results → Trace shows events; Provenance identifies files and recorded settings.</span></button>
    </div></section>}
    {error && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</div>}
    {!data && !error && <p role="status">Loading research evidence…</p>}
    {data && <>
      {pending && !running && <p role="status" className="flex items-center gap-3 rounded-xl border p-4 text-sm"><LoaderCircle aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" />Starting experiment…</p>}
      {running && <ExperimentTimer key={running.id} run={running} label={data.actions.find(a => a.id === running.action)?.label ?? running.action} runs={data.runs} onOpen={() => { select(running.id); setCategory(GROUPS.find(group => group.actions.includes(running.action))?.id ?? "all"); setWorkspace("evidence"); setTab("results"); }} />}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1" aria-label="Workspace view">{(["experiments", "evidence", "reference"] as const).map(view => <button key={view} aria-pressed={workspace === view} onClick={() => setWorkspace(view)} className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${workspace === view ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{view === "evidence" ? "Results" : view === "reference" ? "Method & data" : "Run experiments"}</button>)}</div>
        {workspace === "experiments" && <div role="group" aria-label="Experiment mode" className="flex gap-1 rounded-lg border p-1">{[{id: "all", label: "All modes"}, {id: "offline", label: "Offline"}, {id: "live", label: "Live AI"}].map(mode => <button key={mode.id} aria-pressed={filter === mode.id} onClick={() => setFilter(mode.id)} className={`min-h-11 rounded-md px-3 text-xs font-medium ${filter === mode.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{mode.label}</button>)}</div>}
      </div>
      <div role="group" aria-label="Research category" className="flex gap-2 overflow-x-auto pb-1">{[{id: "all", label: "All categories"}, ...GROUPS].map(group => <button key={group.id} aria-pressed={category === group.id} onClick={() => { setCategory(group.id); setTab("results"); setRunLimit(6); }} className={`min-h-11 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${category === group.id ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-muted"}`}>{group.label}</button>)}</div>
      {!running && latestFinished && workspace === "experiments" && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p className="flex items-center gap-2">{runOutcome(latestFinished).includes("error") || latestFinished.status !== "completed" || runOutcome(latestFinished).includes("no graded") ? <AlertCircle size={14} aria-hidden="true" className="shrink-0 text-amber-600 dark:text-amber-300" /> : <CheckCircle2 size={14} aria-hidden="true" className="shrink-0 text-primary" />}Last run: {data.actions.find(a => a.id === latestFinished.action)?.label ?? latestFinished.action} · {runOutcome(latestFinished)}</p><button onClick={() => openResult(latestFinished)} className="min-h-11 px-2 text-primary hover:underline">View results →</button></div>}
      {workspace === "reference" && <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label="Shared method and data reference"><div><h2 className="text-sm font-medium">Experiment reference</h2><div role="group" aria-label="Experiment reference" className="mt-3 flex gap-2 overflow-x-auto pb-2">{referenceActions.map(action => <button key={action.id} aria-pressed={referenceAction?.id === action.id} onClick={() => setReferenceId(action.id)} className={`min-h-11 max-w-64 shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${referenceAction?.id === action.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{action.label}</button>)}</div></div><p className="text-xs leading-6 text-muted-foreground">Current shared reference. For the exact settings of an earlier run, open Results → Provenance. Changing this selection does not change any experiment.</p>{referenceAction && <MethodReference protocol={referenceAction.protocol} />}{referenceAction?.id.startsWith("custom") && <details className="border-t pt-4 text-sm"><summary className="cursor-pointer font-medium">Synthetic recovery strategy definitions</summary><dl className="mt-4 space-y-4">{["restart", "visible_retry", "checkpoint", "source_rollback", "selective", "agent_selective"].map(key => <div key={key}><dt className="font-medium">{METHODS[key].label}</dt><dd className="mt-1 text-xs leading-6 text-muted-foreground">{METHODS[key].explanation}</dd></div>)}</dl></details>}</section>}
      {workspace === "experiments" && <section className="space-y-6">
      <p className="text-xs leading-6 text-muted-foreground">Open a category, inspect Details, then Run. Grey is offline; green uses live AI.</p>
      {visibleGroups.map(group => {
        const actions = data.actions.filter(a => group.actions.includes(a.id) && (filter === "all" || (filter === "live" ? a.paid : !a.paid)));
        const expanded = category !== "all" || expandedGroup === group.id;
        return <section key={group.id} aria-label={group.label} className="rounded-xl border bg-card p-4"><h3><button aria-expanded={expanded} aria-controls={`experiment-group-${group.id}`} onClick={() => { if (category !== "all") { setCategory("all"); setExpandedGroup(""); } else { setExpandedGroup(expanded ? "" : group.id); } }} className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-sm font-semibold"><span>{group.label}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{actions.length} experiments · {expanded ? "Hide −" : "Show +"}</span></button></h3>
      {expanded && <div id={`experiment-group-${group.id}`} className="space-y-3 pt-3"><p className="max-w-3xl text-xs leading-6 text-muted-foreground">{group.description}</p>
      {!actions.length && <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">No experiments in this section match the selected filter.</p>}
      <div className="grid items-start gap-3 lg:grid-cols-2">{actions.map(a => <article key={a.id} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
        <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-medium leading-6">{a.label}</h4><ExecutionBadge live={a.paid} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><details className="min-w-0 flex-1 text-xs"><summary className="cursor-pointer py-2 font-medium text-muted-foreground">Details{a.blocked ? " · access required" : ""}</summary><div className="mt-2 space-y-2 pb-2 leading-6 text-muted-foreground"><p className="font-medium text-primary">{a.protocol.category}</p><p>{a.scope}</p><p>{a.protocol.question}</p><p>{a.protocol.design}</p><p className="flex items-center gap-2"><Clock3 size={14} aria-hidden="true" />{RUN_TIMES[a.id]?.label ?? "Duration varies"} · estimate</p>{a.blocked && <p>{a.blocked}</p>}</div></details>
        <button aria-label={`Run ${a.label}`} disabled={!!a.blocked || data.busy || pending} onClick={() => void start(a.id)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><Play size={14} />{a.blocked ? "Local only" : data.busy ? "Busy" : "Run"}</button></div>
      </article>)}</div></div>}</section>})}</section>}
      {workspace === "evidence" && <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section aria-label="Saved runs" className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Saved runs</h2>
          <input aria-label="Search saved runs" value={runQuery} onChange={e => { setRunQuery(e.target.value); setRunLimit(6); }} placeholder="Search experiment, status or date" className="mt-3 min-h-11 w-full rounded-lg border bg-background px-3 text-xs" />
          <p className="mt-2 text-xs text-muted-foreground">{matchingRuns.length} {matchingRuns.length === 1 ? "run" : "runs"}{runQuery ? " match" : " available"}</p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto lg:max-h-[32rem]">{matchingRuns.slice(0, runLimit).map(run => <button key={run.id} aria-pressed={active?.id === run.id} onClick={() => { select(run.id); setTab("results"); }} title={run.id} className={`min-h-11 w-full rounded-lg border p-3 text-left transition-colors ${active?.id === run.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
            <span className="block text-xs font-medium leading-5">{data.actions.find(a => a.id === run.action)?.label ?? run.action}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{run.status} ? {run.started_at ? new Date(run.started_at).toLocaleString() : "Recorded evidence"}</span>
            <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">{run.id}</span>
          </button>)}{!matchingRuns.length && <p className="py-4 text-xs text-muted-foreground">{runQuery ? "No matching runs. Try another search." : "No saved runs in this category."}</p>}</div>
          {matchingRuns.length > runLimit && <button onClick={() => setRunLimit(value => value + 6)} className="mt-3 min-h-11 w-full rounded-lg border px-3 text-xs hover:bg-muted">Show 6 more</button>}
        </section>
        <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5" aria-label="Selected experiment evidence">
          {active ? <><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="mb-2 text-xs font-medium text-primary">{GROUPS.find(group => group.actions.includes(active.action))?.label}</p><h2 className="text-xl font-semibold">{data.actions.find(a => a.id === active.action)?.label ?? active.action}</h2><p className="mt-2 text-sm font-medium">{runOutcome(active)}</p><p className="mt-1 text-xs text-muted-foreground">Process: {active.status} · {active.evidence?.model ?? "Model not recorded / setup only"}</p></div><button onClick={download} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download size={14} /> Export JSON</button></div>
          <div className="my-4 flex gap-1 overflow-x-auto border-b pb-2" aria-label="Result views">{["results", "trace", "provenance"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)} className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm capitalize transition-colors ${tab === t ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}>{t === "results" ? "Summary" : t}</button>)}<button onClick={() => { setReferenceId(active.action); setWorkspace("reference"); }} className="ml-auto min-h-11 shrink-0 px-3 py-2 text-xs text-muted-foreground hover:text-primary">Method reference ↗</button></div>
          {active.error && <p className="mb-3 text-sm text-destructive">{active.error}</p>}
          {active.status === "running" && <p className="mb-3 text-sm text-muted-foreground">Results will appear here when the backend finishes. The elapsed timer above continues while you wait.</p>}
          {active.status !== "running" && active.started_at && active.ended_at && Number.isFinite(Date.parse(active.ended_at) - Date.parse(active.started_at)) && <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} aria-hidden="true" />Total run time: {formatElapsed(Math.max(0, (Date.parse(active.ended_at) - Date.parse(active.started_at)) / 1000))}</p>}
          {tab === "results" && <>
            {active.evidence?.rows.some(r => r.termination_reason === "infrastructure_error" || r.provider_error || r.execution_error) && <div role="alert" className="mb-5 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">An execution or provider error prevented at least one task from being evaluated. “Process completed” does not mean the task succeeded. Ungraded outcomes are shown below; inspect the saved trace and console for details.</div>}
            {active.status !== "running" && !active.evidence && <p className="mb-5 rounded-xl border p-4 text-sm">No result artifact was saved for this run. Inspect the error and console below; this run has no evaluated score.</p>}
            {active.status !== "running" && <details className="mb-4 text-xs"><summary className="cursor-pointer py-2 font-medium text-muted-foreground">Execution log and error details</summary><p className="mt-2 leading-6 text-muted-foreground">The trace and provenance tabs contain the full saved evidence. This console excerpt may show why an API call or benchmark failed.</p><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs">{active.error || active.console || "No console excerpt stored on this record. Inspect Trace and Provenance for its original artifacts."}</pre></details>}
            <details className="mb-4 text-xs"><summary className="cursor-pointer py-2 font-medium text-muted-foreground">Scope and interpretation</summary><p className="mt-2 leading-6 text-muted-foreground">{active.evidence?.limitations ?? "Evidence will be recorded when execution finishes."}</p></details>
            {academic && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-medium">Partial Fisk rule checks · synthetic records · graduation clearance disabled</caption><thead><tr><th className="p-2">Case</th><th className="p-2">Earned credits</th><th className="p-2">Fisk GPA</th><th className="p-2">Audit status</th></tr></thead><tbody>{active.evidence?.rows.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.case?.replaceAll("_", " ")}</td><td className="p-2">{r.result?.earned_credits}</td><td className="p-2">{r.result?.fisk_gpa ?? "Unavailable"}</td><td className="p-2">{r.result?.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}
            {!academic && !!active.evidence?.rows.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-medium">{synthetic ? "Within-scenario recovery comparison" : "Official task evaluation · execution completion is separate from task success"}</caption>
              <thead className="border-b text-xs text-muted-foreground"><tr><th className="p-2">Method</th><th className="p-2">{synthetic ? "Recovery" : "Reward"}</th>{synthetic ? <><th className="p-2">Repeated steps</th><th className="p-2">Diagnosis steps</th><th className="p-2">Valid steps kept</th><th className="p-2">Tokens</th></> : <><th className="p-2">Task</th><th className="p-2">Termination</th><th className="p-2">Seconds</th></>}</tr></thead>
              <tbody>{active.evidence.rows.map((r, i) => <tr key={i} className="border-b"><td className="p-2 font-medium">{controlled && r.strategy === "selective" ? "Selective recovery · versioned-read detector" : METHODS[r.strategy]?.label ?? r.strategy}</td><td className="p-2">{synthetic ? (r.provider_error ? "Provider error · not evaluated" : r.success === undefined ? "Not evaluated" : r.success ? "Recovered" : "Failed") : (r.reward ?? "Not graded")}</td>{synthetic ? <><td className="p-2">{r.repeated_steps ?? "—"}</td><td className="p-2">{r.diagnostic_steps ?? "—"}</td><td className="p-2">{r.preserved_valid_steps ?? "—"}</td><td className="p-2">{r.tokens ?? "—"}</td></> : <><td className="p-2">{r.task_id}</td><td className="p-2">{r.execution_error ? "Execution error" : r.termination_reason}</td><td className="p-2">{r.duration?.toFixed(2) ?? "—"}</td></>}</tr>)}</tbody>
            </table></div>}
            {active.evidence && !active.evidence.rows.length && <p className="rounded-lg bg-muted p-4 text-sm">Setup evidence only. No model task accuracy or recovery score was measured.</p>}
            {synthetic && <p className="mt-4 text-xs text-muted-foreground">Repeated steps exclude the separate diagnosis step. Valid steps kept counts only initially correct task outputs. Tokens include recorded input, output and thought tokens; zero means no model usage, and a dash means unavailable. These rows are not repeated independent trials.</p>}
            {!synthetic && !academic && !!active.evidence?.rows.length && <p className="mt-4 text-xs text-muted-foreground">Reward 0 means this task did not satisfy the official evaluator; reward 1 means it did. One task is not a benchmark-wide accuracy estimate. Seconds is the official simulation duration.</p>}
            {controlled && <div className="mt-4 space-y-3"><p className="text-sm font-medium">Controlled-fault coverage and recovery diagnostics</p>{active.evidence?.rows.map((r, i) => <div key={i} className="rounded-lg border p-3 text-xs"><p className="font-semibold">{r.strategy} · fault {r.fault} · seed {r.seed}</p><p className="mt-1">Fault reached: {r.fault_exercised === undefined ? "Unknown" : r.fault_exercised ? "Yes" : "No · recovery not exercised"} · Exact source match: {r.exact_source_accuracy == null ? "Not evaluated" : r.exact_source_accuracy ? "Yes" : "No"}</p><p className="mt-1">Model calls: {r.model_calls ?? "Unavailable"} · Validation tool calls: {r.validation_tool_calls ?? "Unavailable"} · Cached reads reused: {r.cached_reads_reused ?? "Unavailable"}</p><p className="mt-1">Attempt steps: {r.total_attempt_steps ?? "Unavailable"} · Tool executions: {r.tool_executions ?? "Unavailable"} · Attempted cost estimate: {r.estimated_attempt_cost_usd == null ? "Unavailable" : `$${r.estimated_attempt_cost_usd.toFixed(5)}`} {r.cost_usage_complete ? "(recorded usage; billing unverified)" : "(usage incomplete)"}</p>{r.execution_error && <p className="mt-2 break-words text-destructive">{r.execution_error}</p>}</div>)}</div>}
          </>}
          {tab === "trace" && <TraceViewer key={active.id} rows={active.evidence?.rows ?? []} official={active.evidence?.official} />}
          {tab === "provenance" && <ProvenanceViewer run={active} />}
          </> : <p>No experiment evidence is available yet.</p>}
        </section>
      </div>}
      <details className="border-t pt-5 text-sm"><summary className="cursor-pointer text-muted-foreground">About this research</summary><p className="mt-5 max-w-3xl leading-7 text-muted-foreground">This is a research prototype with preliminary evidence. Synthetic demonstrations are not public benchmarks or complete Fisk degree audits. Our recovery extension on official tasks remains experimental; cross-suite scores do not establish which method is better. Sources and validation status are available under Method & data.</p><h2 className="mt-5 font-medium">Coverage and next steps</h2><ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground">{data.unavailable.map(item => <li key={item}>{item}</li>)}</ul>
        <div className="mt-4 flex flex-wrap gap-4 text-sm"><a className="flex items-center gap-1 text-primary underline" href="https://github.com/microsoft/AgentRx" target="_blank" rel="noreferrer">AgentRx source <ExternalLink size={12} /></a><a className="flex items-center gap-1 text-primary underline" href="https://github.com/sierra-research/tau2-bench" target="_blank" rel="noreferrer">τ-bench source <ExternalLink size={12} /></a></div>
      </details>
    </>}
  </div>;
}
