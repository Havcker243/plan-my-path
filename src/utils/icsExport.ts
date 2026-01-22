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

// Semester date ranges (sample data - adjust for your university)
const semesterDates: Record<string, { start: Date; end: Date }> = {
  fall: { 
    start: new Date(2024, 7, 26), // Aug 26
    end: new Date(2024, 11, 13)   // Dec 13
  },
  spring: { 
    start: new Date(2025, 0, 13), // Jan 13
    end: new Date(2025, 4, 9)     // May 9
  },
  summer: { 
    start: new Date(2025, 4, 19), // May 19
    end: new Date(2025, 7, 8)     // Aug 8
  },
};

// Parse meeting times like "MWF 9:00-9:50 AM" or "TR 10:30 AM-11:45 AM"
function parseMeetingTime(meetingTime: string): { days: string[]; startTime: string; endTime: string } | null {
  const dayMap: Record<string, string> = {
    'M': 'MO',
    'T': 'TU',
    'W': 'WE',
    'R': 'TH',
    'F': 'FR',
    'S': 'SA',
    'U': 'SU',
  };

  const match = meetingTime.match(/^([MTWRFSU]+)\s+(\d{1,2}:\d{2})\s*(AM|PM)?-(\d{1,2}:\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  const [, dayChars, startTimeRaw, startPeriod, endTimeRaw, endPeriod] = match;
  
  const days = dayChars.split('').map(d => dayMap[d]).filter(Boolean);
  
  // Convert to 24-hour format for ICS
  const convertTo24Hr = (time: string, period?: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    let h = hours;
    if (period?.toUpperCase() === 'PM' && hours !== 12) h += 12;
    if (period?.toUpperCase() === 'AM' && hours === 12) h = 0;
    return `${h.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
  };

  return {
    days,
    startTime: convertTo24Hr(startTimeRaw, startPeriod || endPeriod),
    endTime: convertTo24Hr(endTimeRaw, endPeriod),
  };
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

// Get semester dates adjusted for year
function getSemesterDates(semesterType: string, year: number): { start: Date; end: Date } {
  const base = semesterDates[semesterType] || semesterDates.fall;
  const yearDiff = year - base.start.getFullYear();
  
  return {
    start: new Date(base.start.getFullYear() + yearDiff, base.start.getMonth(), base.start.getDate()),
    end: new Date(base.end.getFullYear() + yearDiff, base.end.getMonth(), base.end.getDate()),
  };
}

// Generate RRULE for weekly recurring events
function generateRRule(days: string[], untilDate: Date): string {
  const until = formatICSDate(untilDate) + 'T235959Z';
  return `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')};UNTIL=${until}`;
}

// Create ICS event for a course (semester-span all-day event)
function createSemesterSpanEvent(course: PlannedCourse, semester: Semester): ICSEvent {
  const dates = getSemesterDates(semester.type, semester.year);
  
  return {
    uid: `${course.id}-${semester.id}@planner`,
    summary: `${course.code} - ${course.title}`,
    description: `${course.title}\\n${course.credits} credits\\n${course.description || ''}`,
    dtstart: formatICSDate(dates.start),
    dtend: formatICSDate(dates.end),
  };
}

// Create ICS event for a course with section times (recurring weekly)
function createRecurringEvent(
  course: PlannedCourse, 
  section: CourseSection, 
  semester: Semester
): ICSEvent | null {
  const parsed = parseMeetingTime(section.meetingTimes);
  if (!parsed) return null;

  const dates = getSemesterDates(semester.type, semester.year);
  
  // Find the first occurrence day
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const firstDay = Math.min(...parsed.days.map(d => dayMap[d]));
  const startDate = new Date(dates.start);
  while (startDate.getDay() !== firstDay) {
    startDate.setDate(startDate.getDate() + 1);
  }

  return {
    uid: `${course.id}-${section.id}-${semester.id}@planner`,
    summary: `${course.code} - ${course.title}`,
    description: `Professor: ${section.professor}\\nSection: ${section.sectionNumber}\\n${course.credits} credits`,
    location: 'TBD', // Add location if available
    dtstart: formatICSDate(startDate, parsed.startTime),
    dtend: formatICSDate(startDate, parsed.endTime),
    rrule: generateRRule(parsed.days, dates.end),
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
    'X-WR-TIMEZONE:America/New_York',
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

      // Check if course has section with meeting times
      const courseSection = sections?.find(s => s.courseId === course.id);
      
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
