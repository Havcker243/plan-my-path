"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Map,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import { useAuth } from "@/contexts/auth-context";
import {
  getCompletedCredits,
  getTotalCredits,
  LABEL_META,
  type Semester,
} from "@/lib/data";

const DEGREE_CREDITS = 120;

function CircleProgress({ pct, size = 80, stroke = 7, color = "stroke-primary" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={stroke}
        className={color}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, semesters, planCatalog, majors, loading } = usePlan();

  const firstName = (profile?.name ?? user?.email ?? "there").split(" ")[0];

  const completedCredits = getCompletedCredits(semesters, planCatalog);
  const plannedCredits = semesters
    .filter((s) => !s.isPast)
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => acc + (planCatalog[id]?.credits ?? 0), 0);
  const remainingCredits = Math.max(0, DEGREE_CREDITS - completedCredits - plannedCredits);
  const creditPct = Math.round((completedCredits / DEGREE_CREDITS) * 100);

  const semestersRemaining = semesters.filter((s) => !s.isPast).length;
  const avgCreditsNeeded = semestersRemaining > 0
    ? Math.ceil((DEGREE_CREDITS - completedCredits) / semestersRemaining)
    : 0;

  const requiredCourses = Object.values(planCatalog).filter((c) => c.label === "required");
  const completedRequired = requiredCourses.filter((c) => c.status === "completed").length;

  const gpa = profile?.gpa ?? null;

  const majorName = majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code ?? null;

  const gradText =
    profile?.graduation_term && profile?.graduation_year
      ? `${profile.graduation_term.charAt(0).toUpperCase() + profile.graduation_term.slice(1)} ${profile.graduation_year}`
      : null;

  const currentSem = semesters.find((s) => s.isCurrent);
  const nextSem = semesters.find((s) => !s.isPast && !s.isCurrent);

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto pb-20 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Good afternoon, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {gradText
              ? <>At your current pace, you&apos;ll graduate <span className="font-semibold text-foreground">{gradText}</span> — {semestersRemaining} semesters away.</>
              : "Complete your profile to see graduation info."
            }
          </p>
        </div>
        <Link href="/planner">
          <Button className="hidden md:flex gap-2">
            Open Planner <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Credits Breakdown */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <CircleProgress pct={creditPct} size={90} stroke={8} color="stroke-primary" />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                {creditPct}%
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 uppercase tracking-wide font-medium">Total Progress</p>
              <p className="text-2xl font-bold text-foreground">{completedCredits}</p>
              <p className="text-xs text-muted-foreground">of {DEGREE_CREDITS} credits</p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-4 md:gap-6">
            <div className="text-center md:text-left">
              <p className="text-2xl font-bold text-green-600">{completedCredits}</p>
              <p className="text-xs text-muted-foreground">Earned</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-2xl font-bold text-primary">{plannedCredits}</p>
              <p className="text-xs text-muted-foreground">Planned</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-2xl font-bold text-muted-foreground">{remainingCredits}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>

          <div className="md:w-48 flex-shrink-0">
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(completedCredits / DEGREE_CREDITS) * 100}%` }} />
              <div className="bg-primary h-full" style={{ width: `${(plannedCredits / DEGREE_CREDITS) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>Earned</span>
              <span>Planned</span>
              <span>Remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Semesters Left</p>
          <p className="text-2xl font-bold text-foreground">{semestersRemaining}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Avg Cr/Semester</p>
          <p className="text-2xl font-bold text-foreground">{avgCreditsNeeded}</p>
          <p className="text-[10px] text-muted-foreground">to graduate on time</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Required Courses</p>
          <p className="text-2xl font-bold text-foreground">
            {completedRequired}/{requiredCourses.length || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">completed</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">GPA</p>
          {gpa !== null ? (
            <>
              <p className="text-2xl font-bold text-green-600">{gpa.toFixed(2)}</p>
              <p className="text-[10px] text-green-600">{gpa >= 3.0 ? "Above 3.0" : "Below 3.0"}</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Current + Next semester */}
      {(currentSem || nextSem) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {currentSem && (
            <SemesterPreviewCard label="Current Semester" sem={currentSem} planCatalog={planCatalog} isCurrent />
          )}
          {nextSem && (
            <SemesterPreviewCard label="Next Semester" sem={nextSem} planCatalog={planCatalog} isCurrent={false} />
          )}
        </div>
      )}

      {semesters.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center mb-6">
          <Map className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No plan yet</p>
          <p className="text-xs text-muted-foreground mb-4">Go to the Planner to build your semester-by-semester schedule.</p>
          <Link href="/planner"><Button size="sm">Open Planner</Button></Link>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: "/planner", label: "Open Planner", desc: "Drag & arrange courses", icon: Map, primary: true },
          { href: "/courses", label: "Browse Courses", desc: "Find your next class", icon: BookOpen, primary: false },
          { href: "/calendar", label: "View Calendar", desc: "Check time conflicts", icon: Calendar, primary: false },
        ].map(({ href, label, desc, icon: Icon, primary }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-xl border p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors",
              primary ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            )}
          >
            <Icon className={cn("w-5 h-5", primary ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className={cn("text-sm font-semibold", primary ? "text-primary" : "text-foreground")}>{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SemesterPreviewCard({
  label,
  sem,
  planCatalog,
  isCurrent,
}: {
  label: string;
  sem: Semester;
  planCatalog: Record<string, import("@/lib/data").Course>;
  isCurrent: boolean;
}) {
  const semCredits = getTotalCredits(sem.courseIds, planCatalog);
  const isOverloaded = semCredits > 18;
  const isLight = semCredits < 12;

  return (
    <div className={cn("rounded-xl border bg-card p-4", isCurrent ? "border-primary/30" : "border-border")}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-foreground">{sem.term} {sem.year}</p>
        </div>
        <span className={cn(
          "text-[10px] font-semibold px-2 py-1 rounded-full",
          isOverloaded ? "bg-red-50 text-red-700" : isLight ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"
        )}>
          {semCredits} credits {isOverloaded ? "— Overloaded" : isLight ? "— Light" : "— OK"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sem.courseIds.slice(0, 4).map((code) => {
          const course = planCatalog[code];
          if (!course) return (
            <div key={code} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-foreground">{code}</span>
            </div>
          );
          return (
            <div key={code} className="flex items-center gap-2 text-xs">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", {
                "bg-red-500": course.label === "required",
                "bg-orange-500": course.label === "group",
                "bg-indigo-500": course.label === "elective",
                "bg-slate-400": course.label === "general",
              })} />
              <span className="font-medium text-foreground truncate">{course.code}</span>
              <span className="text-muted-foreground truncate">{course.title}</span>
              <span className="ml-auto flex-shrink-0 font-mono text-muted-foreground">{course.credits}cr</span>
            </div>
          );
        })}
        {sem.courseIds.length > 4 && (
          <p className="text-xs text-muted-foreground pl-3.5">+{sem.courseIds.length - 4} more</p>
        )}
      </div>
    </div>
  );
}
