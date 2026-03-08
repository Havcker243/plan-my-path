import { Semester, PlannedCourse, CourseSection } from '@/types/planner';

interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  location?: string;
  dtstart: string;
  dtend: string;
  rrule?: string;
}

function parseMeetingDaysToByDay(days: string): string[] {
  if (!days) return [];

  const dayMap: Record<string, string> = {
    M: 'MO',
    T: 'TU',
    W: 'WE',
    R: 'TH',
    F: 'FR',
    S: 'SA',
    U: 'SU',
  };

  const normalized = days.replace(/Th/gi, 'R').replace(/\//g, '');
  return normalized
    .split('')
    .map((token) => dayMap[token.toUpperCase()])
    .filter(Boolean);
}

function normalizeTimeToICS(time: string): string | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}${seconds
    .toString()
    .padStart(2, '0')}`;
}

// Format date for ICS (YYYYMMDD or YYYYMMDDTHHMMSS)
function formatICSDate(date: Date, time?: string): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  if (time) {
    return `${year}${month}${day}T${time}`;
  }
  return `${year}${month}${day}`;
}

// Get semester dates from backend-provided values (fallback to today)
function getSemesterDates(semester: Semester): { start: Date; end: Date } {
  const start = semester.startDate ? new Date(semester.startDate) : new Date();
  const end = semester.endDate ? new Date(semester.endDate) : new Date();
  return { start, end };
}

// Generate RRULE for weekly recurring events
function generateRRule(days: string[], untilDate: Date): string {
  const until = formatICSDate(untilDate) + 'T235959Z';
  return `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')};UNTIL=${until}`;
}

// Create ICS event for a course (semester-span all-day event)
function createSemesterSpanEvent(course: PlannedCourse, semester: Semester): ICSEvent {
  const dates = getSemesterDates(semester);
  
  return {
    uid: `${course.id}-${semester.id}@planner`,
    summary: `${course.code} - ${course.title}`,
    description: `${course.title}\\n${course.credits} credits\\n${course.description || ''}`,
    dtstart: formatICSDate(dates.start),
    dtend: formatICSDate(dates.end),
  };
}

function resolveSectionForCourse(course: PlannedCourse, sections?: CourseSection[]): CourseSection | null {
  if (!sections || sections.length === 0) return null;

  const bySelectedId =
    course.selectedSectionId
      ? sections.find((section) => section.id === course.selectedSectionId)
      : null;
  if (bySelectedId) return bySelectedId;

  const byCourseId = sections.find(
    (section) => section.courseId === course.id || section.course_id === course.id
  );
  return byCourseId ?? null;
}

function firstOccurrenceFrom(start: Date, byDay: string[]): Date {
  const dayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };
  const targetDays = byDay.map((value) => dayMap[value]).filter((value) => value !== undefined);
  if (targetDays.length === 0) return start;

  const date = new Date(start);
  for (let i = 0; i < 7; i += 1) {
    if (targetDays.includes(date.getDay())) return date;
    date.setDate(date.getDate() + 1);
  }
  return start;
}

// Create ICS event for a course with section times (recurring weekly)
function createRecurringEvent(
  course: PlannedCourse,
  section: CourseSection,
  semester: Semester
): ICSEvent | null {
  const meeting = section.meeting_times?.[0];
  if (!meeting?.days || !meeting.start_time || !meeting.end_time) return null;

  const byDay = parseMeetingDaysToByDay(meeting.days);
  const startTime = normalizeTimeToICS(meeting.start_time);
  const endTime = normalizeTimeToICS(meeting.end_time);
  if (byDay.length === 0 || !startTime || !endTime) return null;

  const dates = getSemesterDates(semester);
  const firstDate = firstOccurrenceFrom(dates.start, byDay);
  const instructorNames = (section.instructors ?? []).map((item) => item.name).filter(Boolean);
  const location = [meeting.location, meeting.building, meeting.room].filter(Boolean).join(' ');

  return {
    uid: `${course.id}-${section.id}-${semester.id}@planner`,
    summary: `${course.code} - ${course.title}`,
    description: `Instructor: ${instructorNames.join(', ') || 'TBA'}\\nSection: ${section.section_code}\\n${course.credits} credits`,
    location: location || undefined,
    dtstart: formatICSDate(firstDate, startTime),
    dtend: formatICSDate(firstDate, endTime),
    rrule: generateRRule(byDay, dates.end),
  };
}

// Generate full ICS file content
export function generateICSContent(events: ICSEvent[]): string {
  const now = new Date();
  const dtstamp = formatICSDate(now, 
    `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`
  );

  const eventStrings = events.map(event => {
    const lines = [
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${dtstamp}Z`,
      `DTSTART${event.dtstart.includes('T') ? '' : ';VALUE=DATE'}:${event.dtstart}`,
      `DTEND${event.dtend.includes('T') ? '' : ';VALUE=DATE'}:${event.dtend}`,
      `SUMMARY:${event.summary}`,
      `DESCRIPTION:${event.description}`,
    ];
    
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }
    
    if (event.rrule) {
      lines.push(event.rrule);
    }
    
    lines.push('END:VEVENT');
    return lines.join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//4-Year Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My Academic Plan',
    `X-WR-TIMEZONE:${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    ...eventStrings,
    'END:VCALENDAR',
  ].join('\r\n');
}

// Export semesters to ICS
export function exportToICS(
  semesters: Semester[],
  sections?: CourseSection[],
  selectedCourseIds?: string[]
): void {
  const events: ICSEvent[] = [];

  semesters.forEach(semester => {
    semester.courses.forEach(course => {
      // Skip if not in selected courses (when filter is applied)
      if (selectedCourseIds && !selectedCourseIds.includes(course.id)) {
        return;
      }

      const courseSection = resolveSectionForCourse(course, sections);
      
      if (courseSection) {
        const recurringEvent = createRecurringEvent(course, courseSection, semester);
        if (recurringEvent) {
          events.push(recurringEvent);
          return;
        }
      }
      
      // Fallback to semester-span event
      events.push(createSemesterSpanEvent(course, semester));
    });
  });

  const icsContent = generateICSContent(events);
  
  // Trigger download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'my-academic-plan.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
