/**
 * Transcript engine — pure functions, no UI, no network calls.
 *
 * Data flow:
 *   plan-context (importTranscript callback)
 *     └─ lib/transcript.ts  (groupCoursesByTerm, buildCourseEntry)
 *         ← receives: OnboardingCourse[], DB metadata, labels, electiveRules
 *         → returns: grouped term map, Course entries ready to insert
 *
 * Network-dependent operations (fetchCatalogMetadataForTranscriptCourses,
 * persistPlan, apiUpdateProfile) stay in plan-context.
 */

import type { Course, SemesterTerm } from "@/lib/data";
import type { CourseLabelEntry, ElectiveRule } from "@/lib/api";
import { parseCodeParts, normalizeCourseCode, resolveLabel, capitalizeTerm } from "@/lib/course-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A course row produced by transcript parsing or manual entry during onboarding. */
export interface OnboardingCourse {
  code: string;
  status?: "completed" | "planned";
  grade: string | null;
  /** null means "unknown" (manual entry — will be grouped into one pre-start semester) */
  term: string | null;
  year: number | null;
  /** Title from transcript — used as fallback when course isn't in our DB catalog */
  title?: string;
  /** Credits from transcript — authoritative; DB value is supplementary */
  credits?: number;
}

export interface CourseGroup {
  term: SemesterTerm;
  year: number;
  courses: OnboardingCourse[];
}

// Stable sort order for terms within a year
export const TERM_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2, Winter: 3 };

// ─── Grouping ─────────────────────────────────────────────────────────────────

/**
 * Groups a flat list of transcript courses into term/year buckets.
 * Courses with no term/year are placed in `fallbackSemester`.
 */
export function groupCoursesByTerm(
  courses: OnboardingCourse[],
  fallbackSemester: { term: SemesterTerm; year: number }
): Map<string, CourseGroup> {
  const groups = new Map<string, CourseGroup>();
  for (const oc of courses) {
    const term = oc.term ? capitalizeTerm(oc.term) : fallbackSemester.term;
    const year = oc.year ?? fallbackSemester.year;
    const key = `${year}-${TERM_ORDER[term] ?? 9}-${term}`;
    if (!groups.has(key)) groups.set(key, { term, year, courses: [] });
    groups.get(key)!.courses.push(oc);
  }
  return groups;
}

// ─── Course entry construction ────────────────────────────────────────────────

/**
 * Builds a Course entry for a single transcript course.
 * When DB metadata is available it takes precedence for structural fields
 * (prereqs, offeredTerms, description); transcript data is authoritative
 * for grade, status, and credits.
 */
export function buildCourseEntry(
  oc: OnboardingCourse,
  plannerCode: string,
  meta: Course | undefined,
  labels: Record<string, CourseLabelEntry>,
  electiveRules: ElectiveRule[]
): Course {
  const { subject, level } = parseCodeParts(plannerCode);
  const courseStatus = oc.status ?? (oc.grade ? "completed" : "planned");
  const grade = courseStatus === "completed" ? (oc.grade ?? null) : null;

  if (meta) {
    return {
      ...meta,
      status: courseStatus,
      grade,
      title: oc.title?.trim() ? oc.title : meta.title,
      credits: Number.isFinite(oc.credits) ? oc.credits! : meta.credits,
    };
  }

  return {
    id: plannerCode,
    code: plannerCode,
    title: oc.title ?? plannerCode,
    credits: Number.isFinite(oc.credits) ? oc.credits! : 3,
    label: resolveLabel(plannerCode, labels, electiveRules),
    status: courseStatus,
    grade,
    selectedSectionId: null,
    description: "",
    prereqs: [],
    coreqs: [],
    offeredTerms: [],
    subject,
    level,
  };
}

/**
 * Returns the normalized code to use in the plan catalog.
 * Prefers DB metadata code (canonical casing) over the raw transcript code.
 */
export function plannerCode(rawCode: string, meta: Course | undefined): string {
  return meta?.code ?? normalizeCourseCode(rawCode);
}
