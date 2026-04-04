"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus, X, Check, AlertTriangle, Info, GripVertical,
  CheckCircle, Clock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTotalCredits,
  getPrereqWarnings,
  getSemesterCreditLoad,
  LABEL_META,
  type Course,
  type Semester,
  type RequirementLabel,
} from "@/lib/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan } from "@/contexts/plan-context";
import { fetchSections, type BackendSection } from "@/lib/api";
import { toast } from "sonner";

const LABEL_DOT: Record<RequirementLabel, string> = {
  required: "bg-red-500",
  group: "bg-orange-500",
  elective: "bg-indigo-500",
  general: "bg-slate-400",
};

const LABEL_BADGE: Record<RequirementLabel, string> = {
  required: "bg-red-50 text-red-700 border-red-100",
  group: "bg-orange-50 text-orange-700 border-orange-100",
  elective: "bg-indigo-50 text-indigo-700 border-indigo-100",
  general: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_COLORS = {
  completed: "bg-green-50 border-green-200",
  planned: "bg-card border-border",
  failed: "bg-red-50 border-red-200",
};

const TERM_ABBR = (term: string) => term.substring(0, 2);

type DragState = { courseId: string; fromSemId: string } | null;
type ConfirmAction = { type: "delete-semester" | "delete-course"; semId: string; courseId?: string } | null;

export default function PlannerPage() {
  const {
    semesters,
    setSemesters,
    planCatalog,
    addCoursesToCatalog,
    savePlan,
    searchCoursesCatalog,
    profile,
    loading,
    updateCourse,
  } = usePlan();

  const [drag, setDrag] = useState<DragState>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedCourseSections, setSelectedCourseSections] = useState<BackendSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [pendingSemesterId, setPendingSemesterId] = useState<string | null>(null);
  const [pendingSections, setPendingSections] = useState<BackendSection[]>([]);
  const [pendingSectionId, setPendingSectionId] = useState<string>("__none__");
  const [pendingSectionsLoading, setPendingSectionsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always hold the latest savePlan reference so the debounced timer
  // never closes over a stale version of it.
  const savePlanRef = useRef(savePlan);
  useEffect(() => { savePlanRef.current = savePlan; }, [savePlan]);

  const allUsed = new Set(semesters.flatMap((s) => s.courseIds));

  // Search for courses to add
  useEffect(() => {
    if (!addingTo || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCoursesCatalog(searchTerm);
        // Re-compute allUsed inside the async callback to get the latest semesters
        const used = new Set(semesters.flatMap((s) => s.courseIds));
        setSearchResults(results.filter((c) => !used.has(c.code)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, addingTo, searchCoursesCatalog, semesters]);

  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        // Use the ref so we always call the latest savePlan, which holds
        // the latest semesters/planCatalog state at call time.
        await savePlanRef.current();
        setLastSaved(new Date());
      } catch {
        toast.error("Your plan couldn't be saved. Check your connection and try again.");
      } finally {
        setSaving(false);
      }
    }, 1200);
  }, []); // no deps — the ref handles currency

  const warnings = getPrereqWarnings(semesters, planCatalog);
  const warnSet = new Set(warnings.map((w) => w.courseId));
  const selectedCourseSemester = selectedCourse
    ? semesters.find((sem) => sem.courseIds.includes(selectedCourse.code))
    : null;

  useEffect(() => {
    if (!selectedCourse) {
      setSelectedCourseSections([]);
      return;
    }

    setSectionsLoading(true);
    const termFilter = selectedCourseSemester
      ? `${selectedCourseSemester.term.toLowerCase()} ${selectedCourseSemester.year}`
      : undefined;

    fetchSections([selectedCourse.code], termFilter)
      .then((data) => {
        setSelectedCourseSections(data[selectedCourse.code] ?? []);
      })
      .catch(() => setSelectedCourseSections([]))
      .finally(() => setSectionsLoading(false));
  }, [selectedCourse, selectedCourseSemester]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (courseId: string, semId: string) => {
    setDrag({ courseId, fromSemId: semId });
  };

  const handleDrop = (toSemId: string) => {
    if (!drag || drag.fromSemId === toSemId) {
      setDrag(null); setDragOver(null);
      return;
    }
    setSemesters((prev) =>
      prev.map((sem) => {
        if (sem.id === drag.fromSemId)
          return { ...sem, courseIds: sem.courseIds.filter((id) => id !== drag.courseId) };
        if (sem.id === toSemId)
          return { ...sem, courseIds: [...sem.courseIds, drag.courseId] };
        return sem;
      })
    );
    setDrag(null); setDragOver(null);
    triggerSave();
  };

  // ── Add/remove courses ─────────────────────────────────────────────────────
  const addCourse = (semId: string, course: Course) => {
    const semester = semesters.find((sem) => sem.id === semId);
    if (!semester) return;

    setPendingCourse(course);
    setPendingSemesterId(semId);
    setPendingSections([]);
    setPendingSectionId("__none__");
    setPendingSectionsLoading(true);

    const termFilter = `${semester.term.toLowerCase()} ${semester.year}`;
    fetchSections([course.code], termFilter)
      .then((data) => {
        const sections = data[course.code] ?? [];
        setPendingSections(sections);
        if (sections.length === 0) {
          addCoursesToCatalog([course]);
          setSemesters((prev) =>
            prev.map((sem) =>
              sem.id === semId && !sem.courseIds.includes(course.code)
                ? { ...sem, courseIds: [...sem.courseIds, course.code] }
                : sem
            )
          );
          setAddingTo(null);
          setSearchTerm("");
          setSearchResults([]);
          setPendingCourse(null);
          setPendingSemesterId(null);
          triggerSave();
          toast.success(`${course.code} added to ${semester.term} ${semester.year}`);
        }
      })
      .catch(() => {
        addCoursesToCatalog([course]);
        setSemesters((prev) =>
          prev.map((sem) =>
            sem.id === semId && !sem.courseIds.includes(course.code)
              ? { ...sem, courseIds: [...sem.courseIds, course.code] }
              : sem
          )
        );
        setAddingTo(null);
        setSearchTerm("");
        setSearchResults([]);
        setPendingCourse(null);
        setPendingSemesterId(null);
        triggerSave();
        toast.success(`${course.code} added to planner`);
      })
      .finally(() => setPendingSectionsLoading(false));
  };

  const confirmPendingCourseAdd = () => {
    if (!pendingCourse || !pendingSemesterId) return;
    const semester = semesters.find((sem) => sem.id === pendingSemesterId);
    if (!semester) return;

    const courseToAdd: Course = {
      ...pendingCourse,
      selectedSectionId: pendingSectionId === "__none__" ? null : pendingSectionId,
    };
    addCoursesToCatalog([courseToAdd]);
    setSemesters((prev) =>
      prev.map((sem) =>
        sem.id === pendingSemesterId && !sem.courseIds.includes(courseToAdd.code)
          ? { ...sem, courseIds: [...sem.courseIds, courseToAdd.code] }
          : sem
      )
    );
    setAddingTo(null);
    setSearchTerm("");
    setSearchResults([]);
    setPendingCourse(null);
    setPendingSemesterId(null);
    setPendingSections([]);
    setPendingSectionId("__none__");
    triggerSave();
    toast.success(`${courseToAdd.code} added to ${semester.term} ${semester.year}`);
  };

  const removeCourse = (semId: string, courseId: string) => {
    setConfirmAction({ type: "delete-course", semId, courseId });
  };

  const confirmRemoveCourse = () => {
    if (confirmAction?.type === "delete-course" && confirmAction.courseId) {
      const removedCode = confirmAction.courseId;
      setSemesters((prev) =>
        prev.map((sem) =>
          sem.id === confirmAction.semId
            ? { ...sem, courseIds: sem.courseIds.filter((id) => id !== confirmAction.courseId) }
            : sem
        )
      );
      setConfirmAction(null);
      triggerSave();
      toast.success(`${removedCode} removed from plan`);
    }
  };

  // ── Add/remove semesters ───────────────────────────────────────────────────
  const addSemester = () => {
    const last = semesters[semesters.length - 1];
    const newTerm = last ? (last.term === "Fall" ? "Spring" : "Fall") : "Fall";
    const newYear = last ? (last.term === "Fall" ? last.year + 1 : last.year) : new Date().getFullYear();
    setSemesters((prev) => [
      ...prev,
      { id: `sem-${Date.now()}`, term: newTerm, year: newYear, courseIds: [], isPast: false, isCurrent: false },
    ]);
    triggerSave();
  };

  const removeSemester = (semId: string) => {
    setConfirmAction({ type: "delete-semester", semId });
  };

  const confirmRemoveSemester = () => {
    if (confirmAction?.type === "delete-semester") {
      const removedSemester = semesters.find((s) => s.id === confirmAction.semId);
      setSemesters((prev) => prev.filter((s) => s.id !== confirmAction.semId));
      setConfirmAction(null);
      triggerSave();
      if (removedSemester) {
        toast.success(`${removedSemester.term} ${removedSemester.year} removed`);
      }
    }
  };

  const totalCompleted = semesters
    .filter((s) => s.isPast)
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => acc + (planCatalog[id]?.credits ?? 0), 0);

  const majorName = majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code
    ?? "Your Major";
  const gradText = profile?.graduation_term && profile?.graduation_year
    ? `${profile.graduation_term.charAt(0).toUpperCase() + profile.graduation_term.slice(1)} ${profile.graduation_year}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-foreground">4-Year Planner</h1>
          <p className="text-xs text-muted-foreground">
            {majorName}{gradText ? ` · ${gradText} graduation` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={cn(
              "text-xs flex items-center gap-1.5 transition-colors",
              saving ? "text-muted-foreground" : lastSaved ? "text-green-600" : "text-muted-foreground"
            )}>
              {saving
                ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : lastSaved
                ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</>
                : null
              }
            </span>
            {lastSaved && !saving && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalCompleted}</span> / 120 cr</span>
            {profile?.gpa && (
              <span>GPA <span className="font-semibold text-foreground">{profile.gpa.toFixed(2)}</span></span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-yellow-600 font-medium">
                <AlertTriangle className="w-3 h-3" /> {warnings.length} warnings
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Semester columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory">
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: "max-content" }}>
          {semesters.map((sem) => {
            const load = getSemesterCreditLoad(sem, planCatalog);
            const semCredits = getTotalCredits(sem.courseIds, planCatalog);
            return (
              <div
                key={sem.id}
                className={cn(
                  "flex flex-col rounded-xl border w-52 flex-shrink-0 overflow-hidden transition-all duration-200 snap-center",
                  sem.isPast ? "opacity-60 bg-muted/30 border-border" : sem.isCurrent ? "bg-primary/5 border-primary/30" : "bg-background border-border",
                  dragOver === sem.id && "ring-2 ring-primary/60 bg-primary/10 border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(sem.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(sem.id)}
              >
                {/* Column header */}
                <div className={cn(
                  "px-3 py-2.5 border-b flex items-center justify-between",
                  sem.isPast ? "border-border/50" : sem.isCurrent ? "border-primary/20" : "border-border"
                )}>
                  <div>
                    <p className={cn("text-xs font-semibold", sem.isCurrent ? "text-primary" : "text-foreground")}>
                      {sem.term} {sem.year}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                        load === "overloaded" ? "bg-red-50 text-red-700" : load === "light" ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"
                      )}>
                        {semCredits}cr
                      </span>
                      {sem.isCurrent && (
                        <span className="text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                      {sem.isPast && (
                        <span className="text-[9px] text-muted-foreground">Completed</span>
                      )}
                    </div>
                  </div>
                  {!sem.isPast && (
                    <button
                      onClick={() => removeSemester(sem.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Course cards */}
                <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto min-h-[180px]">
                  {sem.courseIds.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-center py-6">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Drag courses here<br />or click + to add
                      </p>
                    </div>
                  )}
                  {sem.courseIds.map((cid) => {
                    const course = planCatalog[cid];
                    const hasWarn = warnSet.has(cid);
                    return (
                      <div
                        key={cid}
                        draggable={!sem.isPast}
                        onDragStart={() => handleDragStart(cid, sem.id)}
                        className={cn(
                          "border rounded-lg px-2.5 py-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group",
                          hasWarn && "border-yellow-300 bg-yellow-50/50",
                          !hasWarn && course && STATUS_COLORS[course.status],
                          !hasWarn && !course && "bg-card border-border",
                          sem.isPast && "cursor-default"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!sem.isPast && <GripVertical className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground/70" />}
                            {course && <span className={cn("w-2 h-2 rounded-full flex-shrink-0", LABEL_DOT[course.label])} />}
                            <span className="text-[10px] font-semibold text-foreground truncate">{cid}</span>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {hasWarn && (
                              <button title="Prerequisite warning" onClick={() => course && setSelectedCourse(course)}>
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                              </button>
                            )}
                            {sem.isPast && <Check className="w-3 h-3 text-green-500" />}
                            {course && (
                              <button
                                onClick={() => setSelectedCourse(course)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Info className="w-3 h-3 text-muted-foreground hover:text-primary" />
                              </button>
                            )}
                            {!sem.isPast && (
                              <button onClick={() => removeCourse(sem.id, cid)}>
                                <X className="w-3 h-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
                        </div>
                        {course && (
                          <>
                            <p className="text-[9px] text-muted-foreground truncate pl-4">{course.title}</p>
                            <div className="flex items-center justify-between pl-4 gap-1">
                              <span className={cn(
                                "text-[8px] font-medium px-1.5 py-0.5 rounded-full border",
                                LABEL_BADGE[course.label]
                              )}>
                                {LABEL_META[course.label].label}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {course.selectedSectionId && (
                                  <span className="text-[7px] font-mono bg-primary/10 text-primary px-1 py-0.5 rounded">
                                    SEC
                                  </span>
                                )}
                                {course.grade && (
                                  <span className="text-[7px] font-mono bg-green-100 text-green-700 px-1 py-0.5 rounded">
                                    {course.grade}
                                  </span>
                                )}
                                {course.offeredTerms.map((term) => (
                                  <span key={term} className="text-[7px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded">
                                    {TERM_ABBR(term)}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground">{course.credits}cr</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Course button */}
                {!sem.isPast && (
                  <div className="p-2 border-t border-border/50">
                    {addingTo === sem.id ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search courses…"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full text-[10px] px-2.5 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                          {searching && (
                            <p className="text-[9px] text-muted-foreground text-center py-2 flex items-center justify-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Searching…
                            </p>
                          )}
                          {!searching && searchTerm.length < 2 && (
                            <p className="text-[9px] text-muted-foreground text-center py-2">Type to search courses</p>
                          )}
                          {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                            <p className="text-[9px] text-muted-foreground text-center py-2">No courses found</p>
                          )}
                          {searchResults.slice(0, 8).map((c) => (
                            <button
                              key={c.code}
                              onClick={() => addCourse(sem.id, c)}
                              className="text-left px-2 py-1.5 rounded hover:bg-muted/60 transition-colors"
                            >
                              <p className="text-[10px] font-semibold text-foreground">{c.code}</p>
                              <p className="text-[9px] text-muted-foreground">{c.title} · {c.credits}cr</p>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => { setAddingTo(null); setSearchTerm(""); setSearchResults([]); }}
                          className="text-[9px] text-muted-foreground hover:text-foreground text-center"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTo(sem.id)}
                        className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground border border-dashed border-border rounded-md py-1.5 hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Course
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add semester button */}
          <button
            onClick={addSemester}
            className="flex-shrink-0 w-52 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors flex flex-col items-center justify-center gap-2 min-h-[300px]"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs font-medium">Add Semester</span>
          </button>
        </div>
      </div>

      {/* Course detail modal */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setSelectedCourse(null)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full", LABEL_DOT[selectedCourse.label])} />
                  <span className="font-bold text-foreground text-base">{selectedCourse.code}</span>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", LABEL_BADGE[selectedCourse.label])}>
                    {LABEL_META[selectedCourse.label].label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedCourse.title}</p>
              </div>
              <button onClick={() => setSelectedCourse(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{selectedCourse.description}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Credits</p>
                <p className="font-semibold text-foreground">{selectedCourse.credits}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Level</p>
                <p className="font-semibold text-foreground">{selectedCourse.level}</p>
              </div>
            </div>
            {selectedCourse.prereqs.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-foreground mb-2">Prerequisites</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourse.prereqs.map((prereq) => (
                    <span key={prereq} className="text-xs bg-muted border border-border rounded-md px-2 py-1 font-medium">
                      {prereq}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {warnSet.has(selectedCourse.id) && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-yellow-50 border border-yellow-200 mb-4">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  {(() => {
                    const warn = warnings.find((w) => w.courseId === selectedCourse.id);
                    return warn
                      ? `${warn.prereqId} must come before ${selectedCourse.code}. Move it to an earlier semester.`
                      : "A prerequisite hasn't been placed yet.";
                  })()}
                </p>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">Offered:</p>
              {selectedCourse.offeredTerms.map((t) => (
                <span key={t} className="text-xs bg-muted border border-border rounded px-1.5 py-0.5">{t}</span>
              ))}
            </div>
            {!selectedCourseSemester?.isPast && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Section</p>
                  {sectionsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading sections…</p>
                  ) : selectedCourseSections.length > 0 ? (
                    <Select
                      value={selectedCourse.selectedSectionId ?? "__none__"}
                      onValueChange={(value) => {
                        const nextValue = value === "__none__" ? null : value;
                        updateCourse(selectedCourse.code, { selectedSectionId: nextValue });
                        setSelectedCourse((prev) => (
                          prev ? { ...prev, selectedSectionId: nextValue } : prev
                        ));
                        triggerSave();
                        toast.success(nextValue ? "Section updated" : "Section cleared");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No section selected</SelectItem>
                        {selectedCourseSections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.section_code} · {section.instructors?.[0]?.name ?? "Instructor TBA"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">No sections available for this term.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Course status</p>
                  <Select
                    value={selectedCourse.status}
                    onValueChange={(value) => {
                      const nextStatus = value as Course["status"];
                      const nextGrade = nextStatus === "completed" ? (selectedCourse.grade ?? "A") : null;
                      updateCourse(selectedCourse.code, {
                        status: nextStatus,
                        grade: nextStatus === "completed" ? nextGrade : null,
                      });
                      setSelectedCourse((prev) => (
                        prev
                          ? {
                              ...prev,
                              status: nextStatus,
                              grade: nextStatus === "completed" ? nextGrade : null,
                            }
                          : prev
                      ));
                      triggerSave();
                      toast.success(`Marked ${selectedCourse.code} as ${nextStatus}`);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedCourse.status === "completed" && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Grade</p>
                    <Select
                      value={selectedCourse.grade ?? "A"}
                      onValueChange={(value) => {
                        updateCourse(selectedCourse.code, { grade: value, status: "completed" });
                        setSelectedCourse((prev) => (
                          prev ? { ...prev, grade: value, status: "completed" } : prev
                        ));
                        triggerSave();
                        toast.success(`Saved grade ${value} for ${selectedCourse.code}`);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"].map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          {confirmAction?.type === "delete-semester" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete semester?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove this semester and all courses in it from your plan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveSemester} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </div>
            </>
          )}
          {confirmAction?.type === "delete-course" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove course?</AlertDialogTitle>
                <AlertDialogDescription>This will remove the course from your plan.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveCourse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!pendingCourse && pendingSections.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCourse(null);
            setPendingSemesterId(null);
            setPendingSections([]);
            setPendingSectionId("__none__");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Section</DialogTitle>
            <DialogDescription>
              Pick a section for {pendingCourse?.code} before adding it to your semester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{pendingCourse?.code}</p>
              <p className="text-xs text-muted-foreground">{pendingCourse?.title}</p>
            </div>
            {pendingSectionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading sections…</p>
            ) : (
              <Select value={pendingSectionId} onValueChange={setPendingSectionId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Add without section</SelectItem>
                  {pendingSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.section_code} · {section.instructors?.[0]?.name ?? "Instructor TBA"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setPendingCourse(null);
                setPendingSemesterId(null);
                setPendingSections([]);
                setPendingSectionId("__none__");
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPendingCourseAdd}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Add course
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
