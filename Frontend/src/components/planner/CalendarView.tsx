import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar as CalendarIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Semester } from '@/types/planner';
import { fetchSectionsForTerm } from '@/lib/api';
import { exportToICS } from '@/utils/icsExport';

interface CalendarViewProps {
  semesters: Semester[];
}

const semesterColors: Record<string, string> = {
  fall: '#B45309',
  spring: '#15803D',
  summer: '#2563EB',
  winter: '#7C3AED',
};

const dayMap: Record<string, number> = {
  M: 1,
  T: 2,
  W: 3,
  R: 4,
  F: 5,
  S: 6,
  U: 0,
};

const parseMeetingDays = (days: string) => {
  const normalized = days.replace(/Th/gi, 'R');
  const tokens = normalized.split('/').join('');
  return tokens
    .split('')
    .map((token) => dayMap[token])
    .filter((value) => value !== undefined);
};

const toDateOnly = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
};

export function CalendarView({ semesters }: CalendarViewProps) {
  const [currentSemesterIndex, setCurrentSemesterIndex] = useState(0);
  const [enabledCourses, setEnabledCourses] = useState<Set<string>>(
    new Set(semesters.flatMap((semester) => semester.courses.map((course) => course.id)))
  );
  const [sectionsByCourse, setSectionsByCourse] = useState<Record<string, any[]>>({});

  const currentSemester = semesters[currentSemesterIndex];

  useEffect(() => {
    if (!currentSemester) return;
    const courseCodes = currentSemester.courses.map((course) => course.code);
    fetchSectionsForTerm(courseCodes, currentSemester.type)
      .then((data) => setSectionsByCourse(data))
      .catch(() => setSectionsByCourse({}));
  }, [currentSemester]);

  const handleExportICS = () => {
    const sectionsForExport = [];
    for (const course of currentSemester?.courses || []) {
      const sections = sectionsByCourse[course.code] || [];
      const section = course.selectedSectionId
        ? sections.find((item) => item.id === course.selectedSectionId)
        : sections[0];
      if (!section) continue;
      const meeting = section.meeting_times?.[0];
      const instructor = section.instructors?.[0]?.name;
      if (!meeting || !meeting.days || !meeting.start_time || !meeting.end_time) continue;
      sectionsForExport.push({
        id: `${course.id}-${section.section_code}`,
        courseId: course.id,
        sectionNumber: section.section_code,
        professor: instructor ?? 'TBA',
        seatsTotal: section.seats?.capacity ?? 0,
        seatsOpen: section.seats?.available ?? 0,
        meetingTimes: `${meeting.days} ${meeting.start_time}-${meeting.end_time}`,
      });
    }
    exportToICS(semesters, sectionsForExport, Array.from(enabledCourses));
  };

  const calendarEvents = useMemo(() => {
    if (!currentSemester) return [];
    const events = [];
    for (const course of currentSemester.courses) {
      if (!enabledCourses.has(course.id)) continue;
      const sections = sectionsByCourse[course.code] || [];
      const section = course.selectedSectionId
        ? sections.find((item) => item.id === course.selectedSectionId)
        : sections[0];
      if (!section) continue;
      const meeting = section.meeting_times?.[0];
      if (!meeting || !meeting.days) continue;
      const daysOfWeek = parseMeetingDays(meeting.days);
      if (!daysOfWeek.length) continue;
      const startRecur = toDateOnly(meeting.start_date ?? currentSemester.startDate);
      const endRecur = toDateOnly(meeting.end_date ?? currentSemester.endDate);
      const title = `${course.code} ${course.title ?? ''}`.trim();
      events.push({
        id: `${course.id}-${section.section_code}`,
        title,
        daysOfWeek,
        startTime: meeting.start_time ?? '09:00',
        endTime: meeting.end_time ?? '10:00',
        startRecur,
        endRecur,
        backgroundColor: semesterColors[currentSemester.type] ?? '#2563EB',
        borderColor: semesterColors[currentSemester.type] ?? '#2563EB',
        extendedProps: {
          location: meeting.location ?? meeting.building ?? 'TBA',
          instructor: section.instructors?.[0]?.name ?? 'TBA',
        },
      });
    }
    return events;
  }, [currentSemester, enabledCourses, sectionsByCourse]);

  if (!currentSemester) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No semesters available
      </div>
    );
  }

  const toggleCourse = (courseId: string) => {
    setEnabledCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
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
              {currentSemester.courses.length} courses •{' '}
              {currentSemester.courses.reduce((sum, course) => sum + course.credits, 0)} credits
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setCurrentSemesterIndex(Math.min(semesters.length - 1, currentSemesterIndex + 1))
            }
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
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-accent" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              height="auto"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,dayGridMonth',
              }}
              events={calendarEvents}
              nowIndicator
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
            />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Courses</CardTitle>
            <p className="text-xs text-muted-foreground">Toggle courses to include in calendar</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentSemester.courses.map((course) => {
              const sections = sectionsByCourse[course.code] || [];
              const section = course.selectedSectionId
                ? sections.find((item) => item.id === course.selectedSectionId)
                : sections[0];
              return (
              <div
                key={course.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{course.code}</p>
                  <p className="text-xs text-muted-foreground truncate">{course.title}</p>
                  {!section && (
                    <p className="text-[11px] text-destructive mt-1">No sections yet for this term</p>
                  )}
                </div>
                <Switch
                  checked={enabledCourses.has(course.id)}
                  onCheckedChange={() => toggleCourse(course.id)}
                />
              </div>
            );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
