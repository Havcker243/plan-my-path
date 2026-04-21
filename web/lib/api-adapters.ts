/**
 * API adapter layer — transforms backend types into frontend domain types.
 *
 * Data flow:
 *   Backend API (lib/api.ts)
 *     └─ lib/api-adapters.ts  (toX converters, buildSemesters, semester utils)
 *         └─ contexts/plan-context.tsx  (consumes adapters, manages React state)
 *
 * Rules:
 *   - No React imports.
 *   - May call network functions (fetchCoursesBySubject) when building catalog metadata.
 *   - Pure functions are marked; async functions are clearly labeled.
 */

import {
  fetchCoursesBySubject,
  type BackendPlanCourse,
  type BackendCourse,
  type BackendSubjectCourse,
  type BackendSemester,
  type CourseLabelEntry,
  type ElectiveRule,
  type TermCalendarEntry,
} from "@/lib/api";
import type { Course, Semester, SemesterTerm } from "@/lib/data";
import {
  parseCodeParts,
  normalizeCourseCode,
  resolveLabel,
  capitalizeTerm,
} from "@/lib/course-utils";
import type { OnboardingCourse } from "@/lib/transcript";

// ─── Prereq helpers ───────────────────────────────────────────────────────────

function extractCourseCodes(text: string): string[] {
  const matches = text.matchAll(/\b([A-Za-z]{2,6})[- ]?(\d+[A-Za-z0-9]*)\b/g);
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const match of matches) {
    const subject = match[1]?.toUpperCase();
    const number = match[2]?.toUpperCase();
    if (!subject || !number) continue;
    const code = `${subject}-${number}`;
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export function normalizePrereqs(requisites: unknown): string[] {
  // Backend requisites may contain prose like "39 credits" or paragraphs. Only
  // keep course-code-shaped values so prerequisite warnings do not produce fake
  // requirements such as "39 must come before BIOL-221".
  if (!requisites) return [];
  if (Array.isArray(requisites)) {
    const deduped = new Set<string>();
    requisites.forEach((value) => {
      extractCourseCodes(String(value)).forEach((code) => deduped.add(code));
    });
    return Array.from(deduped);
  }
  if (typeof requisites === "string") return extractCourseCodes(requisites);
  return [];
}

// ─── Backend → Course converters ──────────────────────────────────────────────

export function planCourseToCourse(
  bc: BackendPlanCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = [],
  coreqs: Record<string, string> = {}
): Course {
  // Used when loading an already-saved plan. Preserve backend state while
  // re-resolving labels against the current major rules.
  const { subject, level } = parseCodeParts(bc.code);
  return {
    id: bc.code,
    code: bc.code,
    title: bc.title,
    credits: bc.credits,
    label: resolveLabel(bc.code, labels, rules),
    status: bc.status,
    grade: bc.grade,
    selectedSectionId: bc.selectedSectionId,
    description: bc.description ?? "",
    prereqs: bc.prerequisites,
    coreqs: coreqs[bc.code] ? [coreqs[bc.code]] : [],
    offeredTerms: (bc.offeredTerms ?? []).map(capitalizeTerm) as SemesterTerm[],
    subject,
    level,
  };
}

export function searchCourseToCourse(
  bc: BackendCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = [],
  coreqs: Record<string, string> = {}
): Course {
  // Used for catalog search results before the user adds a course to a plan.
  // Search results always begin as planned courses.
  const { subject, level } = parseCodeParts(bc.course_code);
  const termSet = new Set<SemesterTerm>();
  (bc.sections ?? []).forEach((s) => termSet.add(capitalizeTerm(s.term)));
  const offeredTerms =
    termSet.size > 0 ? Array.from(termSet) : (["Fall", "Spring"] as SemesterTerm[]);
  return {
    id: bc.course_code,
    code: bc.course_code,
    title: bc.title ?? bc.course_code,
    credits: bc.credits.min_credits ?? 3,
    label: resolveLabel(bc.course_code, labels, rules),
    status: "planned",
    grade: null,
    selectedSectionId: null,
    description: bc.description ?? "",
    prereqs: normalizePrereqs(bc.requisites),
    coreqs: coreqs[bc.course_code] ? [coreqs[bc.course_code]] : [],
    offeredTerms,
    subject,
    level,
  };
}

export function subjectCourseToCourse(
  bc: BackendSubjectCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = [],
  coreqs: Record<string, string> = {}
): Course {
  const { subject, level } = parseCodeParts(bc.code);
  return {
    id: bc.code,
    code: bc.code,
    title: bc.title ?? bc.code,
    credits: bc.credits ?? 3,
    label: resolveLabel(bc.code, labels, rules),
    status: "planned",
    grade: null,
    selectedSectionId: null,
    description: bc.description ?? "",
    prereqs: normalizePrereqs(bc.prerequisites),
    coreqs: coreqs[bc.code] ? [coreqs[bc.code]] : [],
    offeredTerms: (bc.offeredTerms ?? []).map(capitalizeTerm) as SemesterTerm[],
    subject,
    level,
  };
}

// ─── Semester utilities ───────────────────────────────────────────────────────

/** Returns true if the semester's end date is in the past. */
export function isSemesterPast(
  term: SemesterTerm,
  year: number,
  termCalendar: TermCalendarEntry[] = []
): boolean {
  const today = new Date();
  const termLower = term.toLowerCase();
  const calEntry = termCalendar.find(
    (entry) => entry.term.toLowerCase() === termLower && entry.year === year
  );
  if (calEntry?.end_date) return new Date(calEntry.end_date) < today;
  const endMonth: Record<string, number> = { spring: 5, summer: 8, fall: 12, winter: 1 };
  const month = endMonth[termLower] ?? 12;
  const endYear = termLower === "winter" ? year + 1 : year;
  return new Date(endYear, month - 1, 15) < today;
}

/** Returns the end date string for a given term + year (for plan saves). */
export function semesterEndDateStr(
  term: SemesterTerm,
  year: number,
  termCalendar: TermCalendarEntry[] = []
): string {
  const termLower = term.toLowerCase();
  const calEntry = termCalendar.find(
    (t) => t.term.toLowerCase() === termLower && t.year === year
  );
  if (calEntry?.end_date) return calEntry.end_date;
  const endMonth: Record<string, number> = { Spring: 5, Summer: 8, Fall: 12, Winter: 1 };
  const month = endMonth[term] ?? 12;
  const endYear = term === "Winter" ? year + 1 : year;
  return `${endYear}-${String(month).padStart(2, "0")}-15`;
}

/** Returns the semester immediately before the given term/year. */
export function previousSemester(term: SemesterTerm, year: number): { term: SemesterTerm; year: number } {
  const allTerms: SemesterTerm[] = ["Spring", "Summer", "Fall", "Winter"];
  const index = allTerms.indexOf(term);
  const prevIndex = (index - 1 + allTerms.length) % allTerms.length;
  return {
    term: allTerms[prevIndex],
    year: prevIndex === allTerms.length - 1 ? year - 1 : year,
  };
}

// ─── Semester builders ────────────────────────────────────────────────────────

/** Converts backend plan semesters → frontend Semester[] + Course catalog. */
export function buildSemesters(
  backendSemesters: BackendSemester[],
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = [],
  termCalendar: TermCalendarEntry[] = [],
  coreqs: Record<string, string> = {}
): { semesters: Semester[]; catalog: Record<string, Course> } {
  const catalog: Record<string, Course> = {};
  const today = new Date();

  const semesters: Semester[] = backendSemesters.map((bs) => {
    const isPast = bs.end_date
      ? new Date(bs.end_date) < today
      : (() => {
          const termLower = (bs.term ?? "fall").toLowerCase().split(/[\s_-]/)[0];
          const calEntry = termCalendar.find(
            (t) => t.term.toLowerCase() === termLower && t.year === bs.year
          );
          if (calEntry?.end_date) return new Date(calEntry.end_date) < today;
          const endMonth: Record<string, number> = { spring: 5, summer: 8, fall: 12, winter: 1 };
          const m = endMonth[termLower] ?? 12;
          const endYear = termLower === "winter" ? bs.year + 1 : bs.year;
          return new Date(endYear, m - 1, 15) < today;
        })();

    bs.courses.forEach((bc) => {
      catalog[bc.code] = planCourseToCourse(bc, labels, rules, coreqs);
    });

    return {
      id: bs.id,
      term: capitalizeTerm(bs.term),
      year: bs.year,
      courseIds: [...new Set(bs.courses.map((c) => c.code))],
      isPast,
      isCurrent: false,
    };
  });

  // Mark isCurrent = first non-past semester
  const firstFutureIdx = semesters.findIndex((s) => !s.isPast);
  if (firstFutureIdx !== -1) {
    semesters[firstFutureIdx] = { ...semesters[firstFutureIdx], isCurrent: true };
  }

  return { semesters, catalog };
}

/**
 * Scaffolds a fresh semester grid from start → graduation.
 * Only Spring + Fall are included by default (Summer/Winter added manually).
 */
export function buildInitialSemesters(
  startTerm: string,
  startYear: number,
  gradTerm: string,
  gradYear: number,
  termCalendar: TermCalendarEntry[] = []
): Semester[] {
  const today = new Date();
  const termCycle: SemesterTerm[] = ["Spring", "Fall"];
  const termEndMonth: Record<string, number> = { spring: 5, summer: 8, fall: 12, winter: 2 };

  const normalizeTerm = (t: string): SemesterTerm => {
    const first = (t ?? "").toLowerCase().split(/[\s_-]/)[0];
    const map: Record<string, SemesterTerm> = {
      spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter",
    };
    return map[first] ?? "Fall";
  };

  const startTermNorm = normalizeTerm(startTerm);
  const gradTermNorm = normalizeTerm(gradTerm);
  const gradTermIdx = termCycle.indexOf(gradTermNorm);

  let termIdx = termCycle.indexOf(startTermNorm);
  let year = startYear;
  const semesters: Semester[] = [];

  for (let i = 0; i < 24; i++) {
    const term = termCycle[termIdx];
    const termLower = term.toLowerCase();

    const afterGrad =
      year > gradYear ||
      (year === gradYear && termIdx > gradTermIdx);
    if (afterGrad) break;

    const calEntry = termCalendar.find(
      (t) => t.term.toLowerCase() === termLower && t.year === year
    );
    const isPast = calEntry?.end_date
      ? new Date(calEntry.end_date) < today
      : (() => {
          const endMonth = termEndMonth[termLower] ?? 12;
          const endYear = termLower === "winter" ? year + 1 : year;
          return new Date(endYear, endMonth - 1, 28) < today;
        })();

    semesters.push({
      id: `new-${termLower}-${year}`,
      term,
      year,
      courseIds: [],
      isPast,
      isCurrent: false,
    });

    if (termIdx === termCycle.length - 1) {
      termIdx = 0;
      year += 1;
    } else {
      termIdx += 1;
    }
  }

  const firstFutureIdx = semesters.findIndex((s) => !s.isPast);
  if (firstFutureIdx !== -1) {
    semesters[firstFutureIdx] = { ...semesters[firstFutureIdx], isCurrent: true };
  }

  return semesters;
}

// ─── Transcript catalog fetch ─────────────────────────────────────────────────

/**
 * For a list of transcript courses, fetches DB metadata by subject and
 * returns a map from raw course code → enriched Course.
 * Courses not in the DB are simply absent from the result (caller handles fallback).
 */
export async function fetchCatalogMetadataForTranscriptCourses(
  courses: OnboardingCourse[],
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[],
  coreqs: Record<string, string> = {}
): Promise<Record<string, Course>> {
  // Transcript rows may use spaces while the catalog uses hyphens. Match by
  // normalized code and return catalog metadata keyed by the original
  // transcript code so callers can preserve transcript row identity.
  const subjects = Array.from(
    new Set(
      courses
        .map((course) => parseCodeParts(course.code).subject.toUpperCase())
        .filter(Boolean)
    )
  );

  const subjectResults = await Promise.allSettled(
    subjects.map(async (subject) => ({
      subject,
      rows: await fetchCoursesBySubject(subject),
    }))
  );

  const catalogByNormalizedCode: Record<string, Course> = {};
  subjectResults.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.rows.forEach((row) => {
      const course = subjectCourseToCourse(row, labels, rules, coreqs);
      catalogByNormalizedCode[normalizeCourseCode(course.code)] = course;
    });
  });

  const metaByRequestedCode: Record<string, Course> = {};
  courses.forEach((course) => {
    const matched = catalogByNormalizedCode[normalizeCourseCode(course.code)];
    if (matched) metaByRequestedCode[course.code] = matched;
  });

  return metaByRequestedCode;
}
