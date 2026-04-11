/**
 * Plan state engine — pure helpers for building plan state and API payloads.
 *
 * Rules:
 * - No React imports.
 * - No network calls.
 * - No toasts or UI side effects.
 * - Functions accept plain state snapshots and return new state/payload objects.
 */

import type { BackendPlan } from "@/lib/api";
import type { Course, Semester, SemesterTerm } from "@/lib/data";
import type { CourseLabelEntry, ElectiveRule, TermCalendarEntry } from "@/lib/api";
import { capitalizeTerm, normalizeCourseCode, parseCodeParts, resolveLabel } from "@/lib/course-utils";
import type { OnboardingCourse } from "@/lib/transcript";
import { TERM_ORDER } from "@/lib/transcript";
import { buildInitialSemesters, isSemesterPast, previousSemester, semesterEndDateStr } from "@/lib/api-adapters";

export interface SavePlanPayload {
  name?: string;
  semesters: {
    id: string;
    type: string;
    year: number;
    label: string;
    startDate: string | null;
    endDate: string | null;
    courses: {
      code: string;
      credits: number;
      status: string;
      grade: string | null;
      selectedSectionId: string | null;
    }[];
  }[];
}

export interface OnboardingPlanInput {
  startYear: number;
  startTerm: string;
  gradYear: number;
  gradTerm: string;
  completedCourses: OnboardingCourse[];
}

export interface NormalizedOnboardingCourse {
  source: OnboardingCourse;
  plannerCode: string;
  meta: Course | undefined;
}

export function sameCourseCode(a: string, b: string): boolean {
  return normalizeCourseCode(a) === normalizeCourseCode(b);
}

export function buildSavePlanPayload(
  semesters: Semester[],
  planCatalog: Record<string, Course>,
  termCalendar: TermCalendarEntry[]
): SavePlanPayload {
  return {
    semesters: semesters.map((sem) => ({
      id: sem.id,
      type: sem.term.toLowerCase(),
      year: sem.year,
      label: `${sem.term} ${sem.year}`,
      startDate: null,
      endDate: semesterEndDateStr(sem.term, sem.year, termCalendar),
      courses: sem.courseIds.map((code) => ({
        code,
        credits: Number.isFinite(planCatalog[code]?.credits) ? planCatalog[code]!.credits : 3,
        status: planCatalog[code]?.status ?? "planned",
        grade: planCatalog[code]?.grade ?? null,
        selectedSectionId: planCatalog[code]?.selectedSectionId ?? null,
      })),
    })),
  };
}

export function syncSemesterIdsFromBackend(
  semesters: Semester[],
  backendSemesters: BackendPlan["semesters"] | undefined
): Semester[] {
  if (!backendSemesters?.length) return semesters;
  return semesters.map((sem, index) => {
    const backendSem = backendSemesters[index];
    return backendSem ? { ...sem, id: backendSem.id } : sem;
  });
}

export function addCourseToSemesterState(
  semesters: Semester[],
  planCatalog: Record<string, Course>,
  course: Course,
  semesterId: string
): { ok: false } | { ok: true; semesters: Semester[]; planCatalog: Record<string, Course> } {
  const semesterExists = semesters.some((sem) => sem.id === semesterId);
  if (!semesterExists) return { ok: false };

  const nextPlanCatalog = {
    ...planCatalog,
    [course.code]: planCatalog[course.code] ?? course,
  };
  const nextSemesters = semesters.map((sem) => {
    if (sem.id !== semesterId || sem.courseIds.includes(course.code)) return sem;
    return { ...sem, courseIds: [...sem.courseIds, course.code] };
  });

  return { ok: true, semesters: nextSemesters, planCatalog: nextPlanCatalog };
}

export function getTranscriptFallbackSemester(
  profileStartTerm: string | null | undefined,
  profileStartYear: number | null | undefined,
  semesters: Semester[]
): { term: SemesterTerm; year: number } {
  if (profileStartTerm && profileStartYear) {
    return previousSemester(capitalizeTerm(profileStartTerm), profileStartYear);
  }

  const earliestSemester = [...semesters].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9)
  )[0];

  return earliestSemester
    ? previousSemester(earliestSemester.term, earliestSemester.year)
    : { term: "Fall", year: new Date().getFullYear() - 1 };
}

export function normalizeOnboardingCourses(
  courses: OnboardingCourse[],
  metaByCode: Record<string, Course>
): NormalizedOnboardingCourse[] {
  return courses.map((course) => ({
    source: course,
    plannerCode: metaByCode[course.code]?.code ?? course.code,
    meta: metaByCode[course.code],
  }));
}

export function getCompletedPlannerCodes(normalizedCourses: NormalizedOnboardingCourse[]): string[] {
  return normalizedCourses
    .filter(({ source }) => (source.status ?? (source.grade ? "completed" : "planned")) === "completed")
    .map(({ plannerCode }) => plannerCode);
}

export function buildOnboardingPlanState(
  data: OnboardingPlanInput,
  metaByCode: Record<string, Course>,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[],
  termCalendar: TermCalendarEntry[]
): {
  normalizedCourses: NormalizedOnboardingCourse[];
  completedCatalog: Record<string, Course>;
  completedCourseCodes: string[];
  allSemesters: Semester[];
} {
  const normalizedCourses = normalizeOnboardingCourses(data.completedCourses, metaByCode);
  const completedCourseCodes = getCompletedPlannerCodes(normalizedCourses);
  const termGroups = new Map<string, { term: SemesterTerm; year: number; courses: OnboardingCourse[] }>();

  for (const { source } of normalizedCourses) {
    let key: string;
    let term: SemesterTerm;
    let year: number;

    if (source.term && source.year) {
      term = capitalizeTerm(source.term);
      year = source.year;
      key = `${source.year}-${TERM_ORDER[term] ?? 9}-${term}`;
    } else {
      const previous = previousSemester(capitalizeTerm(data.startTerm), data.startYear);
      term = previous.term;
      year = previous.year;
      key = "manual-prev";
    }

    if (!termGroups.has(key)) termGroups.set(key, { term, year, courses: [] });
    termGroups.get(key)!.courses.push(source);
  }

  const sortedGroups = [...termGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => group);

  const pastSemesters: Semester[] = sortedGroups.map(({ term, year, courses }) => ({
    id: `past-${term.toLowerCase()}-${year}-${Math.random().toString(36).slice(2, 6)}`,
    term,
    year,
    courseIds: courses.map((course) => metaByCode[course.code]?.code ?? course.code),
    isPast: isSemesterPast(term, year, termCalendar),
    isCurrent: false,
  }));

  const completedCatalog: Record<string, Course> = {};
  for (const { source, plannerCode, meta } of normalizedCourses) {
    const { subject, level } = parseCodeParts(plannerCode);
    const courseStatus = source.status ?? (source.grade ? "completed" : "planned");
    completedCatalog[plannerCode] = meta
      ? {
          ...meta,
          status: courseStatus,
          grade: courseStatus === "completed" ? (source.grade ?? meta.grade) : null,
          title: source.title?.trim() ? source.title : meta.title,
          credits: Number.isFinite(source.credits) ? source.credits! : meta.credits,
        }
      : {
          id: plannerCode,
          code: plannerCode,
          title: source.title ?? plannerCode,
          credits: Number.isFinite(source.credits) ? source.credits! : 3,
          label: resolveLabel(plannerCode, labels, rules),
          status: courseStatus,
          grade: courseStatus === "completed" ? (source.grade ?? null) : null,
          selectedSectionId: null,
          description: "",
          prereqs: [],
          offeredTerms: [],
          subject,
          level,
        };
  }

  const futureSemesters = buildInitialSemesters(
    data.startTerm,
    data.startYear,
    data.gradTerm,
    data.gradYear,
    termCalendar
  ).filter(
    (semester) =>
      !pastSemesters.some(
        (existing) => existing.term === semester.term && existing.year === semester.year
      )
  );

  return {
    normalizedCourses,
    completedCatalog,
    completedCourseCodes,
    allSemesters: [...pastSemesters, ...futureSemesters],
  };
}
