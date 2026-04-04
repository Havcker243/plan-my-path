"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import { fetchSections, type BackendSection } from "@/lib/api";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8am–5pm
const CELL_HEIGHT = 60;

// Parse "HH:MM" → decimal hours (e.g. "09:30" → 9.5)
function parseTime(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

// Parse days string like "MWF", "TR", "MW" → array of 0-indexed Mon-Fri indices
function parseDays(days: string | null): number[] {
  if (!days) return [];
  const map: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4 };
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
    for (const section of chosenSections) {
      for (const mt of section.meeting_times) {
        const days = parseDays(mt.days);
        const start = parseTime(mt.start_time);
        const end = parseTime(mt.end_time);
        if (start === null || end === null) continue;
        const duration = end - start;
        for (const day of days) {
          events.push({ courseCode: code, day, startHour: start, duration, color });
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

export default function CalendarPage() {
  const { semesters, planCatalog } = usePlan();
  const currentSem = semesters.find((s) => s.isCurrent);

  const [sectionsMap, setSectionsMap] = useState<Record<string, BackendSection[]>>({});
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    if (!currentSem || currentSem.courseIds.length === 0) return;
    setLoadingSections(true);
    const term = `${currentSem.term.toLowerCase()} ${currentSem.year}`;
    fetchSections(currentSem.courseIds, term)
      .then(setSectionsMap)
      .catch(() => toast.error("Failed to load section schedule"))
      .finally(() => setLoadingSections(false));
  }, [currentSem?.id]);

  const courseColors = Object.fromEntries(
    (currentSem?.courseIds ?? []).map((code, i) => [code, COURSE_COLORS[i % COURSE_COLORS.length]])
  );
  const selectedSectionIds = Object.fromEntries(
    (currentSem?.courseIds ?? []).map((code) => [code, planCatalog[code]?.selectedSectionId ?? null])
  );

  const events = buildEvents(sectionsMap, courseColors, selectedSectionIds);
  const conflicts = getConflicts(events);

  const formatHour = (h: number) => {
    const whole = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    const ampm = whole < 12 ? "am" : "pm";
    const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole;
    return `${display}${mins > 0 ? `:${String(mins).padStart(2, "0")}` : ""}${ampm}`;
  };

  if (!currentSem) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">No current semester found.</p>
        <Link href="/planner" className="text-xs text-primary hover:underline">Go to Planner</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-foreground">Weekly Schedule</h1>
          <p className="text-xs text-muted-foreground">
            {currentSem.term} {currentSem.year} — {currentSem.courseIds.length} courses
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loadingSections && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading sections…
            </span>
          )}
          {conflicts.size > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              {Math.ceil(conflicts.size / 2)} time conflict{conflicts.size > 2 ? "s" : ""}
            </span>
          )}
          <Link href="/planner" className="text-xs text-primary hover:underline flex items-center gap-1">
            Back to Planner <ArrowRight className="w-3 h-3" />
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
            {HOURS.map((h) => (
              <div key={h} style={{ height: CELL_HEIGHT }} className="relative">
                <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground tabular-nums">
                  {formatHour(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex-1 relative border-r border-border last:border-r-0">
              <div className="h-10 flex items-center justify-center border-b border-border sticky top-0 bg-background z-10">
                <span className="text-xs font-semibold text-foreground">{day}</span>
              </div>
              {HOURS.map((h) => (
                <div key={h} style={{ height: CELL_HEIGHT }} className="border-b border-border/50" />
              ))}
              {events
                .filter((e) => e.day === dayIdx)
                .map((e, i) => {
                  const topOffset = 10 + (e.startHour - HOURS[0]) * CELL_HEIGHT;
                  const height = Math.max(e.duration * CELL_HEIGHT - 4, 20);
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
            Time conflict detected — check highlighted courses above. Adjust sections in your registrar portal.
          </p>
        </div>
      )}
    </div>
  );
}
