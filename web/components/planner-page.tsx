"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Check, AlertTriangle, GripVertical, Bell, BellOff,
  CheckCircle, Clock, Loader2, GraduationCap, ArrowRight, ListChecks,
} from "lucide-react";
import Link from "next/link";
import CourseReviews from "@/components/course-reviews";
import { cn, formatDisplayName } from "@/lib/utils";
import {
  getTotalCredits,
  getPrereqWarnings,
  getCoreqWarnings,
  getOfferedTermWarnings,
  getSemesterCreditLoad,
  getSemesterGpa,
  compareSemesters,
  markCurrentSemester,
  LABEL_META,
  LABEL_DOT,
  LABEL_BADGE,
  type Course,
  type Semester,
  type RequirementLabel,
  type SemesterTerm,
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
import { useAuth } from "@/contexts/auth-context";
import {
  createSectionAlert,
  deleteSectionAlert,
  fetchSectionAlerts,
  type BackendSection,
  type SectionAlert,
} from "@/lib/api";
import {
  getMissingRequired,
  countMatchingSections,
  type SchedulePreferences,
  filterSectionsByPreferences,
  formatSectionDate,
  formatSectionTime,
  formatMeetingTime,
  formatSeatSummary,
  getInstructorNames,
  sectionMatchesPreferences,
} from "@/lib/planner";
import { toast } from "sonner";

/**
 * PlannerPage is still a large orchestration component.
 *
 * It currently owns drag/drop, add-course search, course details, section
 * selection, semester add/remove/clear actions, and debounced saves. The next
 * safe UI split is to extract SectionOptionCard, CourseCard, SemesterColumn,
 * AddCourseDialog, and CourseDetailDialog while keeping only page-level wiring
 * here.
 */

const STATUS_COLORS = {
  completed: "bg-green-50 border-green-200",
  planned: "bg-card border-border",
  failed: "bg-red-50 border-red-200",
};


function SectionOptionCard({
  section,
  selected,
  onClick,
  footer,
}: {
  section: BackendSection;
  selected: boolean;
  onClick?: () => void;
  footer?: ReactNode;
}) {
  // Shared section display card for both "add course" and "edit selected
  // section" flows. Keep it display-only; persistence belongs to PlannerPage.
  const meetingSummary =
    section.meeting_times
      ?.map((meeting) =>
        formatMeetingTime(meeting.days, meeting.start_time, meeting.end_time)
      )
      .filter(Boolean) ?? [];
  const locationSummary =
    section.meeting_times
      ?.map((meeting) => {
        const parts = [meeting.location, meeting.building, meeting.room]
          .map((value) => value?.trim())
          .filter(Boolean);
        return parts.length > 0 ? parts.join(" â€¢ ") : null;
      })
      .filter((value): value is string => Boolean(value)) ?? [];
  const dateStart = formatSectionDate(section.start_date);
  const dateEnd = formatSectionDate(section.end_date);
  const dateSummary = dateStart && dateEnd ? `${dateStart} - ${dateEnd}` : dateStart ?? dateEnd;
  const seatSummary = formatSeatSummary(section);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full rounded-lg border p-3 text-left transition-colors",
          onClick && "hover:border-primary/40 hover:bg-muted/40",
          selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{section.section_code}</p>
            <p className="text-xs text-muted-foreground">{getInstructorNames(section)}</p>
          </div>
          {selected && (
            <span className="text-[10px] font-medium rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              Selected
            </span>
          )}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {meetingSummary.length > 0 ? (
            meetingSummary.map((line) => (
              <p key={`${section.id}-${line}`}>{line}</p>
            ))
          ) : (
            <p>Meeting time TBA</p>
          )}
          {locationSummary.slice(0, 2).map((line) => (
            <p key={`${section.id}-loc-${line}`}>{line}</p>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {section.modality && (
              <span className="rounded-full bg-muted px-2 py-0.5">{section.modality}</span>
            )}
            {section.campus && (
              <span className="rounded-full bg-muted px-2 py-0.5">{section.campus}</span>
            )}
            {seatSummary && (
              <span className="rounded-full bg-muted px-2 py-0.5">{seatSummary}</span>
            )}
          </div>
          {dateSummary && <p className="pt-1">{dateSummary}</p>}
        </div>
      </button>
      {footer}
    </div>
  );
}

type DragState = { courseId: string; fromSemId: string } | null;
type ConfirmAction =
  | { type: "delete-semester"; semId: string }
  | { type: "delete-course"; semId: string; courseId: string }
  | { type: "clear-plan" }
  | null;

export default function PlannerPage() {
  const { accessToken } = useAuth();
  const {
    semesters,
    setSemesters,
    planCatalog,
    majors,
    addCourseToSemester,
    savePlan,
    searchCoursesCatalog,
    loadSectionsForCourses,
    profile,
    loading,
    updateCourse,
    clearPlan,
    degreeCreditTotal,
    labels,
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
  const [sectionDraftId, setSectionDraftId] = useState<string>("__none__");
  const [savingSectionSelection, setSavingSectionSelection] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [pendingSemesterId, setPendingSemesterId] = useState<string | null>(null);
  const [pendingSections, setPendingSections] = useState<BackendSection[]>([]);
  const [pendingSectionId, setPendingSectionId] = useState<string>("__none__");
  const [pendingSectionsLoading, setPendingSectionsLoading] = useState(false);
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqModalSemId, setReqModalSemId] = useState<string>("");
  const [alerts, setAlerts] = useState<SectionAlert[]>([]);
  const [searchSectionMatchCounts, setSearchSectionMatchCounts] = useState<Record<string, number>>({});
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizer, setOptimizer] = useState<SchedulePreferences>({
    earliestStartHour: null,
    latestEndHour: null,
    noFriday: false,
    dayPattern: "any",
    onlyMatching: false,
  });
  const [newSemesterTerm, setNewSemesterTerm] = useState<SemesterTerm>("Fall");
  const [newSemesterYear, setNewSemesterYear] = useState<number>(new Date().getFullYear());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  // Most planner edits update local state immediately and save after a short
  // delay. This keeps drag/drop responsive without writing on every movement.
  // Always hold the latest savePlan reference so the debounced timer
  // never closes over a stale version of it.
  const savePlanRef = useRef(savePlan);
  useEffect(() => { savePlanRef.current = savePlan; }, [savePlan]);

  // Warn the user before closing the tab if a save is queued or in flight.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaveRef.current || saving) e.preventDefault();
    };
    if (typeof window === "undefined") return;
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saving]);

  useEffect(() => {
    if (!accessToken) {
      setAlerts([]);
      return;
    }
    fetchSectionAlerts(accessToken)
      .then(setAlerts)
      .catch((err) => { console.error("[planner] alerts load failed:", err); setAlerts([]); });
  }, [accessToken]);

  // Search for courses to add
  useEffect(() => {
    if (!addingTo || searchTerm.length < 2) {
      setSearchResults([]);
      setSearchSectionMatchCounts({});
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCoursesCatalog(searchTerm);
        // Re-compute allUsed inside the async callback to get the latest semesters
        const used = new Set(semesters.flatMap((s) => s.courseIds));
        setSearchResults(results.filter((c) => !used.has(c.code)));
      } catch (err) {
        console.error("[planner] course search failed:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, addingTo, searchCoursesCatalog, semesters]);

  useEffect(() => {
    const semester = semesters.find((sem) => sem.id === addingTo);
    if (!addingTo || !semester || searchResults.length === 0) {
      setSearchSectionMatchCounts({});
      return;
    }

    const termFilter = `${semester.term.toLowerCase()} ${semester.year}`;
    const courseCodes = searchResults.slice(0, 12).map((course) => course.code);
    loadSectionsForCourses(courseCodes, termFilter)
      .then((data) => {
        const nextCounts: Record<string, number> = {};
        courseCodes.forEach((code) => {
          nextCounts[code] = countMatchingSections(data[code] ?? [], optimizer);
        });
        setSearchSectionMatchCounts(nextCounts);
      })
      .catch((err) => { console.error("[planner] section counts failed:", err); setSearchSectionMatchCounts({}); });
  }, [addingTo, searchResults, semesters, loadSectionsForCourses, optimizer]);

  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = true;
    saveTimerRef.current = setTimeout(async () => {
      pendingSaveRef.current = false;
      setSaving(true);
      try {
        // Use the ref so we always call the latest savePlan, which holds
        // the latest semesters/planCatalog state at call time.
        await savePlanRef.current();
        setLastSaved(new Date());
      } catch (err) {
        console.error("[planner] plan save failed:", err);
        toast.error("Your plan couldn't be saved. Check your connection and try again.");
      } finally {
        setSaving(false);
      }
    }, 1200);
  }, []); // no deps â€” the ref handles currency

  const warnings = getPrereqWarnings(semesters, planCatalog);
  const coreqWarnings = getCoreqWarnings(semesters, planCatalog);
  const offeredTermWarns = getOfferedTermWarnings(semesters, planCatalog);
  const warnSet = new Set([
    ...warnings.map((w) => w.courseId),
    ...coreqWarnings.map((w) => w.courseId),
    ...offeredTermWarns.map((w) => w.courseId),
  ]);
  const planCodes = new Set(semesters.flatMap((s) => s.courseIds));
  const LABEL_KEY: Record<string, RequirementLabel> = {
    "Required": "required", "Group Choice": "group",
    "Major Elective": "elective", "General Elective": "general",
  };
  const missingRequired = getMissingRequired(labels, planCodes);
  const selectedCourseSemester = selectedCourse
    ? semesters.find((sem) => sem.courseIds.includes(selectedCourse.code))
    : null;
  const selectedCourseAlertMap = new Map(alerts.map((alert) => [alert.section_id, alert]));
  const filteredSelectedSections = filterSectionsByPreferences(selectedCourseSections, optimizer);
  const filteredPendingSections = filterSectionsByPreferences(pendingSections, optimizer);
  const hasOptimizerFilters = Boolean(
    optimizer.earliestStartHour != null ||
    optimizer.latestEndHour != null ||
    optimizer.noFriday ||
    optimizer.dayPattern !== "any"
  );
  const applySemesters = useCallback((nextSemesters: Semester[]) => {
    const normalized = markCurrentSemester([...nextSemesters].sort(compareSemesters));
    setSemesters(normalized);
    return normalized;
  }, [setSemesters]);

  const toggleSectionAlert = useCallback(async (courseCode: string, section: BackendSection) => {
    if (!accessToken) return;
    const existing = alerts.find((alert) => alert.section_id === section.id);
    try {
      if (existing) {
        await deleteSectionAlert(accessToken, existing.id);
        setAlerts((prev) => prev.filter((alert) => alert.id !== existing.id));
        toast.success(`Removed alert for ${courseCode} ${section.section_code}`);
      } else {
        const created = await createSectionAlert(accessToken, {
          course_code: courseCode,
          section_id: section.id,
          term: section.term,
        });
        setAlerts((prev) => [created, ...prev.filter((alert) => alert.id !== created.id)]);
        toast.success(`We'll email you if ${section.section_code} opens.`);
      }
    } catch (error) {
      console.error("[PlannerPage] failed to toggle alert:", error);
      toast.error("Couldn't update section alert.");
    }
  }, [accessToken, alerts]);

  const sectionHasOpenSeats = (section: BackendSection) => (section.seats?.available ?? 0) > 0;

  const renderSectionAlertButton = (courseCode: string, section: BackendSection) => {
    if (sectionHasOpenSeats(section)) return null;
    const existing = selectedCourseAlertMap.get(section.id);
    return (
      <button
        type="button"
        onClick={() => void toggleSectionAlert(courseCode, section)}
        disabled={!accessToken}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50",
          existing
            ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-border bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        {existing ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
        {existing ? "Alert on" : "Alert me"}
      </button>
    );
  };

  useEffect(() => {
    if (!selectedCourse) {
      setSelectedCourseSections([]);
      setSectionDraftId("__none__");
      return;
    }

    setSectionsLoading(true);
    setSectionDraftId(selectedCourse.selectedSectionId ?? "__none__");
    const termFilter = selectedCourseSemester
      ? `${selectedCourseSemester.term.toLowerCase()} ${selectedCourseSemester.year}`
      : undefined;

    loadSectionsForCourses([selectedCourse.code], termFilter)
      .then((data) => {
        setSelectedCourseSections(data[selectedCourse.code] ?? []);
      })
      .catch((err) => { console.error("[planner] sections load failed:", err); setSelectedCourseSections([]); })
      .finally(() => setSectionsLoading(false));
  }, [selectedCourse, selectedCourseSemester, loadSectionsForCourses]);

  const saveSelectedCourseSection = async () => {
    if (!selectedCourse) return;
    const nextValue = sectionDraftId === "__none__" ? null : sectionDraftId;
    if ((selectedCourse.selectedSectionId ?? "__none__") === (nextValue ?? "__none__")) return;

    setSavingSectionSelection(true);
    try {
      updateCourse(selectedCourse.code, { selectedSectionId: nextValue });
      setSelectedCourse((prev) => (
        prev ? { ...prev, selectedSectionId: nextValue } : prev
      ));
      await savePlan();
    } catch (err) {
      console.error("[PlannerPage] failed to save section:", err);
    } finally {
      setSavingSectionSelection(false);
    }
  };

  // â”€â”€ Drag handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDragStart = (courseId: string, semId: string) => {
    setDrag({ courseId, fromSemId: semId });
  };

  const handleDrop = (toSemId: string) => {
    if (!drag || drag.fromSemId === toSemId) {
      setDrag(null); setDragOver(null);
      return;
    }
    setSemesters((prev) =>
      markCurrentSemester(prev.map((sem) => {
        if (sem.id === drag.fromSemId)
          return { ...sem, courseIds: sem.courseIds.filter((id) => id !== drag.courseId) };
        if (sem.id === toSemId)
          return { ...sem, courseIds: [...sem.courseIds, drag.courseId] };
        return sem;
      }))
    );
    setDrag(null); setDragOver(null);
    triggerSave();
  };

  // â”€â”€ Add/remove courses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addCourse = (semId: string, course: Course) => {
    const semester = semesters.find((sem) => sem.id === semId);
    if (!semester) return;

    setPendingCourse(course);
    setPendingSemesterId(semId);
    setPendingSections([]);
    setPendingSectionId("__none__");
    setPendingSectionsLoading(true);

    const termFilter = `${semester.term.toLowerCase()} ${semester.year}`;
    loadSectionsForCourses([course.code], termFilter)
      .then(async (data) => {
        const sections = data[course.code] ?? [];
        setPendingSections(sections);
        if (sections.length === 0) {
          // No section to pick â€” add directly via context (writes planCatalog + saves)
          await addCourseToSemester(course, semId);
          setAddingTo(null);
          setSearchTerm("");
          setSearchResults([]);
          setPendingCourse(null);
          setPendingSemesterId(null);
          }
        // If sections exist, the pending-section dialog opens (state already set above)
      })
      .catch(async (err: unknown) => {
        console.error(“[planner] section fetch failed, adding without section:”, err);
        await addCourseToSemester(course, semId);
        setAddingTo(null);
        setSearchTerm("");
        setSearchResults([]);
        setPendingCourse(null);
        setPendingSemesterId(null);
      })
      .finally(() => setPendingSectionsLoading(false));
  };

  const confirmPendingCourseAdd = async () => {
    if (!pendingCourse || !pendingSemesterId) return;
    const semester = semesters.find((sem) => sem.id === pendingSemesterId);
    if (!semester) return;

    const courseToAdd: Course = {
      ...pendingCourse,
      selectedSectionId: pendingSectionId === "__none__" ? null : pendingSectionId,
    };

    // addCourseToSemester atomically: writes planCatalog + semester + persists
    await addCourseToSemester(courseToAdd, pendingSemesterId);
    setAddingTo(null);
    setSearchTerm("");
    setSearchResults([]);
    setPendingCourse(null);
    setPendingSemesterId(null);
    setPendingSections([]);
    setPendingSectionId("__none__");
  };

  const removeCourse = (semId: string, courseId: string) => {
    setConfirmAction({ type: "delete-course", semId, courseId });
  };

  const confirmRemoveCourse = () => {
    if (confirmAction?.type === "delete-course" && confirmAction.courseId) {
      const removedCode = confirmAction.courseId;
      setSemesters((prev) =>
        markCurrentSemester(prev.map((sem) =>
          sem.id === confirmAction.semId
            ? { ...sem, courseIds: sem.courseIds.filter((id) => id !== confirmAction.courseId) }
            : sem
        ))
      );
      setConfirmAction(null);
      triggerSave();
    }
  };

  // â”€â”€ Add/remove semesters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSemester = () => {
    if (semesters.some((semester) => semester.term === newSemesterTerm && semester.year === newSemesterYear)) {
      toast.error(`${newSemesterTerm} ${newSemesterYear} already exists in your plan.`);
      return;
    }

    applySemesters([
      ...semesters,
      {
        id: `sem-${Date.now()}`,
        term: newSemesterTerm,
        year: newSemesterYear,
        courseIds: [],
        isPast: false,
        isCurrent: false,
      },
    ]);
    setSemesterDialogOpen(false);
    triggerSave();
  };

  const removeSemester = (semId: string) => {
    setConfirmAction({ type: "delete-semester", semId });
  };

  const confirmRemoveSemester = () => {
    if (confirmAction?.type === "delete-semester") {
      const removedSemester = semesters.find((s) => s.id === confirmAction.semId);
      setSemesters((prev) => markCurrentSemester(prev.filter((s) => s.id !== confirmAction.semId).sort(compareSemesters)));
      setConfirmAction(null);
      triggerSave();
    }
  };

  const confirmClearPlan = async () => {
    try {
      await clearPlan();
      setConfirmAction(null);
    } catch (err) {
      console.error("[PlannerPage] failed to clear plan:", err);
      toast.error("Failed to clear planner");
    }
  };

  const totalCompleted = semesters
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => {
      const course = planCatalog[id];
      return course?.status === "completed" ? acc + course.credits : acc;
    }, 0);
  const rawGpa = profile?.gpa;
  const parsedGpa =
    rawGpa == null
      ? null
      : typeof rawGpa === "number"
      ? rawGpa
      : Number(rawGpa);
  const gpa = parsedGpa != null && Number.isFinite(parsedGpa) ? parsedGpa : null;
  const displayedSemesters = [...semesters].sort((a, b) => {
    if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
    const chronological = compareSemesters(a, b);
    return a.isPast ? -chronological : chronological;
  });

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code
    ?? "Your Major"
  );
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
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border bg-background flex-shrink-0 gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">4-Year Planner</h1>
          <p className="text-xs text-muted-foreground truncate">
            {majorName}{gradText ? ` Â· ${gradText}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {missingRequired.length > 0 && (
            <button
              onClick={() => {
                setReqModalSemId(semesters.find((s) => s.isCurrent)?.id ?? semesters.find((s) => !s.isPast)?.id ?? "");
                setReqModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Missing Reqs</span>
              <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {missingRequired.length}
              </span>
            </button>
          )}
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalCompleted}</span> / {degreeCreditTotal} cr</span>
            {gpa !== null && (
              <span>GPA <span className="font-semibold text-foreground">{gpa.toFixed(2)}</span></span>
            )}
            {(warnings.length + coreqWarnings.length) > 0 && (
              <span className="flex items-center gap-1 text-yellow-600 font-medium">
                <AlertTriangle className="w-3 h-3" /> {warnings.length + coreqWarnings.length}
              </span>
            )}
          </div>
          <span className={cn(
            "text-xs flex items-center gap-1 transition-colors",
            saving ? "text-muted-foreground" : lastSaved ? "text-green-600" : "text-muted-foreground"
          )}>
            {saving
              ? <><Clock className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline"> Savingâ€¦</span></>
              : lastSaved
              ? <><CheckCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Saved</span></>
              : null
            }
          </span>
          <button
            onClick={() => setConfirmAction({ type: "clear-plan" })}
            className="hidden md:block text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="px-4 md:px-5 py-2.5 border-b border-border/60 bg-muted/20 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOptimizerOpen((prev) => !prev)}
            className="text-xs font-medium text-foreground hover:text-primary transition-colors"
          >
            {optimizerOpen ? "Hide optimizer" : "Show optimizer"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            Filter sections by time preferences before you pick them.
          </p>
        </div>
        {optimizerOpen && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select
              value={optimizer.earliestStartHour ?? ""}
              onChange={(e) => setOptimizer((prev) => ({ ...prev, earliestStartHour: e.target.value ? Number(e.target.value) : null }))}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-xs"
            >
              <option value="">Earliest start</option>
              <option value="9">After 9am</option>
              <option value="10">After 10am</option>
              <option value="11">After 11am</option>
            </select>
            <select
              value={optimizer.latestEndHour ?? ""}
              onChange={(e) => setOptimizer((prev) => ({ ...prev, latestEndHour: e.target.value ? Number(e.target.value) : null }))}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-xs"
            >
              <option value="">Latest end</option>
              <option value="15">By 3pm</option>
              <option value="16">By 4pm</option>
              <option value="17">By 5pm</option>
              <option value="18">By 6pm</option>
            </select>
            <select
              value={optimizer.dayPattern}
              onChange={(e) => setOptimizer((prev) => ({ ...prev, dayPattern: e.target.value as SchedulePreferences["dayPattern"] }))}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-xs"
            >
              <option value="any">Any days</option>
              <option value="mwf">MWF only</option>
              <option value="tth">T/Th only</option>
            </select>
            <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2 text-xs">
              <input
                type="checkbox"
                checked={optimizer.noFriday}
                onChange={(e) => setOptimizer((prev) => ({ ...prev, noFriday: e.target.checked }))}
              />
              No Friday
            </label>
            <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2 text-xs">
              <input
                type="checkbox"
                checked={optimizer.onlyMatching}
                onChange={(e) => setOptimizer((prev) => ({ ...prev, onlyMatching: e.target.checked }))}
              />
              Hide non-matches
            </label>
          </div>
        )}
      </div>

      {/* Semester columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory">
        <div className="flex gap-3 p-4 pb-4 h-full" style={{ minWidth: "max-content" }}>
          {displayedSemesters.map((sem) => {
            const load = getSemesterCreditLoad(sem, planCatalog);
            const semCredits = getTotalCredits(sem.courseIds, planCatalog);
            const semesterGpa = getSemesterGpa(sem, planCatalog);
            const columnHeightClass =
              sem.courseIds.length >= 6 ? "min-h-[420px]" : sem.courseIds.length >= 4 ? "min-h-[340px]" : "min-h-[260px]";
            return (
              <div
                key={sem.id}
                className={cn(
                  "flex flex-col rounded-xl border w-60 flex-shrink-0 overflow-hidden transition-all duration-200 snap-center",
                  columnHeightClass,
                  sem.isPast ? "opacity-60 bg-muted/30 border-border" : sem.isCurrent ? "bg-primary/5 border-primary/30" : "bg-background border-border",
                  dragOver === sem.id && "ring-2 ring-primary/60 bg-primary/10 border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(sem.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(sem.id)}
              >
                {/* Column header */}
                <div className={cn(
                  "px-4 py-2 border-b flex items-center justify-between",
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
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      {semesterGpa !== null ? `GPA ${semesterGpa.toFixed(2)}` : sem.isPast ? "No GPA yet" : "In progress"}
                    </div>
                  </div>
                  <button
                    onClick={() => removeSemester(sem.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                    aria-label={`Remove ${sem.term} ${sem.year}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Course cards */}
                <div className="flex-1 p-2.5 flex flex-col gap-1.5 overflow-y-auto min-h-[120px]">
                  {sem.courseIds.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-center py-6">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Drag courses here<br />or click + to add
                      </p>
                    </div>
                  )}
                  <AnimatePresence>
                  {[...new Set(sem.courseIds)].map((cid) => {
                    const course = planCatalog[cid];
                    const hasWarn = warnSet.has(cid);
                    return (
                      <motion.div
                        key={cid}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        draggable={!sem.isPast}
                        onDragStart={() => handleDragStart(cid, sem.id)}
                        onClick={() => course && setSelectedCourse(course)}
                        className={cn(
                          "border rounded-lg px-3 py-2 flex flex-col gap-1 cursor-pointer shadow-sm hover:shadow-md transition-shadow group",
                          hasWarn && "border-yellow-300 bg-yellow-50/50",
                          !hasWarn && course && STATUS_COLORS[course.status],
                          !hasWarn && !course && "bg-card border-border",
                          !sem.isPast && "active:cursor-grabbing",
                          sem.isPast && "cursor-pointer"
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
                              <button
                                title="Planning warning"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (course) setSelectedCourse(course);
                                }}
                              >
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                              </button>
                            )}
                            {sem.isPast && <Check className="w-3 h-3 text-green-500" />}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCourse(sem.id, cid);
                              }}
                              aria-label={`Remove ${cid}`}
                            >
                              <X className="w-3 h-3 text-muted-foreground hover:text-destructive opacity-70 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </div>
                        </div>
                        {course && (
                          <>
                            <p className="text-[10px] text-muted-foreground leading-snug pl-4 line-clamp-2">{course.title}</p>
                            {course.prereqs.length > 0 && (
                              <p className="text-[8px] text-muted-foreground pl-4 truncate" title={`Prereq: ${course.prereqs.join(", ")}`}>
                                <span className="font-semibold">Prereq:</span> {course.prereqs.join(" â†’ ")}
                              </p>
                            )}
                            {course.coreqs.length > 0 && (
                              <p className="text-[8px] text-muted-foreground pl-4 truncate" title={`Coreq: ${course.coreqs.join(", ")}`}>
                                <span className="font-semibold">Coreq:</span> {course.coreqs.join(" + ")}
                              </p>
                            )}
                            <div className="flex items-center justify-between pl-4 gap-2">
                              <span className={cn(
                                "text-[8px] font-medium px-1.5 py-0.5 rounded-full border",
                                LABEL_BADGE[course.label]
                              )}>
                                {LABEL_META[course.label].label}
                              </span>
                              <div className="flex items-center gap-1">
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
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground">{course.credits}cr</span>
                            </div>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>

                {/* Add Course button */}
                {!sem.isPast && (
                  <div className="p-2 border-t border-border/50">
                    {addingTo === sem.id ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search coursesâ€¦"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full text-[10px] px-2.5 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                          {searching && (
                            <p className="text-[9px] text-muted-foreground text-center py-2 flex items-center justify-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Searchingâ€¦
                            </p>
                          )}
                          {!searching && searchTerm.length < 2 && (
                            <p className="text-[9px] text-muted-foreground text-center py-2">Type to search courses</p>
                          )}
                          {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                            <p className="text-[9px] text-muted-foreground text-center py-2">No courses found</p>
                          )}
                          {searchResults
                            .slice(0, 8)
                            .filter((course) => {
                              if (!optimizer.onlyMatching) return true;
                              const count = searchSectionMatchCounts[course.code];
                              return count == null || count > 0;
                            })
                            .map((c) => {
                              const matchCount = searchSectionMatchCounts[c.code];
                              return (
                                <button
                                  key={c.code}
                                  onClick={() => addCourse(sem.id, c)}
                                  className="text-left px-2 py-1.5 rounded hover:bg-muted/60 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold text-foreground">{c.code}</p>
                                    {typeof matchCount === "number" && (
                                      <span
                                        className={cn(
                                          "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                                          matchCount > 0
                                            ? "bg-green-50 text-green-700"
                                            : "bg-yellow-50 text-yellow-700"
                                        )}
                                      >
                                        {matchCount} match{matchCount === 1 ? "" : "es"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground">{c.title} · {c.credits}cr</p>
                                </button>
                              );
                            })}
                          {!searching &&
                            optimizer.onlyMatching &&
                            searchResults.length > 0 &&
                            searchResults.slice(0, 8).every((course) => {
                              const count = searchSectionMatchCounts[course.code];
                              return typeof count === "number" && count === 0;
                            }) && (
                              <p className="text-[9px] text-muted-foreground text-center py-2">
                                No search results match the optimizer filters.
                              </p>
                            )}
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

          {/* Empty state â€” shown when no semesters exist */}
          {semesters.length === 0 && (
            <div className="flex-shrink-0 w-80 rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center gap-4 min-h-[260px] justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Start planning your degree</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Add your first semester to begin building your 4-year plan, or import your transcript if you&apos;re already in progress.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => setSemesterDialogOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-4 py-2.5 hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Semester
                </button>
                <Link
                  href="/requirements"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border text-xs font-medium px-4 py-2.5 text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" /> View Degree Requirements
                </Link>
              </div>
            </div>
          )}

          {/* Add semester button */}
          <button
            onClick={() => setSemesterDialogOpen(true)}
            className="flex-shrink-0 w-60 rounded-xl border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors flex flex-col items-center justify-center gap-2 min-h-[260px]"
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
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto"
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
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {selectedCourse.description?.trim() || "No catalog description is available for this course yet."}
            </p>
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
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Must complete before this course
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourse.prereqs.map((prereq, i) => (
                    <span key={prereq} className="flex items-center gap-1">
                      <span className="text-xs bg-background border border-border rounded-md px-2 py-1 font-mono font-medium text-foreground">
                        {prereq}
                      </span>
                      {i < selectedCourse.prereqs.length - 1 && (
                        <span className="text-xs text-muted-foreground">â†’</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedCourse.coreqs.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Should be taken with this course
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourse.coreqs.map((coreq) => (
                    <span key={coreq} className="text-xs bg-background border border-border rounded-md px-2 py-1 font-mono font-medium text-foreground">
                      {coreq}
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
                    const prereqWarn = warnings.find((w) => w.courseId === selectedCourse.id);
                    if (prereqWarn) {
                      return `${prereqWarn.prereqId} must come before ${selectedCourse.code}. Move it to an earlier semester.`;
                    }
                    const coreqWarn = coreqWarnings.find((w) => w.courseId === selectedCourse.id);
                    if (coreqWarn) {
                      return `${coreqWarn.coreqId} should be taken in the same semester as ${selectedCourse.code}, or earlier if already completed.`;
                    }
                    const offeredWarn = offeredTermWarns.find((w) => w.courseId === selectedCourse.id);
                    if (offeredWarn) {
                      return `${selectedCourse.code} may not be offered in ${offeredWarn.semesterTerm}. Check the catalog before registering.`;
                    }
                    return "This course has a planning warning.";
                  })()}
                </p>
              </div>
            )}
            {!selectedCourseSemester?.isPast && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Section</p>
                  {sectionsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading sectionsâ€¦</p>
                  ) : selectedCourseSections.length > 0 ? (
                    <div className="space-y-3">
                      <Select
                        value={sectionDraftId}
                        onValueChange={setSectionDraftId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a section" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="__none__">No section selected</SelectItem>
                          {filteredSelectedSections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.section_code} · {getInstructorNames(section)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {optimizer.onlyMatching && filteredSelectedSections.length === 0 && hasOptimizerFilters && (
                        <p className="text-xs text-muted-foreground">
                          No sections match your optimizer filters. Relax the filters to see the full list.
                        </p>
                      )}

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {filteredSelectedSections.map((section) => (
                          <SectionOptionCard
                            key={section.id}
                            section={section}
                            selected={sectionDraftId === section.id}
                            onClick={() => setSectionDraftId(section.id)}
                            footer={
                              <div className="flex items-center justify-between gap-2 px-1">
                                <span
                                  className={cn(
                                    "text-[11px]",
                                    sectionMatchesPreferences(section, optimizer) ? "text-green-700" : "text-yellow-700"
                                  )}
                                >
                                  {sectionMatchesPreferences(section, optimizer) ? "Matches preferences" : "Outside current filters"}
                                </span>
                                {renderSectionAlertButton(selectedCourse.code, section)}
                              </div>
                            }
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSectionDraftId("__none__")}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear selection
                        </button>
                        <button
                          type="button"
                          onClick={saveSelectedCourseSection}
                          disabled={savingSectionSelection || sectionDraftId === (selectedCourse.selectedSectionId ?? "__none__")}
                          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                          {savingSectionSelection ? "Saving..." : "Save section"}
                        </button>
                      </div>
                    </div>
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

            <CourseReviews courseCode={selectedCourse.code} />
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
          {confirmAction?.type === "clear-plan" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear entire planner?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all semesters and courses from the planner and clears imported completed courses and GPA.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmClearPlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear everything
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
              <p className="text-sm text-muted-foreground">Loading sectionsâ€¦</p>
            ) : (
              <div className="space-y-3">
                <Select value={pendingSectionId} onValueChange={setPendingSectionId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a section" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__">Add without section</SelectItem>
                    {filteredPendingSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.section_code} · {getInstructorNames(section)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {optimizer.onlyMatching && filteredPendingSections.length === 0 && hasOptimizerFilters && (
                  <p className="text-xs text-muted-foreground">
                    No sections match your optimizer filters. Relax the filters or add without a section.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setPendingSectionId("__none__")}
                  className={cn(
                    "w-full rounded-lg border border-dashed p-3 text-left transition-colors",
                    pendingSectionId === "__none__"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <p className="text-sm font-semibold">Add without section</p>
                  <p className="text-xs">You can choose a section later from the course details.</p>
                </button>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredPendingSections.map((section) => (
                    <SectionOptionCard
                      key={section.id}
                      section={section}
                      selected={pendingSectionId === section.id}
                      onClick={() => setPendingSectionId(section.id)}
                      footer={
                        <div className="flex items-center justify-between gap-2 px-1">
                          <span
                            className={cn(
                              "text-[11px]",
                              sectionMatchesPreferences(section, optimizer) ? "text-green-700" : "text-yellow-700"
                            )}
                          >
                            {sectionMatchesPreferences(section, optimizer) ? "Matches preferences" : "Outside current filters"}
                          </span>
                          {pendingCourse ? renderSectionAlertButton(pendingCourse.code, section) : null}
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
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

      {/* Missing Requirements modal */}
      <Dialog open={reqModalOpen} onOpenChange={setReqModalOpen}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Missing Required Courses</DialogTitle>
            <DialogDescription>
              These Required and Group Choice courses aren&apos;t in your plan yet. Pick a semester and add them.
            </DialogDescription>
          </DialogHeader>

          {semesters.filter((s) => !s.isPast).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Add a semester first, then come back here to schedule your required courses.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">Add to:</span>
                <Select value={reqModalSemId} onValueChange={setReqModalSemId}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.filter((s) => !s.isPast).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.term} {s.year}{s.isCurrent ? " (Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                {missingRequired.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    All required and group choice courses are already in your plan.
                  </p>
                ) : (
                  missingRequired.map(({ code, entry }) => {
                    const label = LABEL_KEY[entry.label] ?? "general";
                    const course: Course = {
                      id: code,
                      code,
                      title: entry.detail || code,
                      credits: entry.credits ?? 3,
                      label,
                      status: "planned",
                      grade: null,
                      selectedSectionId: null,
                      description: "",
                      prereqs: [],
                      coreqs: [],
                      offeredTerms: [],
                      subject: code.split("-")[0] ?? "",
                      level: (() => {
                        const n = parseInt(code.match(/\d{3}/)?.[0] ?? "100");
                        return (n < 200 ? 100 : n < 300 ? 200 : n < 400 ? 300 : 400) as 100 | 200 | 300 | 400;
                      })(),
                    };
                    return (
                      <div key={code} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", LABEL_DOT[label])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{code}</p>
                          {entry.detail && entry.detail !== code && (
                            <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                          {entry.credits ?? "?"}cr
                        </span>
                        <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0", LABEL_BADGE[label])}>
                          {LABEL_META[label].label}
                        </span>
                        <button
                          disabled={!reqModalSemId}
                          onClick={() => {
                            if (!reqModalSemId) return;
                            addCourse(reqModalSemId, course);
                          }}
                          className="flex-shrink-0 text-[10px] font-medium bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setReqModalOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 py-2 text-sm"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={semesterDialogOpen} onOpenChange={setSemesterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Semester</DialogTitle>
            <DialogDescription>
              Choose exactly where this semester belongs. It will be inserted into the correct year automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Term</p>
              <Select value={newSemesterTerm} onValueChange={(value) => setNewSemesterTerm(value as SemesterTerm)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Spring", "Summer", "Fall", "Winter"] as SemesterTerm[]).map((term) => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Year</p>
              <input
                type="number"
                value={newSemesterYear}
                onChange={(event) => setNewSemesterYear(Number(event.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                min={2000}
                max={2100}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setSemesterDialogOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addSemester}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Add semester
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


