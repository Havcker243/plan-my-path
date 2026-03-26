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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CourseLabel } from '@/lib/api';

interface SectionInfo {
  sectionCode: string;
  instructors: string[];
  meetingTimes: Array<{
    days: string;
    start_time: string;
    end_time: string;
    building?: string | null;
    room?: string | null;
  }>;
}

interface CourseCardProps {
  course: PlannedCourse;
  onOpenDetail?: () => void;
  onRemove?: () => void;
  onMarkCompleted?: () => void;
  isDragging?: boolean;
  conflicts?: string[]; // Array of conflicting course codes
  requirementLabel?: CourseLabel | null; // Requirement label (Required, Group Choice, etc.)
  sectionInfo?: SectionInfo | null;
}

export function CourseCard({
  course,
  onOpenDetail,
  onRemove,
  onMarkCompleted,
  isDragging,
  conflicts = [],
  requirementLabel = null,
  sectionInfo = null,
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
            {sectionInfo && (
              <div className="mt-1.5 rounded-md bg-muted/60 border border-border/60 px-2 py-1.5 text-[11px] space-y-0.5">
                <p className="font-medium text-foreground/80">
                  §{sectionInfo.sectionCode}
                  {sectionInfo.instructors.length > 0 && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      — {sectionInfo.instructors[0]}
                    </span>
                  )}
                </p>
                {sectionInfo.meetingTimes.map((mt, i) => {
                  const time = mt.start_time && mt.end_time
                    ? `${mt.start_time}–${mt.end_time}`
                    : 'Time TBA';
                  const place = [mt.building, mt.room].filter(Boolean).join(' ');
                  return (
                    <p key={i} className="text-muted-foreground">
                      {[mt.days || 'Days TBA', time, place].filter(Boolean).join(' · ')}
                    </p>
                  );
                })}
              </div>
            )}
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

          <div className="flex items-center gap-1 flex-wrap">
            {requirementLabel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        requirementLabel.label === 'Required' && "border-red-500/50 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20",
                        requirementLabel.label === 'Group Choice' && "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
                        requirementLabel.label === 'Major Elective' && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20",
                        requirementLabel.label === 'General Elective' && "border-gray-500/50 text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {requirementLabel.label === 'Required' && '🔴'}
                      {requirementLabel.label === 'Group Choice' && '🟡'}
                      {requirementLabel.label === 'Major Elective' && '🟢'}
                      {requirementLabel.label === 'General Elective' && '⚪'}
                      <span className="ml-0.5">{requirementLabel.label}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{requirementLabel.detail}</p>
                    <p className="text-xs text-muted-foreground">{requirementLabel.group_name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {conflicts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                      Conflict
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Time conflicts with:</p>
                    <p className="text-xs font-medium">{conflicts.join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
