"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronRight, Info, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LABEL_META, type RequirementLabel } from "@/lib/data";
import { usePlan } from "@/contexts/plan-context";

const DEGREE_CREDITS = 120;

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
  const { semesters, planCatalog, labels, profile, majors, loading } = usePlan();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    required: true,
    group: true,
    elective: false,
    general: false,
  });

  const completedIds = new Set(
    semesters.filter((s) => s.isPast).flatMap((s) => s.courseIds)
  );
  const plannedIds = new Set(
    semesters.filter((s) => !s.isPast).flatMap((s) => s.courseIds)
  );

  // Build groups from planCatalog
  const groups: Record<RequirementLabel, {
    courses: Array<{ code: string; title: string; credits: number; status: "completed" | "planned" | "missing" }>;
    completed: number;
    total: number;
  }> = {
    required: { courses: [], completed: 0, total: 0 },
    group: { courses: [], completed: 0, total: 0 },
    elective: { courses: [], completed: 0, total: 0 },
    general: { courses: [], completed: 0, total: 0 },
  };

  Object.values(planCatalog).forEach((course) => {
    const status = completedIds.has(course.code)
      ? "completed"
      : plannedIds.has(course.code)
      ? "planned"
      : "missing";
    groups[course.label].courses.push({
      code: course.code,
      title: course.title,
      credits: course.credits,
      status,
    });
    groups[course.label].total++;
    if (status === "completed") groups[course.label].completed++;
  });

  const mapLabel = (label: string): RequirementLabel => {
    if (label === "Required") return "required";
    if (label === "Group Choice") return "group";
    if (label === "Major Elective") return "elective";
    return "general";
  };

  // Also include labeled courses that are not yet in planCatalog
  Object.entries(labels).forEach(([code, entry]) => {
    if (planCatalog[code]) return; // already counted
    const groupLabel = mapLabel(entry.label);
    groups[groupLabel].courses.push({
      code,
      title: entry.detail || code,
      credits: entry.credits ?? 0,
      status: "missing",
    });
    groups[groupLabel].total++;
  });

  (Object.keys(groups) as RequirementLabel[]).forEach((label) => {
    groups[label].courses.sort((a, b) => a.code.localeCompare(b.code));
  });

  const totalCreditsEarned = semesters
    .filter((s) => s.isPast)
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => acc + (planCatalog[id]?.credits ?? 0), 0);

  const majorName = majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code
    ?? "your degree";

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
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
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Credits Earned</p>
          <p className="text-2xl font-bold text-foreground">{totalCreditsEarned}</p>
          <p className="text-xs text-muted-foreground">of {DEGREE_CREDITS}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Core Courses</p>
          <p className="text-2xl font-bold text-foreground">{groups.required.completed}</p>
          <p className="text-xs text-muted-foreground">of {groups.required.total} done</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Group Choice</p>
          <p className="text-2xl font-bold text-foreground">{groups.group.completed}</p>
          <p className="text-xs text-muted-foreground">of {groups.group.total} done</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Electives</p>
          <p className="text-2xl font-bold text-foreground">{groups.elective.completed + groups.general.completed}</p>
          <p className="text-xs text-muted-foreground">of {groups.elective.total + groups.general.total} done</p>
        </div>
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

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {group.courses.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No courses in this category yet.</p>
                  ) : (
                    group.courses.map(({ code, title, credits, status }) => (
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
                    ))
                  )}
                </div>
              )}
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
