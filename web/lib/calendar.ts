/**
 * Calendar engine — pure functions, no UI, no network calls.
 *
 * Data flow:
 *   plan-context (semesters + planCatalog + selectedSectionIds)
 *     └─ lib/calendar.ts  (buildEvents, getConflicts, buildIcs, parseTime, parseDays)
 *         └─ calendar-page.tsx  (renders the grid, handles semester selection)
 */

import type { BackendSection } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalEvent {
  courseCode: string;
  day: number;       // 0 = Mon … 6 = Sun
  startHour: number; // decimal hours, e.g. 9.5 = 9:30 AM
  duration: number;  // decimal hours
  color: string;     // Tailwind class string
  location: string | null;
}

// ─── Color palette ────────────────────────────────────────────────────────────

export const COURSE_COLORS = [
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
];

// ─── Time / day parsing ───────────────────────────────────────────────────────

/** Parses "HH:MM" or "H:MM AM/PM" → decimal hours (e.g. "09:30" → 9.5). Returns null on failure. */
export function parseTime(t: string | null): number | null {
  if (!t) return null;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "AM") h = h === 12 ? 0 : h;
    if (meridiem === "PM") h = h === 12 ? 12 : h + 12;
  } else if (h < 0 || h > 23) {
    return null;
  }
  if (m < 0 || m > 59) return null;
  return h + m / 60;
}

/** Parses "MWF", "TR", "MW" → 0-indexed Mon–Sun indices. */
export function parseDays(days: string | null): number[] {
  if (!days) return [];
  const map: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4, S: 5, U: 6 };
  const out: number[] = [];
  for (const ch of days) {
    if (map[ch] !== undefined) out.push(map[ch]);
  }
  return out;
}

// ─── Event building ───────────────────────────────────────────────────────────

/**
 * Converts a section map into calendar events for the weekly grid.
 * Uses the selected section when one exists, otherwise falls back to the first section.
 */
export function buildEvents(
  sectionsMap: Record<string, BackendSection[]>,
  courseColors: Record<string, string>,
  selectedSectionIds: Record<string, string | null>
): CalEvent[] {
  const events: CalEvent[] = [];
  for (const [code, sections] of Object.entries(sectionsMap)) {
    const color = courseColors[code] ?? COURSE_COLORS[0];
    const selectedSectionId = selectedSectionIds[code];
    const chosenSections = selectedSectionId
      ? sections.filter((s) => s.id === selectedSectionId)
      : sections.slice(0, 1);
    const effectiveSections = chosenSections.length > 0 ? chosenSections : sections.slice(0, 1);

    for (const section of effectiveSections) {
      for (const mt of section.meeting_times) {
        const days = parseDays(mt.days);
        const start = parseTime(mt.start_time);
        const end = parseTime(mt.end_time);
        if (start === null || end === null) continue;
        const duration = end - start;
        if (!Number.isFinite(duration) || duration <= 0) continue;
        if (days.length === 0) continue;
        const location = [mt.location, mt.building, mt.room]
          .map((v) => v?.trim())
          .filter(Boolean)
          .join(" • ") || null;
        for (const day of days) {
          events.push({ courseCode: code, day, startHour: start, duration, color, location });
        }
      }
    }
  }
  return events;
}

/**
 * Returns the set of course codes that have a time conflict with at least one
 * other course on the same day.
 */
export function getConflicts(events: CalEvent[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      if (a.day === b.day && a.courseCode !== b.courseCode) {
        if (a.startHour < b.startHour + b.duration && b.startHour < a.startHour + a.duration) {
          conflicts.add(a.courseCode);
          conflicts.add(b.courseCode);
        }
      }
    }
  }
  return conflicts;
}

// ─── iCal export ─────────────────────────────────────────────────────────────

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function weekdayIcsCode(index: number): string {
  return ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][index] ?? "MO";
}

/** Generates a .ics file string for the given semester's selected sections. */
export function buildIcs(
  currentSem: { term: string; year: number; courseIds: string[] },
  sectionsMap: Record<string, BackendSection[]>,
  selectedSectionIds: Record<string, string | null>
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FiskGrad//Planner Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  currentSem.courseIds.forEach((code) => {
    const sections = sectionsMap[code] ?? [];
    const selectedSectionId = selectedSectionIds[code];
    const chosenSection = selectedSectionId
      ? sections.find((s) => s.id === selectedSectionId)
      : sections[0];
    if (!chosenSection) return;

    chosenSection.meeting_times.forEach((meeting, meetingIndex) => {
      const days = parseDays(meeting.days).sort((a, b) => a - b);
      const start = parseTime(meeting.start_time);
      const end = parseTime(meeting.end_time);
      if (days.length === 0 || start === null || end === null || end <= start) return;

      const baseStartDate = chosenSection.start_date ? new Date(chosenSection.start_date) : null;
      const baseEndDate = chosenSection.end_date ? new Date(chosenSection.end_date) : null;
      if (!baseStartDate || Number.isNaN(baseStartDate.getTime())) return;

      const startDate = new Date(baseStartDate);
      const jsWeekday = startDate.getDay();
      const currentIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
      const delta = (days[0] - currentIndex + 7) % 7;
      startDate.setDate(startDate.getDate() + delta);
      startDate.setHours(Math.floor(start), Math.round((start % 1) * 60), 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(Math.floor(end), Math.round((end % 1) * 60), 0, 0);

      const byDay = days.map(weekdayIcsCode).join(",");
      const untilDate = baseEndDate && !Number.isNaN(baseEndDate.getTime()) ? new Date(baseEndDate) : null;
      if (untilDate) untilDate.setHours(23, 59, 59, 0);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escapeIcsText(`${code}-${chosenSection.id}-${meetingIndex}@fiskgrad`)}`);
      lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
      lines.push(`DTSTART:${formatIcsDate(startDate)}`);
      lines.push(`DTEND:${formatIcsDate(endDate)}`);
      lines.push(`SUMMARY:${escapeIcsText(`${code} (${chosenSection.section_code})`)}`);
      const location = [meeting.location, meeting.building, meeting.room]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(" • ");
      if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(`Term: ${currentSem.term} ${currentSem.year}`)}`);
      lines.push(
        untilDate
          ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${formatIcsDate(untilDate)}`
          : `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`
      );
      lines.push("END:VEVENT");
    });
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
