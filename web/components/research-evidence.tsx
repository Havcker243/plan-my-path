"use client";

import { useState } from "react";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, fallback = "Not recorded") => value == null ? fallback : String(value);

export function RawEvidence({ value, label = "View raw JSON" }: { value: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="mt-4 border-t pt-3 text-xs"><summary className="cursor-pointer py-2 text-muted-foreground">{label}</summary>{open && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3">{JSON.stringify(value, null, 2)}</pre>}</details>;
}

export function MethodReference({ protocol }: { protocol: unknown }) {
  return <dl className="divide-y text-sm">{Object.entries(record(protocol)).map(([key, value]) => <div key={key} className="grid gap-2 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"><dt className="font-medium capitalize">{key === "claim" ? "Evidence supports" : key.replaceAll("_", " ")}</dt><dd className="min-w-0 break-words leading-6 text-muted-foreground">{text(value).split(/(https?:\/\/[^\s;]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{part}</a> : part)}</dd></div>)}</dl>;
}

export function TraceViewer({ rows, official }: { rows: unknown[]; official?: unknown }) {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const row = record(rows[index] ?? rows[0]);
  const trace = record(row.trace);
  const direct = list(row.trace);
  const steps = list(trace.steps);
  const simulations = list(record(official).simulations);
  const simulation = record(row.simulation ?? simulations[index] ?? simulations[0]);
  const nodes = (direct.length ? direct : steps.length ? steps : list(simulation.messages)).map((value, i) => {
    const node = record(value);
    const message = record(list(node.messages)[0]);
    const output = record(node.output);
    const issue = Boolean(node.error || node.execution_error || output.valid === false || output.violation || node.status === "invalidated");
    return { id: text(node.id, String(i + 1)), title: text(node.name ?? node.kind ?? node.role, "Recorded event"),
      status: text(node.status, issue ? "issue" : "recorded"), issue,
      preview: text(node.content ?? message.content ?? node.recipient, ""),
      dependencies: list(node.dependencies ?? node.depends_on).map(String), node };
  });
  const filtered = nodes.filter(node => (filter === "all" || node.issue) && (!query || (query.startsWith("#") ? node.id === query.slice(1) : `${node.id} ${node.title} ${node.preview} ${node.status}`.toLowerCase().includes(query.toLowerCase()))));
  const events = list(row.events ?? trace.events);
  return <div className="space-y-4">
    <p className="text-xs leading-6 text-muted-foreground">Follow what happened, inspect an event, or jump to a dependency. “Issue” includes invalidated work; it does not prove that step caused the error. Conversation-only traces have no inferred dependencies.</p>
    <div className="flex flex-wrap gap-2">
      {rows.length > 1 && <label className="min-w-0 text-xs">Method<select aria-label="Trace method" value={index} onChange={e => { setIndex(Number(e.target.value)); setQuery(""); setLimit(50); }} className="ml-2 min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm">{rows.map((r, i) => <option key={i} value={i}>{text(record(r).strategy ?? record(r).case, `Result ${i + 1}`)}</option>)}</select></label>}
      <input aria-label="Search trace" placeholder="Search events or #step ID" value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }} className="min-h-11 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm" />
      <select aria-label="Filter trace" value={filter} onChange={e => { setFilter(e.target.value); setLimit(50); }} className="min-h-11 rounded-lg border bg-card px-3 text-sm"><option value="all">All events</option><option value="issues">Issues / invalidated</option></select>
    </div>
    {!!events.length && <details className="rounded-lg border p-3 text-xs"><summary className="cursor-pointer font-medium">Recovery and state events ({events.length})</summary><div className="mt-3 max-h-56 space-y-3 overflow-auto">{events.map((event, i) => { const item = record(event); return <div key={i} className="border-t pt-3"><p className="font-medium">{text(item.type ?? item.event ?? item.reason, `Event ${i + 1}`)}</p>{item.predicted_source_node != null && <p className="mt-1">Predicted source: {text(item.predicted_source_node)} · Restore boundary: attempt {text(item.boundary_attempt_step)}</p>}<RawEvidence value={event} label="Event details" /></div>; })}</div></details>}
    <p className="text-xs text-muted-foreground">{filtered.length} matching events · {nodes.length} recorded</p>
    <div className="max-h-80 space-y-2 overflow-auto pr-1">{filtered.slice(0, limit).map((node, i) => <details key={`${node.id}-${i}`} className={`rounded-lg border p-3 ${node.issue ? "border-amber-300/70" : ""}`}><summary className="cursor-pointer text-sm"><span className="mr-2 font-mono text-xs text-muted-foreground">#{node.id}</span>{node.title}<span className="ml-2 text-xs text-muted-foreground">{node.status}</span></summary>
      {!!node.preview && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">{node.preview.slice(0, 350)}{node.preview.length > 350 ? "…" : ""}</p>}
      {!!node.dependencies.length && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span>Depends on:</span>{node.dependencies.map(id => <button key={id} onClick={() => { setQuery(`#${id}`); setFilter("all"); }} className="rounded border px-3 py-2 text-primary">#{id}</button>)}</div>}
      <RawEvidence value={node.node} label="Inputs, outputs and full event" />
    </details>)}{!filtered.length && <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{nodes.length ? "No events match. Clear the search or choose All events." : "No step or conversation trace was recorded for this result. Inspect the raw evidence for setup outputs, academic cases or execution errors."}</p>}</div>
    {filtered.length > limit && <button onClick={() => setLimit(n => n + 50)} className="rounded-lg border px-4 py-2 text-sm">Show 50 more events</button>}
    <RawEvidence value={official ?? rows} label="Full original trace evidence" />
  </div>;
}

export function ProvenanceViewer({ run }: { run: unknown }) {
  const data = record(run);
  const evidence = record(data.evidence);
  const manifest = record(evidence.manifest);
  const upstream = record(manifest.upstream);
  const files = list(evidence.artifacts);
  const fields = { "Run ID": data.id, "Started": data.started_at, "Finished": data.ended_at,
    "Comparison group": evidence.comparison_group, "Model": evidence.model,
    "Protocol hash": manifest.protocol_sha256, "Adapter hash": manifest.adapter_sha256,
    "Official repository revision": upstream.commit };
  return <div className="space-y-4"><p className="text-xs leading-6 text-muted-foreground">Use this record to identify the run, locate its saved files, and check which code and settings it used. Inspection hashes identify file bytes; they do not prove correctness.</p>
    <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(fields).filter(([, value]) => value != null).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-xs leading-6">{text(value)}</dd></div>)}</dl>
    <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">Saved evidence files ({files.length})</summary><div className="mt-3 max-h-64 space-y-3 overflow-auto">{files.map((file, i) => { const item = record(file); return <div key={i} className="break-all border-t pt-3 text-xs"><p className="font-medium">{text(item.path)}</p><p className="mt-2 font-mono text-muted-foreground">SHA-256 at inspection: {text(item.sha256_at_inspection)}</p></div>; })}{!files.length && <p className="text-xs text-muted-foreground">No artifact paths were recorded.</p>}</div></details>
    <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">Method and settings attached to this run</summary><p className="mt-3 text-xs leading-6 text-muted-foreground">Frozen protocol/configuration below is preserved when present. The display reference may reflect current explanatory labels; it must not replace an older execution protocol.</p><RawEvidence value={{ recorded_protocol: manifest.protocol_definition ?? manifest.protocol, configuration: manifest.configuration, display_reference: evidence.protocol, command: data.command, source_sha256: data.source_sha256 }} label="Recorded settings and reference" /></details>
    <RawEvidence value={run} label="Complete provenance record" />
  </div>;
}
