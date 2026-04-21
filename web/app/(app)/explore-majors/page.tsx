"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Compass, Search, ChevronRight, CheckCircle2, BookOpen, Loader2, Sparkles } from "lucide-react";
import { cn, formatDisplayName } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import { fetchMajorCompatibility, fetchCourseLabels, type MajorCompatibility } from "@/lib/api";
import { toast } from "sonner";

const DEGREE_COLORS: Record<string, string> = {
  "B.S.":   "bg-primary/10 text-primary",
  "B.A.":   "bg-green-100 text-green-700",
  "B.F.A.": "bg-purple-100 text-purple-700",
  "B.M.":   "bg-amber-100 text-amber-700",
  "B.S.W.": "bg-cyan-100 text-cyan-700",
};

function CompatBar({ matched, total }: { matched: number; total: number }) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-primary" : "bg-muted-foreground/40")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function ExploreMajorsPage() {
  const router = useRouter();
  const { majors, planCatalog, semesters, profile, doUpdateProfile, loading: planLoading } = usePlan();

  const [search, setSearch] = useState("");
  const [compatibility, setCompatibility] = useState<MajorCompatibility[]>([]);
  const [compatLoading, setCompatLoading] = useState(false);
  const [declaring, setDeclaring] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewLabels, setPreviewLabels] = useState<Record<string, { label: string }>>({});
  const [previewLoading, setPreviewLoading] = useState(false);

  // All completed course codes from the plan
  const completedCodes = useMemo(() => {
    const codes: string[] = [];
    for (const sem of semesters) {
      for (const cid of sem.courseIds) {
        const c = planCatalog[cid];
        if (c?.status === "completed") codes.push(c.code);
      }
    }
    return codes;
  }, [semesters, planCatalog]);

  // Load compatibility scores
  useEffect(() => {
    if (completedCodes.length === 0) return;
    setCompatLoading(true);
    fetchMajorCompatibility(completedCodes)
      .then(setCompatibility)
      .catch(() => setCompatibility([]))
      .finally(() => setCompatLoading(false));
  }, [completedCodes.join(",")]);

  // Build a lookup: major code → compatibility data
  const compatMap = useMemo(() => {
    const m: Record<string, MajorCompatibility> = {};
    for (const c of compatibility) m[c.code] = c;
    return m;
  }, [compatibility]);

  // All non-UNDECLARED majors, filtered by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return majors
      .filter((m) => m.code !== "UNDECLARED")
      .filter((m) => !q || (formatDisplayName(m.name) ?? m.name).toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .sort((a, b) => {
        // Sort by compatibility desc, then alphabetically
        const ca = compatMap[a.code]?.matched ?? -1;
        const cb = compatMap[b.code]?.matched ?? -1;
        if (cb !== ca) return cb - ca;
        return (a.name ?? a.code).localeCompare(b.name ?? b.code);
      });
  }, [majors, search, compatMap]);

  const handlePreview = async (code: string) => {
    if (previewing === code) { setPreviewing(null); setPreviewLabels({}); return; }
    setPreviewing(code);
    setPreviewLoading(true);
    try {
      const { labels } = await fetchCourseLabels(code);
      setPreviewLabels(labels as Record<string, { label: string }>);
    } catch {
      setPreviewLabels({});
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeclare = async (code: string) => {
    if (!code) return;
    setDeclaring(code);
    try {
      await doUpdateProfile({ major_code: code });
      toast.success(`Major set to ${formatDisplayName(majors.find((m) => m.code === code)?.name ?? code)}`);
      router.push("/requirements");
    } catch {
      toast.error("Couldn't update your major — try again");
      setDeclaring(null);
    }
  };

  const isUndeclared = !profile?.major_code || profile.major_code === "UNDECLARED";

  // Preview: which of their completed courses count as required in this major
  const previewMatches = useMemo(() => {
    if (!previewing || !previewLabels) return { required: [], other: [] };
    const required: string[] = [];
    const other: string[] = [];
    for (const code of completedCodes) {
      const entry = previewLabels[code];
      if (entry?.label === "required") required.push(code);
      else if (entry) other.push(code);
    }
    return { required, other };
  }, [previewing, previewLabels, completedCodes]);

  return (
    <div className="px-4 md:px-8 py-6 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Compass className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Explore Majors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isUndeclared
              ? "Find your path — see how your completed courses match each major's requirements."
              : `You're currently declared in ${formatDisplayName(majors.find((m) => m.code === profile?.major_code)?.name ?? profile?.major_code ?? "")}. Explore other paths here.`}
          </p>
        </div>
      </div>

      {completedCodes.length > 0 && (
        <div className="flex items-center gap-2 mb-6 mt-4 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-foreground">
            Compatibility is based on <span className="font-semibold">{completedCodes.length} completed course{completedCodes.length !== 1 ? "s" : ""}</span> in your plan.
            The more you've completed, the more accurate the match.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search majors…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Grid */}
      {planLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((m) => {
            const compat = compatMap[m.code];
            const isCurrentMajor = m.code === profile?.major_code;
            const isPreviewing = previewing === m.code;

            return (
              <div
                key={m.code}
                className={cn(
                  "bg-card border rounded-xl overflow-hidden transition-all",
                  isPreviewing ? "border-primary/40 shadow-sm" : "border-border"
                )}
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-foreground text-sm">
                        {formatDisplayName(m.name ?? m.code)}
                      </p>
                      {m.degree_type && (
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", DEGREE_COLORS[m.degree_type] ?? "bg-muted text-muted-foreground")}>
                          {m.degree_type}
                        </span>
                      )}
                      {isCurrentMajor && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Current Major
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.total_credits_required} credits required</p>
                    {compat && completedCodes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {compat.matched} of {compat.total_required} required courses completed
                        </p>
                        <CompatBar matched={compat.matched} total={compat.total_required} />
                      </div>
                    )}
                    {!compat && compatLoading && completedCodes.length > 0 && (
                      <div className="mt-2 h-1.5 bg-muted rounded-full animate-pulse w-32" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePreview(m.code)}
                      className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                        isPreviewing
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      )}
                    >
                      <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                      {isPreviewing ? "Hide" : "Preview"}
                    </button>
                    {!isCurrentMajor && (
                      <button
                        onClick={() => handleDeclare(m.code)}
                        disabled={declaring === m.code}
                        className="flex items-center gap-1 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {declaring === m.code
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <ChevronRight className="w-3 h-3" />}
                        Declare
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview panel */}
                {isPreviewing && (
                  <div className="border-t border-border bg-muted/30 px-4 py-4">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading requirements…
                      </div>
                    ) : Object.keys(previewLabels).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No detailed requirements set up yet for this major. You can still declare it and use the planner freely.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {completedCodes.length > 0 && (
                          <div className="grid sm:grid-cols-2 gap-3">
                            {previewMatches.required.length > 0 && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-[11px] font-semibold text-green-800 mb-1.5">
                                  ✓ {previewMatches.required.length} required course{previewMatches.required.length !== 1 ? "s" : ""} already completed
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {previewMatches.required.map((c) => (
                                    <span key={c} className="text-[10px] font-mono bg-green-100 text-green-800 px-1.5 py-0.5 rounded">{c}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {previewMatches.other.length > 0 && (
                              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                <p className="text-[11px] font-semibold text-primary mb-1.5">
                                  {previewMatches.other.length} other course{previewMatches.other.length !== 1 ? "s" : ""} count as electives
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {previewMatches.other.map((c) => (
                                    <span key={c} className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{c}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          See full requirements on the{" "}
                          <button
                            onClick={() => router.push(`/requirements`)}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            Requirements page
                          </button>
                          {" "}using the What-if selector.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
