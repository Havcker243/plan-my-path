/**
 * Planner engine — pure functions, no UI, no network calls.
 *
 * Data flow:
 *   plan-context (raw semesters + catalog)
 *     └─ lib/data.ts  (getPrereqWarnings, getSemesterCreditLoad, getSemesterGpa, …)
 *     └─ lib/planner.ts  (getMissingRequired, section display formatting)
 *         └─ planner-page.tsx  (renders the model, handles user actions)
 */

import type { BackendSection } from "@/lib/api";
import type { CourseLabelEntry } from "@/lib/api";

// ─── Missing requirements ─────────────────────────────────────────────────────

export interface MissingRequiredCourse {
  code: string;
  entry: CourseLabelEntry;
}

/**
 * Returns required and group-choice courses from the major template that are
 * not yet in the plan. Sorted alphabetically by course code.
 */
export function getMissingRequired(
  labels: Record<string, CourseLabelEntry>,
  planCodes: Set<string>
): MissingRequiredCourse[] {
  return Object.entries(labels)
    .filter(
      ([code, entry]) =>
        (entry.label === "Required" || entry.label === "Group Choice") &&
        !planCodes.has(code)
    )
    .map(([code, entry]) => ({ code, entry }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ─── Section display formatting ───────────────────────────────────────────────

/** Formats an ISO date string as "Jan 15, 2025", or null if unparseable. */
export function formatSectionDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a time string (e.g. "13:30" or "1:30 PM") to "1:30 PM" display form.
 * Returns null if the input is null/empty.
 */
export function formatSectionTime(value: string | null): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return value;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return value;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  }
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Combines days + start/end times into a single display string. */
export function formatMeetingTime(
  days: string | null,
  start: string | null,
  end: string | null
): string {
  const dayText = days?.trim() || "Days TBA";
  const startText = formatSectionTime(start);
  const endText = formatSectionTime(end);
  if (startText && endText) return `${dayText} • ${startText} - ${endText}`;
  return dayText;
}

/** Returns "14/30 seats open" or null if seat data is missing. */
export function formatSeatSummary(section: BackendSection): string | null {
  const available = section.seats?.available;
  const capacity = section.seats?.capacity;
  if (!Number.isFinite(available) || !Number.isFinite(capacity)) return null;
  return `${available}/${capacity} seats open`;
}

/** Returns comma-joined instructor names, or "Instructor TBA". */
export function getInstructorNames(section: BackendSection): string {
  const names = (section.instructors ?? [])
    .map((instructor) => instructor.name?.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Instructor TBA";
}

export type DayPatternPreference = "any" | "mwf" | "tth";

export interface SchedulePreferences {
  earliestStartHour: number | null;
  latestEndHour: number | null;
  noFriday: boolean;
  dayPattern: DayPatternPreference;
  onlyMatching: boolean;
}

function parseTimeToHour(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
  if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  return hours + minutes / 60;
}

function normalizeDayTokens(days: string | null): string[] {
  if (!days) return [];
  return days.toUpperCase().replace(/TH/g, "R").split("").filter((day) => "MTWRFSU".includes(day));
}

export function sectionMatchesPreferences(
  section: BackendSection,
  preferences: SchedulePreferences
): boolean {
  const meetings = section.meeting_times ?? [];
  if (meetings.length === 0) return true;

  return meetings.every((meeting) => {
    const startHour = parseTimeToHour(meeting.start_time);
    const endHour = parseTimeToHour(meeting.end_time);
    const dayTokens = normalizeDayTokens(meeting.days);

    if (preferences.earliestStartHour != null && startHour != null && startHour < preferences.earliestStartHour) {
      return false;
    }
    if (preferences.latestEndHour != null && endHour != null && endHour > preferences.latestEndHour) {
      return false;
    }
    if (preferences.noFriday && dayTokens.includes("F")) {
      return false;
    }
    if (preferences.dayPattern === "mwf") {
      return dayTokens.length === 0 || dayTokens.every((day) => ["M", "W", "F"].includes(day));
    }
    if (preferences.dayPattern === "tth") {
      return dayTokens.length === 0 || dayTokens.every((day) => ["T", "R"].includes(day));
    }
    return true;
  });
}

export function filterSectionsByPreferences(
  sections: BackendSection[],
  preferences: SchedulePreferences
): BackendSection[] {
  if (!preferences.onlyMatching) return sections;
  return sections.filter((section) => sectionMatchesPreferences(section, preferences));
}

export function countMatchingSections(
  sections: BackendSection[],
  preferences: SchedulePreferences
): number {
  return sections.filter((section) => sectionMatchesPreferences(section, preferences)).length;
}
