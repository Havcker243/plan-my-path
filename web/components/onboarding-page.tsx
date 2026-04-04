"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ChevronRight, ChevronLeft, Check, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import { useAuth } from "@/contexts/auth-context";
import type { Course } from "@/lib/data";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR - 4 + index);
const TERMS = ["Fall", "Spring", "Summer", "Winter"] as const;
const STEPS = ["Major", "Timeline", "Courses", "Confirm"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { majors, searchCoursesCatalog, completeOnboarding, profile } = usePlan();
  const [step, setStep] = useState(0);

  // Step 0
  const [majorSearch, setMajorSearch] = useState("");
  const [selectedMajorCode, setSelectedMajorCode] = useState("");
  const [selectedMajorName, setSelectedMajorName] = useState("");

  // Step 1
  const [startYear, setStartYear] = useState(2022);
  const [startTerm, setStartTerm] = useState<string>("Fall");
  const [gradYear, setGradYear] = useState(2026);
  const [gradTerm, setGradTerm] = useState<string>("Spring");

  // Step 2
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);
  const [completedCodes, setCompletedCodes] = useState<string[]>([]);

  // Step 3
  const [submitting, setSubmitting] = useState(false);

  const { initialized } = usePlan();

  // Redirect if not logged in; redirect away if already onboarded
  useEffect(() => {
    if (authLoading || !initialized) return;
    if (!user) { router.push("/login"); return; }
    if (profile?.major_code?.trim()) { router.push("/dashboard"); }
  }, [authLoading, initialized, user, profile, router]);

  // Search courses when query changes
  useEffect(() => {
    if (courseSearch.length < 2) {
      setCourseResults([]);
      return;
    }
    setCourseSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCoursesCatalog(courseSearch);
        setCourseResults(results.slice(0, 15));
      } catch {
        setCourseResults([]);
      } finally {
        setCourseSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [courseSearch, searchCoursesCatalog]);

  const filteredMajors = majors.filter((m) =>
    m.name.toLowerCase().includes(majorSearch.toLowerCase())
  );

  const semestersAway = Math.max(
    0,
    (gradYear - startYear) * 2 +
      (gradTerm === "Spring" ? 1 : gradTerm === "Summer" ? 1 : 0) -
      (startTerm === "Spring" ? 1 : startTerm === "Summer" ? 1 : 0)
  );

  const toggleCourse = (code: string) => {
    setCompletedCodes((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await completeOnboarding({
        majorCode: selectedMajorCode,
        startYear,
        startTerm,
        gradYear,
        gradTerm,
        completedCourseCodes: completedCodes,
      });
      toast.success("Onboarding saved");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to complete onboarding");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-lg">
            <GraduationCap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">GradPath</span>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-xl mx-auto w-full">
        {/* Progress */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={cn("text-[10px] font-medium hidden sm:block", i === step ? "text-primary" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Step {step + 1} of {STEPS.length}</p>
        </div>

        {/* ── Step 0: Major ── */}
        {step === 0 && (
          <div className="w-full flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">What&apos;s your major?</h1>
              <p className="text-sm text-muted-foreground">We&apos;ll load your degree requirements automatically.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search majors…"
                value={majorSearch}
                onChange={(e) => setMajorSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filteredMajors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {majors.length === 0 ? "Loading majors…" : "No majors found"}
                </p>
              )}
              {filteredMajors.map((m) => (
                <button
                  key={m.code}
                  onClick={() => { setSelectedMajorCode(m.code); setSelectedMajorName(m.name); }}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-sm text-left transition-colors hover:bg-muted/60",
                    selectedMajorCode === m.code && "bg-primary/5 text-primary font-medium"
                  )}
                >
                  {m.name}
                  {selectedMajorCode === m.code && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
            <Button onClick={next} disabled={!selectedMajorCode} className="w-full gap-2">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── Step 1: Timeline ── */}
        {step === 1 && (
          <div className="w-full flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">When did you start?</h1>
              <p className="text-sm text-muted-foreground">We&apos;ll calculate how many semesters you have left.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Started</label>
                <select
                  value={startTerm}
                  onChange={(e) => setStartTerm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Graduating</label>
                <select
                  value={gradTerm}
                  onChange={(e) => setGradTerm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select
                  value={gradYear}
                  onChange={(e) => setGradYear(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {Array.from({ length: 10 }, (_, index) => CURRENT_YEAR + index).map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4 text-center">
              <p className="text-sm text-muted-foreground">Your graduation target</p>
              <p className="text-xl font-bold text-foreground mt-1">{gradTerm} {gradYear}</p>
              <p className="text-sm text-primary font-medium mt-1">{semestersAway} semesters away</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
              <Button onClick={next} className="flex-1 gap-2">Continue <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Completed Courses ── */}
        {step === 2 && (
          <div className="w-full flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Courses you&apos;ve passed</h1>
              <p className="text-sm text-muted-foreground">Search and mark courses you&apos;ve already completed.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {courseSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
              <input
                type="text"
                placeholder="Search by course code or title…"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {courseResults.length > 0 && (
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {courseResults.map((c) => {
                  const checked = completedCodes.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      onClick={() => toggleCourse(c.code)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-muted/60 transition-colors",
                        checked && "bg-green-50"
                      )}
                    >
                      <div>
                        <p className="font-medium text-foreground">{c.code}</p>
                        <p className="text-xs text-muted-foreground">{c.title} · {c.credits}cr</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center border transition-all",
                        checked ? "bg-green-600 border-green-600" : "border-border"
                      )}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {courseSearch.length < 2 && (
              <p className="text-xs text-muted-foreground text-center">Type at least 2 characters to search courses</p>
            )}
            {completedCodes.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5">
                <span>{completedCodes.length} courses selected</span>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
              <Button onClick={next} className="flex-1 gap-2">Continue <ChevronRight className="w-4 h-4" /></Button>
            </div>
            <button onClick={next} className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
              I&apos;ll add them later
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <div className="w-full flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Looks good?</h1>
              <p className="text-sm text-muted-foreground">Review your plan before we set up your planner.</p>
            </div>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              <SummaryRow label="Major" value={selectedMajorName} onEdit={() => setStep(0)} />
              <SummaryRow label="Started" value={`${startTerm} ${startYear}`} onEdit={() => setStep(1)} />
              <SummaryRow label="Graduating" value={`${gradTerm} ${gradYear} · ${semestersAway} semesters away`} onEdit={() => setStep(1)} />
              <SummaryRow
                label="Completed courses"
                value={`${completedCodes.length} courses marked`}
                onEdit={() => setStep(2)}
              />
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">At your current pace</p>
              <p className="text-sm font-semibold text-foreground">
                You&apos;ll graduate {gradTerm} {gradYear} — {semestersAway} semesters from now.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
              <Button onClick={handleComplete} disabled={submitting} className="flex-1 gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</> : <>Build my plan <ChevronRight className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
      <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
    </div>
  );
}
