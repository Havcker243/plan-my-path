"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronRight, Info, ArrowRight,
} from "lucide-react";
import { cn, formatDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LABEL_META, type RequirementLabel } from "@/lib/data";
import { usePlan } from "@/contexts/plan-context";
import { buildRequirementsViewModel } from "@/lib/requirements";
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
    required: true,
    group: true,
    elective: false,
    general: false,
  });
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});

  const { groups, auditGroups, totalCreditsEarned } = useMemo(
    () => buildRequirementsViewModel(semesters, planCatalog, labels),
    [semesters, planCatalog, labels]
  );

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code
    ?? "your degree"
  );

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAudit = (key: string) => {
    setAuditExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="px-4 md:px-8 py-6 pb-20 md:pb-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Degree Requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your progress toward completing your {majorName} degree
          </p>
        </div>
        <Link href="/planner">
          <Button variant="outline" size="sm" className="gap-2">
            Open Planner <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Credits Earned", value: totalCreditsEarned, sub: `of ${DEGREE_CREDITS}` },
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
            {Math.round((totalCreditsEarned / DEGREE_CREDITS) * 100)}%
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(totalCreditsEarned / DEGREE_CREDITS) * 100}%` }}
          />
        </div>
      </div>

      {/* Degree Audit — grouped by requirement group */}
      {auditGroups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3">Degree Audit</h2>
          <div className="space-y-2">
            {auditGroups.map((group) => {
              const { groupName } = group;
              const meta = LABEL_META[group.label];
              const isOpen = auditExpanded[groupName] ?? false;
              const missingCount = group.courses.filter((c) => c.status === "missing").length;
              const completedCount = group.courses.filter((c) => c.status === "completed").length;
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
                      {missingCount > 0 && (
                        <span className="text-xs text-destructive font-medium">{missingCount} missing</span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {completedCount}/{group.courses.length}
                      </span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", pct >= 100 ? "bg-green-500" : "bg-primary")}
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
