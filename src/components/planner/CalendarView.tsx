import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Semester, PlannedCourse } from '@/types/planner';
import { sampleSections } from '@/data/sampleData';
import { exportToICS } from '@/utils/icsExport';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  semesters: Semester[];
}

const semesterColors: Record<string, string> = {
  fall: 'bg-semester-fall/20 border-semester-fall text-semester-fall',
  spring: 'bg-semester-spring/20 border-semester-spring text-semester-spring',
  summer: 'bg-semester-summer/20 border-semester-summer text-semester-summer',
  winter: 'bg-semester-winter/20 border-semester-winter text-semester-winter',
};

export function CalendarView({ semesters }: CalendarViewProps) {
  const [currentSemesterIndex, setCurrentSemesterIndex] = useState(0);
  const [enabledCourses, setEnabledCourses] = useState<Set<string>>(
    new Set(semesters.flatMap(s => s.courses.map(c => c.id)))
  );

  const currentSemester = semesters[currentSemesterIndex];
  
  const toggleCourse = (courseId: string) => {
    setEnabledCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleExportICS = () => {
    exportToICS(semesters, sampleSections, Array.from(enabledCourses));
  };

  // Group courses by day of week for weekly view
  const weeklySchedule = useMemo(() => {
    const days: Record<string, { course: PlannedCourse; time: string; professor?: string }[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    if (!currentSemester) return days;

    currentSemester.courses.forEach(course => {
      if (!enabledCourses.has(course.id)) return;

      const section = sampleSections.find(s => s.courseId === course.id);
      if (!section) {
        // Add to all days as a placeholder
        Object.keys(days).forEach(day => {
          days[day].push({ course, time: 'TBD', professor: undefined });
        });
        return;
      }

      // Parse meeting times (e.g., "MWF 9:00-9:50 AM")
      const dayMap: Record<string, string> = {
        M: 'Monday',
        T: 'Tuesday',
        W: 'Wednesday',
        R: 'Thursday',
        F: 'Friday',
      };

      const match = section.meetingTimes.match(/^([MTWRF]+)/);
      if (match) {
        match[1].split('').forEach(d => {
          const dayName = dayMap[d];
          if (dayName) {
            days[dayName].push({
              course,
              time: section.meetingTimes.replace(/^[MTWRF]+\s*/, ''),
              professor: section.professor,
            });
          }
        });
      }
    });

    // Sort each day by time
    Object.keys(days).forEach(day => {
      days[day].sort((a, b) => a.time.localeCompare(b.time));
    });

    return days;
  }, [currentSemester, enabledCourses]);

  if (!currentSemester) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No semesters available
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentSemesterIndex(Math.max(0, currentSemesterIndex - 1))}
            disabled={currentSemesterIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">{currentSemester.label}</h2>
            <p className="text-sm text-muted-foreground">
              {currentSemester.courses.length} courses • {currentSemester.courses.reduce((sum, c) => sum + c.credits, 0)} credits
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentSemesterIndex(Math.min(semesters.length - 1, currentSemesterIndex + 1))}
            disabled={currentSemesterIndex === semesters.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <Button onClick={handleExportICS} className="gap-2">
          <Download className="w-4 h-4" />
          Export to Calendar (.ics)
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Weekly Calendar Grid */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-accent" />
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(weeklySchedule).map(([day, courses]) => (
                <div key={day} className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground text-center pb-2 border-b border-border">
                    {day}
                  </h4>
                  <div className="space-y-2 min-h-[200px]">
                    {courses.length > 0 ? (
                      courses.map((item, idx) => (
                        <motion.div
                          key={`${item.course.id}-${idx}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={cn(
                            'p-2 rounded-lg border text-xs',
                            semesterColors[currentSemester.type]
                          )}
                        >
                          <p className="font-medium truncate">{item.course.code}</p>
                          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{item.time}</span>
                          </div>
                          {item.professor && (
                            <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span className="truncate">{item.professor.split(' ').pop()}</span>
                            </div>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No classes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course Toggle List */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Courses</CardTitle>
            <p className="text-xs text-muted-foreground">Toggle courses to include in export</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentSemester.courses.map(course => (
              <div
                key={course.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{course.code}</p>
                  <p className="text-xs text-muted-foreground truncate">{course.title}</p>
                </div>
                <Switch
                  checked={enabledCourses.has(course.id)}
                  onCheckedChange={() => toggleCourse(course.id)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Semester Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {semesters.map((semester, index) => (
          <motion.button
            key={semester.id}
            onClick={() => setCurrentSemesterIndex(index)}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              index === currentSemesterIndex
                ? 'border-accent bg-accent/10 ring-2 ring-accent ring-offset-2 ring-offset-background'
                : 'border-border hover:border-accent/50'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <p className="text-sm font-medium text-foreground">{semester.label}</p>
            <p className="text-xs text-muted-foreground">
              {semester.courses.length} courses
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
