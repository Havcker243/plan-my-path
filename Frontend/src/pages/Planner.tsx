import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Plus,
  Undo2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SemesterCard } from "@/components/planner/SemesterCard";
import { CourseCard } from "@/components/planner/CourseCard";
import { CourseDetailModal } from "@/components/planner/CourseDetailModal";
import { AutosaveIndicator } from "@/components/planner/AutosaveIndicator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlanner } from "@/contexts/PlannerContext";
import { SectionProvider, useSections } from "@/contexts/SectionContext";
import { usePlannerValidation } from "@/hooks/usePlannerValidation";
import { useAutosave } from "@/hooks/useAutosave";
import { PlannedCourse, Semester, SemesterType } from "@/types/planner";
import { exportToICS } from "@/utils/icsExport";
import { toast } from "@/hooks/use-toast";
import { isTBAOrOnline, doMeetingTimesConflict } from "@/utils/timeUtils";
import { fetchCourseLabels, fetchMajors, type CourseLabelsResponse } from "@/lib/api";

interface UndoState {
  semesters: Semester[];
  description: string;
}

function PlannerContent() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    semesters,
    isOnboarded,
    moveCourse,
    removeCourse,
    addSemester,
    createSemester,
    replaceSemesters,
    markCourseCompleted,
    selectedCourse,
    setSelectedCourse,
    totalCredits,
    earnedCredits,
    currentGPA,
    totalCourses,
    studentProfile,
    savePlan,
  } = usePlanner();

  const { validateDrop } = usePlannerValidation();
  const { fetchSectionsForSemester, getSectionForCourse, isSemesterCached } = useSections();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [showSemesterDialog, setShowSemesterDialog] = useState(false);
  const [newSemesterTerm, setNewSemesterTerm] = useState<SemesterType>("fall");
  const [newSemesterYear, setNewSemesterYear] = useState<number>(new Date().getFullYear());
  const [semesterConflicts, setSemesterConflicts] = useState<Record<string, Record<string, string[]>>>({});
  const [courseLabels, setCourseLabels] = useState<CourseLabelsResponse>({});
  const [majorName, setMajorName] = useState<string | null>(null);

  const { status: autosaveStatus } = useAutosave({
    data: semesters,
    onSave: async () => {
      await savePlan();
    },
    enabled: isOnboarded,
  });

  // Fetch requirement labels and major name when major changes
  useEffect(() => {
    const majorId = studentProfile?.majorId;
    if (!majorId || majorId === 'UNDECLARED') {
      setCourseLabels({});
      setMajorName('Undeclared');
      return;
    }
    fetchCourseLabels(majorId).then(setCourseLabels).catch(() => setCourseLabels({}));
    fetchMajors()
      .then((majors) => {
        const match = majors.find((m) => m.code === majorId);
        setMajorName(match?.name ?? majorId);
      })
      .catch(() => setMajorName(majorId));
  }, [studentProfile?.majorId]);

  // Prefetch sections and calculate conflicts when semesters change
  useEffect(() => {
    const prefetchAndCalculateConflicts = async () => {
      if (!isOnboarded || semesters.length === 0) return;

      // Prefetch sections for all semesters
      await Promise.all(
        semesters.map((semester) => {
          if (!isSemesterCached(semester.id)) {
            return fetchSectionsForSemester(semester);
          }
          return Promise.resolve();
        })
      );

      // Calculate conflicts for each semester
      const conflicts: Record<string, Record<string, string[]>> = {};

      semesters.forEach((semester) => {
        const semesterConflicts: Record<string, string[]> = {};

        // Check each course against all other courses in the same semester
        semester.courses.forEach((course) => {
          const conflictingCourses: string[] = [];

          const courseSection = getSectionForCourse(
            course.code,
            course.selectedSectionId,
            semester.id
          );

          if (!courseSection || isTBAOrOnline(courseSection)) {
            return;
          }

          const courseMeeting = courseSection.meeting_times?.[0];
          if (!courseMeeting) return;

          // Compare with other courses
          semester.courses.forEach((otherCourse) => {
            if (course.id === otherCourse.id) return;

            const otherSection = getSectionForCourse(
              otherCourse.code,
              otherCourse.selectedSectionId,
              semester.id
            );

            if (!otherSection || isTBAOrOnline(otherSection)) {
              return;
            }

            const otherMeeting = otherSection.meeting_times?.[0];
            if (!otherMeeting) return;

            if (doMeetingTimesConflict(courseMeeting, otherMeeting)) {
              conflictingCourses.push(otherCourse.code);
            }
          });

          if (conflictingCourses.length > 0) {
            semesterConflicts[course.id] = conflictingCourses;
          }
        });

        if (Object.keys(semesterConflicts).length > 0) {
          conflicts[semester.id] = semesterConflicts;
        }
      });

      setSemesterConflicts(conflicts);
    };

    prefetchAndCalculateConflicts();
  }, [semesters, isOnboarded, fetchSectionsForSemester, getSectionForCourse, isSemesterCached]);

  useEffect(() => {
    if (!isOnboarded) {
      navigate("/onboard");
    }
  }, [isOnboarded, navigate]);

  if (!isOnboarded) {
    return null;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeCourse = activeId
    ? semesters.flatMap((semester) => semester.courses).find((course) => course.id === activeId)
    : null;

  const saveUndoState = useCallback(
    (description: string) => {
      setUndoStack((prev) => [
        ...prev.slice(-9),
        { semesters: JSON.parse(JSON.stringify(semesters)), description },
      ]);
    },
    [semesters]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    replaceSemesters(lastState.semesters);
    setUndoStack((prev) => prev.slice(0, -1));
    toast({
      title: "Undone",
      description: lastState.description,
    });
  }, [undoStack, replaceSemesters]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    const sourceSemester = semesters.find((semester) =>
      semester.courses.some((course) => course.id === draggedId)
    );
    const targetSemester = semesters.find((semester) => semester.id === overId);

    if (sourceSemester && targetSemester && sourceSemester.id !== targetSemester.id) {
      const course = sourceSemester.courses.find((item) => item.id === draggedId);
      if (!course) return;

      const validation = validateDrop(course, targetSemester, semesters);

      if (!validation.canDrop) {
        const errorViolation = validation.violations.find((v) => v.type === "error");
        toast({
          title: "Cannot move course",
          description: errorViolation?.message || "This move is not allowed",
          variant: "destructive",
        });
        return;
      }

      const warnings = validation.violations.filter((v) => v.type === "warning");
      if (warnings.length > 0) {
        toast({
          title: "Warning",
          description: warnings[0].message,
        });
      }

      saveUndoState(`Moved ${course.code} from ${sourceSemester.label} to ${targetSemester.label}`);
      moveCourse(draggedId, sourceSemester.id, targetSemester.id);
    }
  };

  const handleCourseClick = (course: PlannedCourse) => {
    setSelectedCourse(course);
  };

  const handleRemoveCourse = (courseId: string, semesterId: string) => {
    const semester = semesters.find((item) => item.id === semesterId);
    const course = semester?.courses.find((item) => item.id === courseId);
    if (course) {
      saveUndoState(`Removed ${course.code} from ${semester?.label}`);
    }
    removeCourse(courseId, semesterId);
  };

  const handleMarkCompleted = (courseId: string, grade: string) => {
    markCourseCompleted(courseId, grade);
    setSelectedCourse(null);
    toast({
      title: "Course marked as completed",
      description: `Grade: ${grade}`,
    });
  };

  const handleExportICS = () => {
    exportToICS(semesters);
    toast({
      title: "Calendar exported",
      description: "Your .ics file has been downloaded",
    });
  };

  const handleScrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  };

  const progressPercent = totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current - 5; year <= current + 5; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const semesterOrder = { spring: 1, summer: 2, fall: 3, winter: 4 } as const;

  const handleCreateSemester = () => {
    // Prevent adding the same semester twice
    const isDuplicate = semesters.some(
      (s) => s.type === newSemesterTerm && s.year === newSemesterYear
    );
    if (isDuplicate) {
      toast({
        title: "Semester already exists",
        description: `${newSemesterTerm.charAt(0).toUpperCase() + newSemesterTerm.slice(1)} ${newSemesterYear} is already in your plan.`,
        variant: "destructive",
      });
      return;
    }

    const startYear = studentProfile?.admittedYear;
    const startTerm = studentProfile?.startTerm;
    const gradYear = studentProfile?.graduationYear;
    const gradTerm = studentProfile?.graduationTerm;

    if (startYear && startTerm) {
      const beforeStart =
        newSemesterYear < startYear ||
        (newSemesterYear === startYear &&
          semesterOrder[newSemesterTerm] < semesterOrder[startTerm]);
      if (beforeStart) {
        toast({
          title: "Update start date",
          description: "This semester is before your start term.",
          variant: "destructive",
        });
        return;
      }
    }

    if (gradYear && gradTerm) {
      const afterGrad =
        newSemesterYear > gradYear ||
        (newSemesterYear === gradYear &&
          semesterOrder[newSemesterTerm] > semesterOrder[gradTerm]);
      if (afterGrad) {
        toast({
          title: "Update graduation date",
          description: "This semester is after your expected graduation.",
          variant: "destructive",
        });
        return;
      }
    }

    const semester = createSemester(newSemesterTerm, newSemesterYear);
    addSemester(semester);
    setShowSemesterDialog(false);
  };

  const displayName = studentProfile?.name || "Student";
  const majorLabel = majorName ?? (studentProfile?.majorId ?? "Undeclared");

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Hello, {displayName}!</h1>
                <p className="text-muted-foreground">Build your plan one semester at a time.</p>
              </div>
              <div className="flex items-center gap-3">
                <AutosaveIndicator status={autosaveStatus} />
                <Button variant="outline" size="sm" className="gap-2" onClick={handleUndo} disabled={undoStack.length === 0}>
                  <Undo2 className="w-4 h-4" />
                  Undo
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportICS}>
                  <Download className="w-4 h-4" />
                  Export .ics
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSemesterDialog(true)}>
                  <Plus className="w-4 h-4" />
                  Add Semester
                </Button>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Major</p>
                  <p className="text-sm font-semibold text-foreground">{majorLabel}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/courses">Browse courses</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar px-6 pb-6" ref={scrollContainerRef}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 min-w-max pb-4">
                {semesters.map((semester) => (
                  <motion.div
                    key={semester.id}
                    className="w-72 shrink-0"
                    style={{ scrollSnapAlign: "start" }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <SemesterCard
                      semester={semester}
                      onCourseClick={handleCourseClick}
                      onRemoveCourse={(courseId) => handleRemoveCourse(courseId, semester.id)}
                      onMarkCourseCompleted={(courseId) => {
                        // Open the detail modal so the user can select a grade
                        const course = semester.courses.find((c) => c.id === courseId);
                        if (course) setSelectedCourse(course);
                      }}
                      courseConflicts={semesterConflicts[semester.id] || {}}
                      courseLabels={courseLabels}
                    />
                  </motion.div>
                ))}
              </div>

              <DragOverlay>
                {activeCourse && (
                  <motion.div
                    initial={{ scale: 1, boxShadow: "none" }}
                    animate={{
                      scale: 1.05,
                      boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
                      rotate: 2,
                    }}
                    className="opacity-95"
                  >
                    <CourseCard course={activeCourse} isDragging />
                  </motion.div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        <aside className="w-72 border-l border-border bg-card p-4 overflow-y-auto custom-scrollbar hidden xl:block">
          <h3 className="font-semibold text-foreground mb-4">Plan Summary</h3>

          <Card className="mb-4 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                Total Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl font-bold text-foreground">{totalCredits}</span>
                <span className="text-muted-foreground">credits</span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-1" />
              <p className="text-xs text-muted-foreground">{progressPercent}% complete</p>
            </CardContent>
          </Card>

          <Card className="mb-4 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                Current GPA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-foreground">{currentGPA.toFixed(3)}</span>
              <span className="text-muted-foreground ml-1">/ 4.000</span>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                Total Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-foreground">{totalCourses}</span>
              <span className="text-muted-foreground ml-1">courses</span>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AnimatePresence>
        {selectedCourse && (
          <CourseDetailModal
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            onMarkCompleted={(grade) => handleMarkCompleted(selectedCourse.id, grade)}
          />
        )}
      </AnimatePresence>

      <Dialog open={showSemesterDialog} onOpenChange={setShowSemesterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create semester</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newSemesterTerm} onValueChange={(value) => setNewSemesterTerm(value as SemesterType)}>
              <SelectTrigger>
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fall">Fall</SelectItem>
                <SelectItem value="spring">Spring</SelectItem>
                <SelectItem value="summer">Summer</SelectItem>
                <SelectItem value="winter">Winter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newSemesterYear.toString()} onValueChange={(value) => setNewSemesterYear(parseInt(value, 10))}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreateSemester} className="w-full">
              Add semester
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Wrapper component that provides SectionContext
export function Planner() {
  return (
    <SectionProvider>
      <PlannerContent />
    </SectionProvider>
  );
}
