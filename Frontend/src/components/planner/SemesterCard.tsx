import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { BookOpen, Hash, AlertTriangle, Trash2 } from 'lucide-react';
import { Semester, PlannedCourse } from '@/types/planner';
import { CourseCard } from './CourseCard';
import { cn } from '@/lib/utils';
import type { CourseLabelsResponse } from '@/lib/api';

interface SemesterCardProps {
  semester: Semester;
  onCourseClick?: (course: PlannedCourse) => void;
  onRemoveCourse?: (courseId: string) => void;
  onMarkCourseCompleted?: (courseId: string) => void;
  onDeleteSemester?: () => void;
  courseConflicts?: Record<string, string[]>; // Map of courseId -> array of conflicting course codes
  courseLabels?: CourseLabelsResponse; // Requirement labels keyed by course code
}

export function SemesterCard({
  semester,
  onCourseClick,
  onRemoveCourse,
  onMarkCourseCompleted,
  onDeleteSemester,
  courseConflicts = {},
  courseLabels = {},
}: SemesterCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: semester.id,
  });

  const totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0);
  const courseCount = semester.courses.length;

  // Count courses with time conflicts
  const conflictCount = Object.keys(courseConflicts).filter(
    (courseId) => courseConflicts[courseId].length > 0
  ).length;

  const semesterTypeStyles = {
    fall: 'semester-fall',
    spring: 'semester-spring',
    summer: 'semester-summer',
    winter: 'semester-winter',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-card rounded-xl border border-border flex flex-col h-full',
        semesterTypeStyles[semester.type],
        isOver && 'ring-2 ring-accent ring-offset-2 ring-offset-background'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-foreground">{semester.label}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{totalCredits} cr</span>
            {onDeleteSemester && (
              <button
                onClick={() => {
                  const msg = semester.courses.length > 0
                    ? `Delete ${semester.label}? This will also remove its ${semester.courses.length} course(s).`
                    : `Delete ${semester.label}?`;
                  if (confirm(msg)) onDeleteSemester();
                }}
                className="text-muted-foreground/40 hover:text-destructive transition-colors"
                title="Delete semester"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Course list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-3 space-y-2 min-h-[120px] transition-colors',
          isOver && 'bg-accent/5',
          semester.courses.length === 0 && 'flex items-center justify-center'
        )}
        role="region"
        aria-label={`${semester.label} drop zone`}
      >
        <SortableContext
          items={semester.courses.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {semester.courses.length > 0 ? (
            semester.courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onOpenDetail={() => onCourseClick?.(course)}
                onRemove={() => onRemoveCourse?.(course.id)}
                onMarkCompleted={() => onMarkCourseCompleted?.(course.id)}
                conflicts={courseConflicts[course.id] || []}
                requirementLabel={courseLabels[course.code] ?? null}
              />
            ))
          ) : (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">No courses</p>
              <p className="text-xs mt-1">Drag courses here</p>
            </div>
          )}
        </SortableContext>
      </div>

      {/* Footer with totals */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Semester totals */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            <span>Courses: {courseCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Credits: {totalCredits}</span>
          </div>
        </div>

        {/* Time conflict warning */}
        {conflictCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-2 py-1 rounded-md">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {conflictCount} {conflictCount === 1 ? 'course has' : 'courses have'} time conflicts
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
