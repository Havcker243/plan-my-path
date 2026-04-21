"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronRight, Info, ArrowRight, Sparkles, X, Compass,
} from "lucide-react";
import { cn, formatDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LABEL_META, type RequirementLabel } from "@/lib/data";
import { usePlan } from "@/contexts/plan-context";
import { buildRequirementsViewModel } from "@/lib/requirements";
import { fetchCourseLabels } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_ICON = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  planned: <Circle className="w-4 h-4 text-primary" />,
  missing: <AlertCircle className="w-4 h-4 text-destructive" />,
};

const STATUS_LABEL = {
  completed: "Completed",
  planned: "Planned",
  missing: "Not in plan",
};

export default function RequirementsPage() {
  const { semesters, planCatalog, labels, profile, majors, degreeCreditTotal, loading } = usePlan();
  const DEGREE_CREDITS = degreeCreditTotal;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    required: true, group: true, elective: false, general: false,
  });
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});

  // What-if state
  const [whatIfCode, setWhatIfCode] = useState("");
  const [whatIfLabels, setWhatIfLabels] = useState<typeof labels | null>(null);
  const [whatIfCredits, setWhatIfCredits] = useState(120);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState(false);

  const activeLabels = whatIfLabels ?? labels;
  const activeDegreeCredits = whatIfLabels ? whatIfCredits : DEGREE_CREDITS;

  const { groups, auditGroups, totalCreditsEarned } = useMemo(
    () => buildRequirementsViewModel(semesters, planCatalog, activeLabels),
    [semesters, planCatalog, activeLabels]
  );

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name ?? profile?.major_code ?? "your degree"
  );

  const whatIfName = whatIfCode
    ? formatDisplayName(majors.find((m) => m.code === whatIfCode)?.name ?? whatIfCode)
    : "";

  const loadWhatIf = async (code: string) => {
    if (!code || code === profile?.major_code) { setWhatIfCode(""); setWhatIfLabels(null); return; }
    setWhatIfCode(code);
    setWhatIfLoading(true);
    setWhatIfError(false);
    try {
      const { labels: l, total_credits } = await fetchCourseLabels(code);
      setWhatIfLabels(l);
      setWhatIfCredits(total_credits);
    } catch {
      setWhatIfError(true);
      setWhatIfLabels(null);
    } finally { setWhatIfLoading(false); }
  };

  const clearWhatIf = () => { setWhatIfCode(""); setWhatIfLabels(null); setWhatIfError(false); };

  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleAudit = (key: string) => setAuditExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="px-4 md:px-8 py-6 pb-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Degree Requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {whatIfLabels
              ? <>Previewing <span className="font-semibold text-primary">{whatIfName}</span> requirements with your current courses</>
              : <>Track your progress toward completing your {majorName} degree</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {whatIfLabels && (
            <button onClick={clearWhatIf}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              <X className="w-3.5 h-3.5" /> Clear What-if
            </button>
          )}
          <Link href="/planner">
            <Button variant="outline" size="sm" className="gap-2">
              Open Planner <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* What-if selector */}
      <div className="flex items-center gap-3 mb-6 p-3 bg-muted/40 rounded-xl border border-border">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs font-medium text-foreground shrink-0">What if I switched to</p>
        <select
          value={whatIfCode}
          onChange={(e) => loadWhatIf(e.target.value)}
          disabled={whatIfLoading}
          className="flex-1 text-sm rounded-lg border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
        >
          <option value="">— pick a major —</option>
          {majors.filter((m) => m.code !== "UNDECLARED" && m.code !== profile?.major_code).map((m) => (
            <option key={m.code} value={m.code}>{formatDisplayName(m.name ?? m.code)}</option>
          ))}
        </select>
        {whatIfLoading && <span className="text-xs text-muted-foreground shrink-0">Loading…</span>}
        {whatIfError && <span className="text-xs text-destructive shrink-0">No requirements found</span>}
      </div>

      {/* UNDECLARED call-to-action */}
      {(!profile?.major_code || profile.major_code === "UNDECLARED") && !whatIfLabels && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-2xl mb-8 text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Compass className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">You haven&apos;t declared a major yet</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
            Explore all available majors and see how your completed courses already match each program&apos;s requirements.
          </p>
          <Link href="/explore-majors">
            <Button className="gap-2">
              <Compass className="w-4 h-4" /> Explore Majors
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">
            Or use the <span className="font-medium">What-if selector above</span> to preview any major&apos;s requirements right here.
          </p>
        </div>
      )}

      {/* Summary cards */}
      {(profile?.major_code && profile.major_code !== "UNDECLARED" || whatIfLabels) && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Credits Earned", value: totalCreditsEarned, sub: `of ${activeDegreeCredits}` },
          { label: "Core Courses", value: groups.required.completed, sub: `of ${groups.required.total} done` },
          { label: "Group Choice", value: groups.group.completed, sub: `of ${groups.group.total} done` },
          { label: "Electives", value: groups.elective.completed + groups.general.completed, sub: `of ${groups.elective.total + groups.general.total} done` },
        ].map((card, index) => (
          <motion.div
            key={card.label}
            className="bg-card border border-border rounded-xl p-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.1 }}
          >
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Overall Progress</span>
          <span className="text-sm text-muted-foreground">
            {Math.round((totalCreditsEarned / activeDegreeCredits) * 100)}%
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(totalCreditsEarned / activeDegreeCredits) * 100}%` }}
          />
        </div>
      </div>
      )}

      {/* Degree Audit — grouped by requirement group */}
      {auditGroups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3">Degree Audit</h2>
          <div className="space-y-2">
            {auditGroups.map((group) => {
              const { groupName } = group;
              const meta = LABEL_META[group.label];
              const isOpen = auditExpanded[groupName] ?? false;
              const missingCount = group.isSatisfied ? 0 : group.courses.filter((c) => c.status === "missing").length;
              const pct = group.totalCredits > 0
                ? (group.completedCredits / group.totalCredits) * 100
                : 0;
              return (
                <div key={groupName} className="border border-border rounded-xl overflow-hidden bg-card">
                  <button
                    onClick={() => toggleAudit(groupName)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      }
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", meta.bg, meta.color)}>
                        {meta.label}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{groupName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {missingCount > 0 && !group.isCreditBased && (
                        <span className="text-xs text-destructive font-medium">{missingCount} missing</span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {group.progressLabel}
                      </span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", group.isSatisfied ? "bg-green-500" : "bg-primary")}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="border-t border-border divide-y divide-border">
                          {group.courses.map(({ code, title, credits, status }) => (
                            <div
                              key={code}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors",
                                status === "completed" && "bg-green-50/50"
                              )}
                            >
                              {STATUS_ICON[status]}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium text-foreground">{code}</span>
                                  {title !== code && (
                                    <span className="text-sm text-muted-foreground truncate">{title}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">{credits} cr</span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                status === "completed" && "bg-green-100 text-green-700",
                                status === "planned" && "bg-primary/10 text-primary",
                                status === "missing" && "bg-destructive/10 text-destructive"
                              )}>
                                {STATUS_LABEL[status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Requirement sections */}
      <div className="space-y-4">
        {(["required", "group", "elective", "general"] as RequirementLabel[]).map((label) => {
          const group = groups[label];
          const meta = LABEL_META[label];
          const isExpanded = expanded[label];
          const missingCount = group.courses.filter((c) => c.status === "missing").length;

          return (
            <div key={label} className="border border-border rounded-xl overflow-hidden bg-card">
              <button
                onClick={() => toggleSection(label)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  }
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.bg, meta.color)}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {group.completed} of {group.total} completed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {missingCount > 0 && (
                    <span className="text-xs text-destructive font-medium">{missingCount} missing</span>
                  )}
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all", group.completed === group.total ? "bg-green-500" : "bg-primary")}
                      style={{ width: `${group.total > 0 ? (group.completed / group.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="border-t border-border divide-y divide-border">
                      {group.courses.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">No courses in this category yet.</p>
                      ) : (
                        group.courses.map(({ code, title, credits, status }) => {
                          const prereqs = planCatalog[code]?.prereqs ?? [];
                          return (
                            <div
                              key={code}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
                                status === "completed" && "bg-green-50/50"
                              )}
                            >
                              {STATUS_ICON[status]}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium text-foreground">{code}</span>
                                  <span className="text-sm text-muted-foreground truncate">{title !== code ? title : ""}</span>
                                </div>
                                {prereqs.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Prereq: {prereqs.join(" → ")}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">{credits} cr</span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                status === "completed" && "bg-green-100 text-green-700",
                                status === "planned" && "bg-primary/10 text-primary",
                                status === "missing" && "bg-destructive/10 text-destructive"
                              )}>
                                {STATUS_LABEL[status]}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground mb-1">About Degree Requirements</p>
          <p>
            Courses marked &quot;Not in plan&quot; haven&apos;t been added to any semester yet. Visit the{" "}
            <Link href="/planner" className="text-primary hover:underline">Planner</Link> to schedule them.
          </p>
        </div>
      </div>
    </div>
  );
}
