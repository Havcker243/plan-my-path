import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { 
  Filter, 
  Download, 
  Printer,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Plus,
  Undo2,
  Grid3X3
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SemesterCard } from '@/components/planner/SemesterCard';
import { CourseCard } from '@/components/planner/CourseCard';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { CalendarView } from '@/components/planner/CalendarView';
import { AutosaveIndicator } from '@/components/planner/AutosaveIndicator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlanner } from '@/contexts/PlannerContext';
import { usePlannerValidation } from '@/hooks/usePlannerValidation';
import { useAutosave } from '@/hooks/useAutosave';
import { PlannedCourse, Semester } from '@/types/planner';
import { csCourses } from '@/data/sampleData';
import { exportToICS } from '@/utils/icsExport';
import { toast } from '@/hooks/use-toast';

interface UndoState {
  semesters: Semester[];
  description: string;
}

export function Planner() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { 
    semesters, 
    isOnboarded, 
    moveCourse, 
    removeCourse, 
    addCourse,
    markCourseCompleted,
    selectedCourse,
    setSelectedCourse,
    totalCredits,
    earnedCredits,
    currentGPA,
    studentProfile,
  } = usePlanner();

  const { validateDrop } = usePlannerValidation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCourseLibrary, setShowCourseLibrary] = useState(true);
  const [activeView, setActiveView] = useState<'grid' | 'calendar'>('grid');
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  
  // Autosave
  const { status: autosaveStatus } = useAutosave({
    data: semesters,
    onSave: async (data) => {
      // Simulate API save - in real app, this would POST to backend
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Plan saved:', data);
    },
    enabled: isOnboarded,
  });

  // Redirect to onboarding if not onboarded
  useEffect(() => {
    if (!isOnboarded) {
      navigate('/onboard');
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
    ? semesters.flatMap(s => s.courses).find(c => c.id === activeId)
    : null;

  const saveUndoState = useCallback((description: string) => {
    setUndoStack(prev => [...prev.slice(-9), { semesters: JSON.parse(JSON.stringify(semesters)), description }]);
  }, [semesters]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    toast({
      title: "Undone",
      description: lastState.description,
    });
    // Would need to implement setState in context - for now just show toast
  }, [undoStack]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Find source semester
    const sourceSemester = semesters.find(s => 
      s.courses.some(c => c.id === draggedId)
    );

    // Check if dropped on a semester
    const targetSemester = semesters.find(s => s.id === overId);

    if (sourceSemester && targetSemester && sourceSemester.id !== targetSemester.id) {
      const course = sourceSemester.courses.find(c => c.id === draggedId);
      if (!course) return;

      // Validate the drop
      const validation = validateDrop(course, targetSemester, semesters);

      if (!validation.canDrop) {
        // Hard error - reject the drop
        const errorViolation = validation.violations.find(v => v.type === 'error');
        toast({
          title: "Cannot move course",
          description: errorViolation?.message || "This move is not allowed",
          variant: "destructive",
        });
        return;
      }

      // Check for soft warnings
      const warnings = validation.violations.filter(v => v.type === 'warning');
      if (warnings.length > 0) {
        toast({
          title: "Warning",
          description: warnings[0].message,
          action: warnings[0].suggestion ? (
            <Button variant="outline" size="sm" onClick={() => {}}>
              Auto-fix
            </Button>
          ) : undefined,
        });
      }

      // Save undo state
      saveUndoState(`Moved ${course.code} from ${sourceSemester.label} to ${targetSemester.label}`);
      
      // Perform the move
      moveCourse(draggedId, sourceSemester.id, targetSemester.id);
    }
  };

  const handleCourseClick = (course: PlannedCourse) => {
    setSelectedCourse(course);
  };

  const handleRemoveCourse = (courseId: string, semesterId: string) => {
    const semester = semesters.find(s => s.id === semesterId);
    const course = semester?.courses.find(c => c.id === courseId);
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
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const progressPercent = totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;

  // Display name greeting
  const displayName = studentProfile?.name || 'Student';

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Course Library Sidebar */}
        <AnimatePresence>
          {showCourseLibrary && activeView === 'grid' && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-border bg-card overflow-hidden shrink-0"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Course Library</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">Core</Badge>
                  <Badge variant="outline" className="text-xs">Elective</Badge>
                </div>
              </div>
              <div className="p-3 overflow-y-auto h-[calc(100%-80px)] custom-scrollbar space-y-2">
                {csCourses.slice(0, 10).map((course) => (
                  <motion.div
                    key={course.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border hover:border-accent/50 cursor-pointer transition-all"
                    onClick={() => handleCourseClick({
                      ...course,
                      status: 'planned',
                      semesterId: '',
                    })}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm text-foreground">{course.code}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{course.title}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {course.credits} cr
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Planner Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 pb-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Hello, {displayName}!
                </h1>
                <p className="text-muted-foreground">Manage your 4-year academic plan</p>
              </div>
              <div className="flex items-center gap-3">
                <AutosaveIndicator status={autosaveStatus} />
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="w-4 h-4" />
                  Undo
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportICS}>
                  <Download className="w-4 h-4" />
                  Export .ics
                </Button>
              </div>
            </div>

            {/* View Tabs */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'grid' | 'calendar')}>
              <TabsList className="mb-4">
                <TabsTrigger value="grid" className="gap-2">
                  <Grid3X3 className="w-4 h-4" />
                  Planner Grid
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Calendar View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="mt-0">
                {/* Horizontal scroll controls */}
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="icon" onClick={handleScrollLeft}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {semesters.length} semesters
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleScrollRight}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <CalendarView semesters={semesters} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Grid Content */}
          {activeView === 'grid' && (
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar px-6 pb-6"
              style={{ scrollSnapType: 'x mandatory' }}
            >
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
                      style={{ scrollSnapAlign: 'start' }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <SemesterCard
                        semester={semester}
                        onCourseClick={handleCourseClick}
                        onRemoveCourse={(courseId) => handleRemoveCourse(courseId, semester.id)}
                        onMarkCourseCompleted={(courseId) => markCourseCompleted(courseId, 'A')}
                      />
                    </motion.div>
                  ))}
                  
                  {/* Add semester button */}
                  <div className="w-72 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                    <Button
                      variant="outline"
                      className="w-full h-32 border-dashed border-2 flex flex-col gap-2 hover:bg-muted/50"
                    >
                      <Plus className="w-6 h-6" />
                      <span>Add Semester</span>
                    </Button>
                  </div>
                </div>

                <DragOverlay>
                  {activeCourse && (
                    <motion.div
                      initial={{ scale: 1, boxShadow: 'none' }}
                      animate={{ 
                        scale: 1.05, 
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)',
                        rotate: 2
                      }}
                      className="opacity-95"
                    >
                      <CourseCard course={activeCourse} isDragging />
                    </motion.div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>

        {/* Right Sidebar - Plan Summary */}
        <aside className="w-72 border-l border-border bg-card p-4 overflow-y-auto custom-scrollbar hidden xl:block">
          <h3 className="font-semibold text-foreground mb-4">Plan Summary</h3>

          {/* Progress Card */}
          <Card className="mb-4 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                Credit Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl font-bold text-foreground">{earnedCredits}</span>
                <span className="text-muted-foreground">/ {totalCredits}</span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-1" />
              <p className="text-xs text-muted-foreground">{progressPercent}% complete</p>
            </CardContent>
          </Card>

          {/* GPA Card */}
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

          {/* Warnings */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                CS-301 is offered Fall only - plan accordingly!
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <CourseDetailModal
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            onMarkCompleted={(grade) => handleMarkCompleted(selectedCourse.id, grade)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
