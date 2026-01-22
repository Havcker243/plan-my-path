import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, BookOpen, Hash } from 'lucide-react';
import { Semester, PlannedCourse } from '@/types/planner';
import { CourseCard } from './CourseCard';
import { cn } from '@/lib/utils';

interface SemesterCardProps {
  semester: Semester;
  onCourseClick?: (course: PlannedCourse) => void;
  onRemoveCourse?: (courseId: string) => void;
  onMarkCourseCompleted?: (courseId: string) => void;
  onAddCourse?: () => void;
}

export function SemesterCard({
  semester,
  onCourseClick,
  onRemoveCourse,
  onMarkCourseCompleted,
  onAddCourse,
}: SemesterCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: semester.id,
  });

  const totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0);
  const courseCount = semester.courses.length;
  const isOverLimit = totalCredits > semester.maxCredits;

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
          <div className={cn(
            'text-sm font-medium',
            isOverLimit ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {totalCredits}/{semester.maxCredits} cr
          </div>
        </div>
        {isOverLimit && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Exceeds credit limit</span>
          </div>
        )}
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

        {/* Add course button */}
        <button
          onClick={onAddCourse}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors"
          aria-label={`Add course to ${semester.label}`}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add course</span>
        </button>
      </div>
    </motion.div>
  );
}
