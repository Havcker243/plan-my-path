"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Route,
  Upload,
  X,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  BookMarked,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatDisplayName } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import { useAuth } from "@/contexts/auth-context";
import {
  getCompletedCredits,
  getTotalCredits,
  getPrereqWarnings,
  getOfferedTermWarnings,
  type Semester,
} from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";
import TranscriptUpload, { type TranscriptResult } from "@/components/transcript-upload";
import { toast } from "sonner";
import type { OnboardingCourse } from "@/lib/transcript";


function CircleProgress({ pct, size = 80, stroke = 7, color = "stroke-primary" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const safePct = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  const offset = circ - (safePct / 100) * circ;
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

function yearStanding(credits: number): string {
  if (credits < 30) return "Freshman";
  if (credits < 60) return "Sophomore";
  if (credits < 90) return "Junior";
  return "Senior";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, semesters, planCatalog, labels, majors, degreeCreditTotal, loading, importTranscript } = usePlan();
  const DEGREE_CREDITS = degreeCreditTotal;
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  const handleTranscriptImport = async (result: TranscriptResult) => {
    const courses: OnboardingCourse[] = result.courses.map((c) => ({
      code: c.code,
      status: c.status,
      grade: c.grade,
      term: c.term,
      year: c.year,
      title: c.title,
      credits: c.credits ?? undefined,
    }));
    try {
      const { added, skipped } = await importTranscript(courses, result.gpa);
      setShowTranscriptModal(false);
      toast.success(
        `Transcript imported — ${added} course${added !== 1 ? "s" : ""} added${skipped > 0 ? `, ${skipped} already in plan` : ""}${result.gpa !== null ? `, GPA updated to ${Number(result.gpa).toFixed(2)}` : ""}`
      );
    } catch {
      toast.error("Failed to import transcript");
    }
  };

  const displayNameSource =
    profile?.name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    "";
  const firstName = displayNameSource ? displayNameSource.split(/\s+/)[0] : "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const completedCredits = getCompletedCredits(semesters, planCatalog);
  const plannedCredits = semesters
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => {
      const course = planCatalog[id];
      const credits =
        typeof course?.credits === "number" && Number.isFinite(course.credits) ? course.credits : 0;
      return course?.status === "planned" ? acc + credits : acc;
    }, 0);
  const remainingCredits = Math.max(0, DEGREE_CREDITS - completedCredits - plannedCredits);
  const creditPct = Math.round((completedCredits / DEGREE_CREDITS) * 100);
  const standing = yearStanding(completedCredits);

  const planCodes = new Set(semesters.flatMap((s) => s.courseIds));
  const requiredCourses = [...planCodes]
    .map((id) => planCatalog[id])
    .filter((c): c is NonNullable<typeof c> => !!c && c.label === "required");
  const completedRequired = requiredCourses.filter((c) => c.status === "completed").length;

  const rawGpa = profile?.gpa;
  const parsedGpa =
    rawGpa == null
      ? null
      : typeof rawGpa === "number"
      ? rawGpa
      : Number(rawGpa);
  const gpa = parsedGpa != null && Number.isFinite(parsedGpa) ? parsedGpa : null;

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code
    ?? null
  );
  const minorName = profile?.minor_code
    ? formatDisplayName(majors.find((m) => m.code === profile.minor_code)?.name ?? profile.minor_code)
    : null;

  const gradText =
    profile?.graduation_term && profile?.graduation_year
      ? `${profile.graduation_term.charAt(0).toUpperCase() + profile.graduation_term.slice(1)} ${profile.graduation_year}`
      : null;

  const currentSem = semesters.find((s) => s.isCurrent);
  const nextSem = semesters.find((s) => !s.isPast && !s.isCurrent);

  // Only count Spring + Fall when computing graduation distance.
  // Summer/Winter semesters inflate the index gap (4 per year instead of 2).
  // isCurrent may be set on a Summer/Winter semester, so find position by first non-past instead.
  const academicSems = semesters.filter((s) => s.term === "Spring" || s.term === "Fall");
  const gradSemIdx = profile?.graduation_term && profile?.graduation_year
    ? academicSems.findIndex(
        (s) =>
          s.term.toLowerCase() === profile.graduation_term!.toLowerCase() &&
          s.year === profile.graduation_year
      )
    : -1;
  const currentSemIdx = academicSems.findIndex((s) => !s.isPast);
  const semestersToGrad =
    gradSemIdx !== -1 && currentSemIdx !== -1 ? gradSemIdx - currentSemIdx : null;

  const semestersRemaining =
    semestersToGrad !== null && semestersToGrad >= 0
      ? semestersToGrad + 1
      : academicSems.filter((s) => !s.isPast).length;

  const avgCreditsNeeded = semestersRemaining > 0
    ? Math.ceil((DEGREE_CREDITS - completedCredits) / semestersRemaining)
    : 0;

  // ── Action items (things the student needs to address) ─────────────────────
  const prereqWarnings = getPrereqWarnings(semesters, planCatalog);
  const offeredTermWarnings = getOfferedTermWarnings(semesters, planCatalog);
  const overloadedSemesters = semesters.filter(
    (s) => !s.isPast && getTotalCredits(s.courseIds, planCatalog) > 18
  );
  const missingRequired = Object.entries(labels)
    .filter(([code, entry]) => entry.label === "Required" && !planCodes.has(code))
    .map(([code]) => code);

  const totalActions = prereqWarnings.length + offeredTermWarnings.length + overloadedSemesters.length + missingRequired.length;

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
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto pb-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{greeting}, {firstName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {standing}
            </span>
            {majorName && (
              <span className="text-xs text-muted-foreground font-medium">{majorName}</span>
            )}
            {minorName && (
              <span className="text-xs text-muted-foreground">· Minor: {minorName}</span>
            )}
            {gradText && (
              <span className="text-xs text-muted-foreground">· Graduating {gradText}</span>
            )}
          </div>
        </div>
        <Link href="/planner">
          <Button className="hidden md:flex gap-2 flex-shrink-0">
            Open Degree Plan <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* ── Degree progress ── */}
      <motion.div
        className="rounded-xl border border-border bg-card p-5 mb-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Degree Progress</p>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <CircleProgress pct={creditPct} size={90} stroke={8} color="stroke-primary" />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                {creditPct}%
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total credits</p>
              <p className="text-2xl font-bold text-foreground">{completedCredits}</p>
              <p className="text-xs text-muted-foreground">of {DEGREE_CREDITS} required</p>
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
      </motion.div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Semesters Left",
            value: semestersToGrad !== null && semestersToGrad >= 0 ? semestersToGrad : "N/A",
            sub: semestersToGrad === 0 ? "Graduating this semester" : gradText ? `Until ${gradText}` : null,
          },
          {
            label: "Avg Cr/Semester",
            value: avgCreditsNeeded,
            sub: "needed to graduate on time",
          },
          {
            label: "Required Courses",
            value: `${completedRequired}/${requiredCourses.length || 0}`,
            sub: "completed",
          },
          {
            label: "Cumulative GPA",
            value: gpa !== null ? gpa.toFixed(2) : "N/A",
            sub: gpa !== null ? (gpa >= 3.0 ? "Above 3.0" : "Below 3.0") : "Import transcript to track",
            valueColor: gpa !== null ? "text-green-600" : "text-muted-foreground",
            subColor: gpa !== null && gpa >= 3.0 ? "text-green-600" : undefined,
          },
        ].map((card, index) => (
          <motion.div
            key={card.label}
            className="rounded-xl border border-border bg-card p-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
          >
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={cn("text-2xl font-bold", (card as { valueColor?: string }).valueColor ?? "text-foreground")}>
              {card.value}
            </p>
            {card.sub && (
              <p className={cn("text-[10px]", (card as { subColor?: string }).subColor ?? "text-muted-foreground")}>
                {card.sub}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Current + Next semester (side by side, original layout) ── */}
      {(currentSem || nextSem) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {currentSem && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0 }}
            >
              <SemesterPreviewCard label="Current Semester" sem={currentSem} planCatalog={planCatalog} isCurrent />
            </motion.div>
          )}
          {nextSem && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            >
              <SemesterPreviewCard label="Next Semester" sem={nextSem} planCatalog={planCatalog} isCurrent={false} />
            </motion.div>
          )}
        </div>
      )}

      {/* ── Action items ── */}
      {totalActions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6"
        >
          <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-3">
            {totalActions} thing{totalActions !== 1 ? "s" : ""} to address
          </p>
          <div className="space-y-2">
            {missingRequired.slice(0, 3).map((code) => (
              <div key={code} className="flex items-start gap-2.5">
                <BookMarked className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">{code}</span> is required for your major but not in your plan
                </p>
              </div>
            ))}
            {missingRequired.length > 3 && (
              <p className="text-xs text-amber-700 pl-6">+{missingRequired.length - 3} more missing required courses</p>
            )}
            {prereqWarnings.slice(0, 2).map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">{w.prereqId}</span> must be taken before{" "}
                  <span className="font-semibold">{w.courseId}</span>
                </p>
              </div>
            ))}
            {offeredTermWarnings.slice(0, 2).map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">{w.courseId}</span> may not be offered in {w.semesterTerm} — verify with catalog
                </p>
              </div>
            ))}
            {overloadedSemesters.slice(0, 2).map((s) => (
              <div key={s.id} className="flex items-start gap-2.5">
                <Zap className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">{s.term} {s.year}</span> has {getTotalCredits(s.courseIds, planCatalog)} credits — aim for 12–18
                </p>
              </div>
            ))}
          </div>
          <Link href="/planner" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900">
            Fix in Degree Plan <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {semesters.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center mb-6">
          <Route className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No degree plan yet</p>
          <p className="text-xs text-muted-foreground mb-4">Build your semester-by-semester schedule to start tracking your path to graduation.</p>
          <Link href="/planner"><Button size="sm">Start Degree Plan</Button></Link>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/planner",       label: "Degree Plan",       desc: "Drag & arrange semesters",     icon: Route,          primary: true },
          { href: "/requirements",  label: "Requirements",       desc: "Check what you still need",    icon: CheckCircle2,   primary: false },
          { href: "/courses",       label: "Browse Courses",     desc: "Find your next class",         icon: BookOpen,       primary: false },
          { href: "/balance-sheet", label: "Degree Audit",       desc: "Advisor-ready summary",        icon: FileSpreadsheet, primary: false },
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

      <button
        onClick={() => setShowTranscriptModal(true)}
        className="mt-3 w-full rounded-xl border border-dashed border-border bg-card p-3 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
      >
        <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Import Transcript</p>
          <p className="text-xs text-muted-foreground">Auto-fill your completed courses and GPA from a PDF</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />
      </button>

      {/* ── Transcript import modal ── */}
      <AnimatePresence>
        {showTranscriptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowTranscriptModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-foreground">Import Transcript</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload your PDF. Courses will be added to their exact semesters with grades.
                  </p>
                </div>
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <TranscriptUpload
                onResult={handleTranscriptImport}
                onCancel={() => setShowTranscriptModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const isLight = semCredits < 12 && sem.courseIds.length > 0;

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
          {semCredits} credits · {isOverloaded ? "Overloaded" : isLight ? "Light" : "OK"}
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
              <span className="ml-auto flex-shrink-0 font-mono text-muted-foreground">
                {typeof course.credits === "number" && Number.isFinite(course.credits) ? course.credits : 0}cr
              </span>
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
