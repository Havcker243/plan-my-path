import { useState, useCallback, useEffect } from 'react';
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
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { 
  Filter, 
  Download, 
  Printer,
  ChevronRight,
  BookOpen,
  GraduationCap,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SemesterCard } from '@/components/planner/SemesterCard';
import { CourseCard } from '@/components/planner/CourseCard';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlanner } from '@/contexts/PlannerContext';
import { PlannedCourse } from '@/types/planner';
import { csCourses } from '@/data/sampleData';

export function Planner() {
  const navigate = useNavigate();
  const { 
    semesters, 
    isOnboarded, 
    moveCourse, 
    removeCourse, 
    markCourseCompleted,
    selectedCourse,
    setSelectedCourse,
    totalCredits,
    earnedCredits,
    currentGPA,
  } = usePlanner();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCourseLibrary, setShowCourseLibrary] = useState(true);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source semester
    const sourceSemester = semesters.find(s => 
      s.courses.some(c => c.id === activeId)
    );

    // Check if dropped on a semester
    const targetSemester = semesters.find(s => s.id === overId);

    if (sourceSemester && targetSemester && sourceSemester.id !== targetSemester.id) {
      moveCourse(activeId, sourceSemester.id, targetSemester.id);
    }
  };

  const handleCourseClick = (course: PlannedCourse) => {
    setSelectedCourse(course);
  };

  const handleRemoveCourse = (courseId: string, semesterId: string) => {
    removeCourse(courseId, semesterId);
  };

  const handleMarkCompleted = (courseId: string, grade: string) => {
    markCourseCompleted(courseId, grade);
    setSelectedCourse(null);
  };

  const progressPercent = totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;

  // Group semesters by year
  const semestersByYear = semesters.reduce((acc, semester) => {
    const yearKey = `Year ${Math.ceil((semesters.indexOf(semester) + 1) / 2)}`;
    if (!acc[yearKey]) {
      acc[yearKey] = [];
    }
    acc[yearKey].push(semester);
    return acc;
  }, {} as Record<string, typeof semesters>);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Course Library Sidebar */}
        <AnimatePresence>
          {showCourseLibrary && (
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
                  <div
                    key={course.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border hover:border-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleCourseClick({
                      ...course,
                      status: 'planned',
                      semesterId: '',
                    })}
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
                  </div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Planner Area */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">4-Year Plan</h1>
                <p className="text-muted-foreground">Drag and drop courses between semesters</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Semester Grid */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-8">
                {Object.entries(semestersByYear).map(([year, yearSemesters]) => (
                  <div key={year}>
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-accent" />
                      {year}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {yearSemesters.map((semester) => (
                        <SemesterCard
                          key={semester.id}
                          semester={semester}
                          onCourseClick={handleCourseClick}
                          onRemoveCourse={(courseId) => handleRemoveCourse(courseId, semester.id)}
                          onMarkCourseCompleted={(courseId) => markCourseCompleted(courseId, 'A')}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <DragOverlay>
                {activeCourse && (
                  <div className="opacity-90">
                    <CourseCard course={activeCourse} isDragging />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
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
              <span className="text-2xl font-bold text-foreground">{currentGPA.toFixed(2)}</span>
              <span className="text-muted-foreground ml-1">/ 4.00</span>
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
