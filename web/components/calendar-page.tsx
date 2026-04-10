"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import type { BackendSection } from "@/lib/api";
import { toast } from "sonner";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8am–5pm
const CELL_HEIGHT = 60;

// Parse "HH:MM" → decimal hours (e.g. "09:30" → 9.5)
function parseTime(t: string | null): number | null {
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

// Parse days string like "MWF", "TR", "MW" → array of 0-indexed Mon-Fri indices
function parseDays(days: string | null): number[] {
  if (!days) return [];
  const map: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4, S: 5, U: 6 };
  const out: number[] = [];
  for (const ch of days) {
    if (map[ch] !== undefined) out.push(map[ch]);
  }
  return out;
}

const COURSE_COLORS = [
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
];

interface CalEvent {
  courseCode: string;
  day: number;
  startHour: number;
  duration: number;
  color: string;
  location: string | null;
}

function buildEvents(
  sectionsMap: Record<string, BackendSection[]>,
  courseColors: Record<string, string>,
  selectedSectionIds: Record<string, string | null>
): CalEvent[] {
  const events: CalEvent[] = [];
  for (const [code, sections] of Object.entries(sectionsMap)) {
    const color = courseColors[code] ?? COURSE_COLORS[0];
    const selectedSectionId = selectedSectionIds[code];
    const chosenSections = selectedSectionId
      ? sections.filter((section) => section.id === selectedSectionId)
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
          .map((value) => value?.trim())
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

function getConflicts(events: CalEvent[]): Set<string> {
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

function buildIcs(
  currentSem: { term: string; year: number; courseIds: string[] },
  sectionsMap: Record<string, BackendSection[]>,
  selectedSectionIds: Record<string, string | null>
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GradPath//Planner Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  currentSem.courseIds.forEach((code) => {
    const sections = sectionsMap[code] ?? [];
    const selectedSectionId = selectedSectionIds[code];
    const chosenSection = selectedSectionId
      ? sections.find((section) => section.id === selectedSectionId)
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
      lines.push(`UID:${escapeIcsText(`${code}-${chosenSection.id}-${meetingIndex}@gradpath`)}`);
      lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
      lines.push(`DTSTART:${formatIcsDate(startDate)}`);
      lines.push(`DTEND:${formatIcsDate(endDate)}`);
      lines.push(`SUMMARY:${escapeIcsText(`${code} (${chosenSection.section_code})`)}`);
      const location = [meeting.location, meeting.building, meeting.room]
        .map((value) => value?.trim())
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

export default function CalendarPage() {
  const { semesters, planCatalog, loadSectionsForCourses } = usePlan();

  // All semesters that have at least one course (past or future)
  const semestersWithCourses = semesters.filter((s) => s.courseIds.length > 0);
  const defaultSem = semesters.find((s) => s.isCurrent) ?? semestersWithCourses[0] ?? null;
  const [selectedSemId, setSelectedSemId] = useState<string | null>(defaultSem?.id ?? null);

  // Keep selectedSemId in sync if semesters reload (compare by id, not object reference)
  const defaultSemId = defaultSem?.id ?? null;
  useEffect(() => {
    if (!selectedSemId && defaultSemId) setSelectedSemId(defaultSemId);
  }, [defaultSemId, selectedSemId]);

  const currentSem = semestersWithCourses.find((s) => s.id === selectedSemId) ?? defaultSem;
  const currentSemIdx = semestersWithCourses.findIndex((s) => s.id === currentSem?.id);
  const prevSem = currentSemIdx > 0 ? semestersWithCourses[currentSemIdx - 1] : null;
  const nextSem = currentSemIdx < semestersWithCourses.length - 1 ? semestersWithCourses[currentSemIdx + 1] : null;

  const [sectionsMap, setSectionsMap] = useState<Record<string, BackendSection[]>>({});
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    if (!currentSem || currentSem.courseIds.length === 0) return;
    setSectionsMap({});
    setLoadingSections(true);
    const term = `${currentSem.term.toLowerCase()} ${currentSem.year}`;
    loadSectionsForCourses(currentSem.courseIds, term)
      .then(setSectionsMap)
      .catch(() => toast.error("Failed to load section schedule"))
      .finally(() => setLoadingSections(false));
  }, [currentSem?.id, loadSectionsForCourses]);

  const courseColors = Object.fromEntries(
    (currentSem?.courseIds ?? []).map((code, i) => [code, COURSE_COLORS[i % COURSE_COLORS.length]])
  );
  const selectedSectionIds = Object.fromEntries(
    (currentSem?.courseIds ?? []).map((code) => [code, planCatalog[code]?.selectedSectionId ?? null])
  );

  const events = buildEvents(sectionsMap, courseColors, selectedSectionIds);
  const conflicts = getConflicts(events);
  const weekdayEvents = events.filter((event) => WEEKDAY_INDEXES.includes(event.day));
  const dayIndexes = WEEKDAY_INDEXES;
  const startHourFloor = weekdayEvents.length > 0
    ? Math.max(0, Math.floor(Math.min(...weekdayEvents.map((event) => event.startHour))))
    : HOURS[0];
  const endHourCeil = weekdayEvents.length > 0
    ? Math.min(24, Math.ceil(Math.max(...weekdayEvents.map((event) => event.startHour + event.duration))))
    : HOURS[HOURS.length - 1] + 1;
  const hourStart = Math.min(startHourFloor, HOURS[0]);
  const hourEndExclusive = Math.max(endHourCeil, HOURS[HOURS.length - 1] + 1);
  const visibleHours = Array.from(
    { length: Math.max(1, hourEndExclusive - hourStart) },
    (_, index) => hourStart + index
  );

  const formatHour = (h: number) => {
    const whole = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    const ampm = whole < 12 ? "am" : "pm";
    const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole;
    return `${display}${mins > 0 ? `:${String(mins).padStart(2, "0")}` : ""}${ampm}`;
  };

  const downloadIcs = () => {
    const ics = buildIcs(currentSem, sectionsMap, selectedSectionIds);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentSem.term.toLowerCase()}-${currentSem.year}-schedule.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (!currentSem) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">No semesters with courses yet.</p>
        <Link href="/planner" className="text-xs text-primary hover:underline">Go to Planner</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-shrink-0">
        {/* Semester navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => prevSem && setSelectedSemId(prevSem.id)}
            disabled={!prevSem}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={prevSem ? `${prevSem.term} ${prevSem.year}` : undefined}
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">
              {currentSem.term} {currentSem.year}
              {currentSem.isCurrent && (
                <span className="ml-2 text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full align-middle">
                  Current
                </span>
              )}
              {currentSem.isPast && (
                <span className="ml-2 text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full align-middle">
                  Past
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">{currentSem.courseIds.length} courses</p>
          </div>
          <button
            onClick={() => nextSem && setSelectedSemId(nextSem.id)}
            disabled={!nextSem}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={nextSem ? `${nextSem.term} ${nextSem.year}` : undefined}
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {loadingSections && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </span>
          )}
          <button
            type="button"
            onClick={downloadIcs}
            disabled={loadingSections || Object.keys(sectionsMap).length === 0}
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            Download .ics
          </button>
          {conflicts.size > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              {Math.ceil(conflicts.size / 2)} conflict{conflicts.size > 2 ? "s" : ""}
            </span>
          )}
          <Link href="/planner" className="text-xs text-primary hover:underline flex items-center gap-1">
            Planner <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Course legend */}
      <div className="px-5 py-2.5 border-b border-border bg-muted/30 flex flex-wrap gap-2 flex-shrink-0">
        {currentSem.courseIds.map((code) => {
          const course = planCatalog[code];
          const hasSections = !!(sectionsMap[code]?.length);
          const isConflict = conflicts.has(code);
          const selectedSection = course?.selectedSectionId
            ? sectionsMap[code]?.find((section) => section.id === course.selectedSectionId)
            : sectionsMap[code]?.[0];
          return (
            <div
              key={code}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
                isConflict
                  ? "bg-red-50 border-red-300 text-red-700"
                  : hasSections
                  ? "bg-background border-border text-foreground"
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              {isConflict && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              <span className="font-medium">{code}</span>
              {selectedSection && (
                <span className="text-muted-foreground">
                  ({selectedSection.section_code})
                </span>
              )}
              {!hasSections && !loadingSections && (
                <span className="text-muted-foreground">(no schedule data)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Weekly grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-[600px]">
          {/* Time column */}
          <div className="flex-shrink-0 w-14 pt-10 border-r border-border">
            {visibleHours.map((h) => (
              <div key={h} style={{ height: CELL_HEIGHT }} className="relative">
                <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground tabular-nums">
                  {formatHour(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayIndexes.map((dayIdx) => (
            <div key={dayIdx} className="flex-1 relative border-r border-border last:border-r-0">
              <div className="h-10 flex items-center justify-center border-b border-border sticky top-0 bg-background z-10">
                <span className="text-xs font-semibold text-foreground">{DAY_LABELS[dayIdx]}</span>
              </div>
              {visibleHours.map((h) => (
                <div key={h} style={{ height: CELL_HEIGHT }} className="border-b border-border/50" />
              ))}
              {events
                .filter((e) => e.day === dayIdx)
                .map((e, i) => {
                  const topOffset = 10 + (e.startHour - hourStart) * CELL_HEIGHT;
                  const height = Math.max(e.duration * CELL_HEIGHT - 4, 20);
                  if (!Number.isFinite(topOffset) || !Number.isFinite(height)) return null;
                  const isConflict = conflicts.has(e.courseCode);
                  return (
                    <div
                      key={`${e.courseCode}-${i}`}
                      style={{ top: topOffset, height }}
                      className={cn(
                        "absolute inset-x-1 rounded-md border px-2 py-1.5 overflow-hidden cursor-pointer hover:brightness-95 transition-all",
                        isConflict
                          ? "bg-red-100 border-red-300 text-red-800 ring-1 ring-red-400"
                          : e.color
                      )}
                    >
                      <p className="text-[10px] font-semibold leading-tight truncate">{e.courseCode}</p>
                      <p className="text-[9px] leading-tight opacity-70">
                        {formatHour(e.startHour)}–{formatHour(e.startHour + e.duration)}
                      </p>
                      {e.location && (
                        <p className="text-[9px] leading-tight opacity-70 truncate">
                          {e.location}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {conflicts.size > 0 && (
        <div className="px-5 py-3 border-t border-border bg-red-50 flex-shrink-0">
          <p className="text-xs text-red-700 font-medium">
            Time conflict detected. Check highlighted courses above and adjust sections in your registrar portal.
          </p>
        </div>
      )}
    </div>
  );
}
