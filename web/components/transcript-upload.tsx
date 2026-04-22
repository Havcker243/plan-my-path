"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle2, Circle, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchCoursesBySubject,
  parseTranscriptPDF,
  type ParsedTranscriptCourse,
} from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export interface TranscriptResult {
  courses: ParsedTranscriptCourse[];
  gpa: number | null;
  studentName: string | null;
}

interface Props {
  onResult: (result: TranscriptResult) => void | Promise<void>;
  onCancel: () => void;
}

type State =
  | { phase: "idle" }
  | { phase: "parsing" }
  | { phase: "review"; raw: TranscriptResult; selected: Set<string>; unmatchedRowIds: Set<string> }
  | { phase: "error"; message: string };

const GRADE_COLOR: Record<string, string> = {
  "A+": "text-green-600", A: "text-green-600", "A-": "text-green-600",
  "B+": "text-blue-600", B: "text-blue-600", "B-": "text-blue-600",
  "C+": "text-yellow-600", C: "text-yellow-600", "C-": "text-yellow-600",
  "D+": "text-orange-500", D: "text-orange-500", "D-": "text-orange-500",
  F: "text-red-600",
};

function termKey(course: ParsedTranscriptCourse) {
  return course.sourceType === "transfer"
    ? "transfer"
    : `${course.year ?? "unknown"}-${course.term ?? "unknown"}`;
}

function groupLabel(course: ParsedTranscriptCourse) {
  if (course.sourceType === "transfer") return "Transfer Credits";
  if (course.term && course.year) return `${course.term} ${course.year}`;
  return "Unsorted Courses";
}

function parseSubject(code: string) {
  const match = code.match(/^([A-Za-z]{2,6})[- ]?/);
  return match?.[1]?.toUpperCase() ?? null;
}

function normalizeCode(code: string) {
  return code.replace(/-/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

export default function TranscriptUpload({ onResult, onCancel }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setState({ phase: "error", message: "Please upload a PDF file." });
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      setState({ phase: "error", message: "Please upload a valid PDF file." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ phase: "error", message: "Transcript PDFs must be 10 MB or smaller." });
      return;
    }

    setState({ phase: "parsing" });

    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setState({ phase: "error", message: "Please sign in before uploading your transcript." });
        return;
      }

      const parsed = await parseTranscriptPDF(file, token);
      if (parsed.courses.length === 0) {
        setState({
          phase: "error",
          message: "No courses found in this transcript. Make sure it's an unofficial transcript PDF from your registrar.",
        });
        return;
      }

      const unmatchedRowIds = new Set<string>();
      const subjectCache = new Map<string, Set<string>>();

      await Promise.allSettled(
        parsed.courses.map(async (course) => {
          if (course.sourceType === "transfer") return;

          const subject = parseSubject(course.code);
          if (!subject) {
            unmatchedRowIds.add(course.rowId);
            return;
          }

          if (!subjectCache.has(subject)) {
            const subjectCourses = await fetchCoursesBySubject(subject);
            subjectCache.set(
              subject,
              new Set(subjectCourses.map((entry) => normalizeCode(entry.code)))
            );
          }

          if (!subjectCache.get(subject)?.has(normalizeCode(course.code))) {
            unmatchedRowIds.add(course.rowId);
          }
        })
      );

      setState({
        phase: "review",
        raw: { courses: parsed.courses, gpa: parsed.gpa, studentName: parsed.student_name },
        selected: new Set(parsed.courses.map((course) => course.rowId)),
        unmatchedRowIds,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Could not parse transcript.",
      });
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const toggleCourse = (rowId: string) => {
    if (state.phase !== "review") return;

    setState((prev) => {
      if (prev.phase !== "review") return prev;
      const next = new Set(prev.selected);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return { ...prev, selected: next };
    });
  };

  const toggleAll = (select: boolean) => {
    if (state.phase !== "review") return;

    setState((prev) => {
      if (prev.phase !== "review") return prev;
      return {
        ...prev,
        selected: select ? new Set(prev.raw.courses.map((course) => course.rowId)) : new Set(),
      };
    });
  };

  const confirm = async () => {
    if (state.phase !== "review") return;
    const selectedCourses = state.raw.courses.filter((course) => state.selected.has(course.rowId));
    setSubmitting(true);
    try {
      await Promise.resolve(
        onResult({ courses: selectedCourses, gpa: state.raw.gpa, studentName: state.raw.studentName })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const groupedCourses =
    state.phase === "review"
      ? state.raw.courses.reduce<Record<string, ParsedTranscriptCourse[]>>((acc, course) => {
          const key = termKey(course);
          if (!acc[key]) acc[key] = [];
          acc[key].push(course);
          return acc;
        }, {})
      : {};

  const termKeys = Object.keys(groupedCourses);

  if (state.phase === "idle" || state.phase === "error") {
    return (
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop your unofficial transcript PDF here</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse — <span className="font-medium text-foreground">unofficial only</span>, not the official sealed copy.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {state.phase === "error" && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              {state.message.includes("Extracted text preview") ? (
                <>
                  <p className="font-medium mb-1">{state.message.split("\n\n")[0]}</p>
                  <details className="text-[11px]">
                    <summary className="cursor-pointer text-destructive/70 hover:text-destructive">Show extracted text (for debugging)</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px] bg-destructive/5 rounded p-2 max-h-32 overflow-y-auto">
                      {state.message.split("\n\n").slice(1).join("\n\n")}
                    </pre>
                  </details>
                </>
              ) : (
                <p>{state.message}</p>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Use your <span className="font-medium text-foreground">unofficial transcript</span> from the Fisk registrar portal — not the official sealed PDF. Processed securely and never stored.
        </p>

        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
        >
          I&apos;ll add courses manually instead
        </button>
      </div>
    );
  }

  if (state.phase === "parsing") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Reading your transcript…</p>
          <p className="text-xs text-muted-foreground mt-1">Extracting courses, terms, and grades</p>
        </div>
      </div>
    );
  }

  const { raw, selected, unmatchedRowIds } = state;
  const allSelected = selected.size === raw.courses.length;
  const totalCredits = raw.courses
    .filter((course) => selected.has(course.rowId))
    .reduce((sum, course) => sum + (course.credits ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {submitting && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Adding courses to your plan</p>
            <p className="text-xs text-muted-foreground">Stay on this popup while the planner is being updated.</p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">{raw.courses.length} transcript rows found</p>
            <p className="text-xs text-muted-foreground">
              {selected.size} selected · {totalCredits} credits
              {raw.gpa !== null && <> · GPA <span className="font-semibold text-foreground">{Number(raw.gpa).toFixed(3)}</span></>}
            </p>
          </div>
        </div>
        <button
          onClick={() => toggleAll(!allSelected)}
          className="text-xs text-primary hover:underline font-medium flex-shrink-0"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {unmatchedRowIds.size > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {unmatchedRowIds.size} course{unmatchedRowIds.size !== 1 ? "s" : ""} need verification
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Only rows that could not be matched to an exact catalog code are flagged. In-progress rows are not flagged just because they have no grade.
          </p>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {termKeys.map((key) => {
          const firstCourse = groupedCourses[key][0];
          return (
            <div key={key}>
              <div className="px-4 py-2 bg-muted/40 sticky top-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {groupLabel(firstCourse)}
                </p>
              </div>
              {groupedCourses[key].map((course) => {
                const isSelected = selected.has(course.rowId);
                return (
                  <button
                    key={course.rowId}
                    onClick={() => toggleCourse(course.rowId)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
                      isSelected && "bg-green-50/60"
                    )}
                  >
                    {isSelected
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">{course.code}</span>
                        <span className="text-xs text-muted-foreground truncate">{course.title}</span>
                        {course.status === "planned" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            In progress
                          </span>
                        )}
                        {unmatchedRowIds.has(course.rowId) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Verify
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {course.sourceType === "transfer"
                          ? "Transfer credit"
                          : course.term && course.year
                          ? `${course.term} ${course.year}`
                          : "Unsorted course"}
                        {course.status === "planned" && " · no final grade yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        {course.credits != null ? `${course.credits}cr` : "TBD"}
                      </span>
                      <span className={cn("text-sm font-bold", course.grade ? (GRADE_COLOR[course.grade] ?? "text-foreground") : "text-blue-700")}>
                        {course.grade ?? (course.status === "planned" ? "IP" : "TR")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Review by row, not just by course code. Repeated transfer or elective rows stay separate.
      </p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setState({ phase: "idle" })}
        >
          <X className="w-3.5 h-3.5" /> Start over
        </Button>
        <Button
          onClick={confirm}
          disabled={selected.size === 0 || submitting}
          className="flex-1 gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {submitting ? "Adding courses…" : `Use ${selected.size} row${selected.size !== 1 ? "s" : ""}`}
          {!submitting && raw.gpa !== null && <> + GPA {Number(raw.gpa).toFixed(2)}</>}
        </Button>
      </div>
    </div>
  );
}
