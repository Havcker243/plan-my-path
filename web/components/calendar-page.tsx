"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import type { BackendSection } from "@/lib/api";
import {
  COURSE_COLORS,
  buildEvents,
  getConflicts,
  buildIcs,
  type CalEvent,
} from "@/lib/calendar";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8am–5pm
const CELL_HEIGHT = 60;

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
      .catch((err) => console.error("[CalendarPage] failed to load sections:", err))
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

        <div className="flex items-center gap-2 md:gap-3">
          {loadingSections && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
          {conflicts.size > 0 && (
            <span className="text-[10px] md:text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {Math.ceil(conflicts.size / 2)} conflict{conflicts.size > 2 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={downloadIcs}
            disabled={loadingSections || Object.keys(sectionsMap).length === 0}
            className="hidden sm:block text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            .ics
          </button>
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

      {/* Mobile list view — hidden on md+ */}
      <div className="md:hidden flex-1 overflow-y-auto pb-4">
        {DAY_LABELS.slice(0, 5).map((dayLabel, dayIdx) => {
          const dayEvents = events.filter((e) => e.day === dayIdx);
          if (dayEvents.length === 0) return null;
          return (
            <div key={dayIdx} className="border-b border-border last:border-0">
              <div className="px-4 py-2 bg-muted/30">
                <span className="text-xs font-semibold text-foreground">{dayLabel}</span>
              </div>
              <div className="divide-y divide-border/50">
                {dayEvents
                  .sort((a, b) => a.startHour - b.startHour)
                  .map((e, i) => {
                    const isConflict = conflicts.has(e.courseCode);
                    const course = planCatalog[e.courseCode];
                    return (
                      <div
                        key={`${e.courseCode}-${i}`}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3",
                          isConflict ? "bg-red-50" : ""
                        )}
                      >
                        <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", e.color.split(" ")[0])} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground font-mono">{e.courseCode}</span>
                            {course?.title && (
                              <span className="text-xs text-muted-foreground truncate">{course.title}</span>
                            )}
                            {isConflict && (
                              <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Conflict</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{formatHour(e.startHour)} – {formatHour(e.startHour + e.duration)}</span>
                            {e.location && <span>{e.location}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
        {weekdayEvents.length === 0 && !loadingSections && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-sm text-muted-foreground mb-1">No scheduled sections found.</p>
            <p className="text-xs text-muted-foreground">Select sections in the Planner to see them here.</p>
          </div>
        )}
        {loadingSections && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading schedule…</span>
          </div>
        )}
      </div>

      {/* Weekly grid — desktop only */}
      <div className="hidden md:block flex-1 overflow-auto">
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
