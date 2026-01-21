import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { 
  GripVertical, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal,
  BookOpen,
  Trash2,
  Edit2,
  XCircle
} from 'lucide-react';
import { PlannedCourse } from '@/types/planner';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CourseCardProps {
  course: PlannedCourse;
  onOpenDetail?: () => void;
  onRemove?: () => void;
  onMarkCompleted?: () => void;
  isDragging?: boolean;
}

export function CourseCard({ 
  course, 
  onOpenDetail, 
  onRemove,
  onMarkCompleted,
  isDragging 
}: CourseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = {
    planned: {
      icon: Clock,
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    failed: {
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    in_progress: {
      icon: BookOpen,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
  };

  const status = statusConfig[course.status];
  const StatusIcon = status.icon;

  const isCore = course.type === 'core';
  const isElective = course.type === 'elective';
  const isFallOnly = course.offeredTerms.length === 1 && course.offeredTerms[0] === 'fall';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group relative bg-card border rounded-lg p-3 cursor-pointer transition-all',
        isDragging && 'opacity-50 shadow-lg scale-105 z-50',
        isCore && 'border-primary/20 hover:border-primary/40',
        isElective && 'border-accent/20 hover:border-accent/40',
        !isCore && !isElective && 'border-border hover:border-border/80',
        course.status === 'completed' && 'bg-success/5 border-success/30',
        course.status === 'failed' && 'bg-destructive/5 border-destructive/30'
      )}
      onClick={onOpenDetail}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-foreground">
                {course.code}
              </span>
              {course.grade && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-success/20 text-success border-0">
                  {course.grade}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {course.title}
            </p>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger 
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenDetail?.(); }}>
                <BookOpen className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {course.status !== 'completed' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkCompleted?.(); }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Completed
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={cn('w-3.5 h-3.5', status.color)} />
            <span className="text-xs text-muted-foreground">{course.credits} cr</span>
          </div>

          <div className="flex items-center gap-1">
            {isFallOnly && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning">
                Fall Only
              </Badge>
            )}
            {course.prerequisites && course.prerequisites.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Prereq
              </Badge>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
