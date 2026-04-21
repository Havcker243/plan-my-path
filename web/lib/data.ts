// ─── Types ───────────────────────────────────────────────────────────────────

export type RequirementLabel = "required" | "group" | "elective" | "general";
export type CourseStatus = "completed" | "planned" | "failed";
export type SemesterTerm = "Fall" | "Spring" | "Summer" | "Winter";

export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  label: RequirementLabel;
  status: CourseStatus;
  grade: string | null;
  selectedSectionId: string | null;
  description: string;
  prereqs: string[]; // course codes
  coreqs: string[]; // course codes that should be taken with or before this course
  offeredTerms: SemesterTerm[];
  subject: string;
  level: 100 | 200 | 300 | 400;
}

export interface Semester {
  id: string;
  term: SemesterTerm;
  year: number;
  courseIds: string[];
  isPast: boolean;
  isCurrent: boolean;
}

const TERM_ORDER: Record<SemesterTerm, number> = {
  Spring: 0,
  Summer: 1,
  Fall: 2,
  Winter: 3,
};

const GRADE_POINTS: Record<string, number> = {
  "A+": 4,
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  "D+": 1.3,
  D: 1,
  "D-": 0.7,
  F: 0,
};

// ─── Requirement label helpers ───────────────────────────────────────────────

export const LABEL_META: Record<RequirementLabel, { label: string; color: string; bg: string }> = {
  required: { label: "Required", color: "text-red-700", bg: "bg-red-50" },
  group: { label: "Group Choice", color: "text-orange-700", bg: "bg-orange-50" },
  elective: { label: "Major Elective", color: "text-indigo-700", bg: "bg-indigo-50" },
  general: { label: "Gen. Elective", color: "text-slate-600", bg: "bg-slate-100" },
};

/** Dot indicator color per requirement label (use as a Tailwind class on a rounded div). */
export const LABEL_DOT: Record<RequirementLabel, string> = {
  required: "bg-red-500",
  group: "bg-orange-500",
  elective: "bg-indigo-500",
  general: "bg-slate-400",
};

/** Pill/badge styles per requirement label. */
export const LABEL_BADGE: Record<RequirementLabel, string> = {
  required: "bg-red-50 text-red-700 border-red-100",
  group: "bg-orange-50 text-orange-700 border-orange-100",
  elective: "bg-indigo-50 text-indigo-700 border-indigo-100",
  general: "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

export function getCourseById(
  id: string,
  catalog: Record<string, Course>
): Course | undefined {
  return catalog[id];
}

export function getTotalCredits(
  courseIds: string[],
  catalog: Record<string, Course>
): number {
  return courseIds.reduce((acc, id) => {
    const credits = catalog[id]?.credits;
    return acc + (typeof credits === "number" && Number.isFinite(credits) ? credits : 0);
  }, 0);
}

export function getCompletedCredits(
  semesters: Semester[],
  catalog: Record<string, Course>
): number {
  return semesters
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => {
      const course = catalog[id];
      const credits =
        typeof course?.credits === "number" && Number.isFinite(course.credits) ? course.credits : 0;
      return course?.status === "completed" ? acc + credits : acc;
    }, 0);
}

/** Codes of every course in the plan with status === "completed". */
export function getCompletedCourseCodes(
  semesters: Semester[],
  catalog: Record<string, Course>
): Set<string> {
  const codes = new Set<string>();
  for (const sem of semesters) {
    for (const id of sem.courseIds) {
      if (catalog[id]?.status === "completed") codes.add(id);
    }
  }
  return codes;
}

export function isCompletedCourse(course: Course | undefined): boolean {
  return course?.status === "completed";
}

/**
 * Returns deduplicated Course objects for every code that appears in at least
 * one semester.  Pages that need "courses in the plan" should use this instead
 * of Object.values(planCatalog), which can include search-result noise.
 */
export function getPlanCourses(
  semesters: Semester[],
  catalog: Record<string, Course>
): Course[] {
  const seen = new Set<string>();
  const courses: Course[] = [];
  for (const sem of semesters) {
    for (const id of sem.courseIds) {
      if (!seen.has(id)) {
        seen.add(id);
        const course = catalog[id];
        if (course) courses.push(course);
      }
    }
  }
  return courses;
}

export function getSemesterCreditLoad(
  semester: Semester,
  catalog: Record<string, Course>
): "light" | "ok" | "overloaded" {
  const total = getTotalCredits(semester.courseIds, catalog);
  if (total < 12) return "light";
  if (total > 18) return "overloaded";
  return "ok";
}

export function getPrereqWarnings(
  semesters: Semester[],
  catalog: Record<string, Course>
): Array<{ courseId: string; prereqId: string }> {
  const warnings: Array<{ courseId: string; prereqId: string }> = [];
  const semesterIndexForCourse: Record<string, number> = {};

  semesters.forEach((sem, idx) => {
    sem.courseIds.forEach((id) => {
      semesterIndexForCourse[id] = idx;
    });
  });

  for (const [courseId, semIdx] of Object.entries(semesterIndexForCourse)) {
    const course = catalog[courseId];
    if (!course) continue;
    if (course.status === "completed") continue;
    for (const prereqId of course.prereqs) {
      const prereqIdx = semesterIndexForCourse[prereqId];
      if (prereqIdx === undefined || prereqIdx >= semIdx) {
        warnings.push({ courseId, prereqId });
      }
    }
  }
  return warnings;
}

export function getCoreqWarnings(
  semesters: Semester[],
  catalog: Record<string, Course>
): Array<{ courseId: string; coreqId: string }> {
  const warnings: Array<{ courseId: string; coreqId: string }> = [];
  const semesterIndexForCourse: Record<string, number> = {};

  semesters.forEach((sem, idx) => {
    sem.courseIds.forEach((id) => {
      semesterIndexForCourse[id] = idx;
    });
  });

  for (const [courseId, semIdx] of Object.entries(semesterIndexForCourse)) {
    const course = catalog[courseId];
    if (!course) continue;
    if (course.status === "completed") continue;
    for (const coreqId of course.coreqs) {
      const coreqIdx = semesterIndexForCourse[coreqId];
      if (coreqIdx === undefined || coreqIdx > semIdx) {
        warnings.push({ courseId, coreqId });
      }
    }
  }

  return warnings;
}

/**
 * Returns courses placed in a semester where they're not typically offered.
 * Only flags when offeredTerms is non-empty (unknown = no warning).
 */
export function getOfferedTermWarnings(
  semesters: Semester[],
  catalog: Record<string, Course>
): Array<{ courseId: string; semesterId: string; semesterTerm: SemesterTerm }> {
  const warnings: Array<{ courseId: string; semesterId: string; semesterTerm: SemesterTerm }> = [];
  for (const sem of semesters) {
    if (sem.isPast) continue;
    for (const courseId of sem.courseIds) {
      const course = catalog[courseId];
      if (!course || course.offeredTerms.length === 0) continue;
      if (!course.offeredTerms.includes(sem.term)) {
        warnings.push({ courseId, semesterId: sem.id, semesterTerm: sem.term });
      }
    }
  }
  return warnings;
}

export function compareSemesters(a: Semester, b: Semester): number {
  return a.year !== b.year
    ? a.year - b.year
    : (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9);
}

export function markCurrentSemester(semesters: Semester[]): Semester[] {
  const firstFutureIdx = semesters.findIndex((semester) => !semester.isPast);
  return semesters.map((semester, index) => ({
    ...semester,
    isCurrent: firstFutureIdx !== -1 && index === firstFutureIdx,
  }));
}

export function getSemesterGpa(
  semester: Semester,
  catalog: Record<string, Course>
): number | null {
  let totalQualityPoints = 0;
  let totalCredits = 0;

  for (const courseId of semester.courseIds) {
    const course = catalog[courseId];
    if (!course?.grade) continue;
    const points = GRADE_POINTS[course.grade];
    if (points === undefined) continue;
    const credits =
      typeof course.credits === "number" && Number.isFinite(course.credits) ? course.credits : 0;
    totalQualityPoints += points * credits;
    totalCredits += credits;
  }

  if (totalCredits === 0) return null;
  return totalQualityPoints / totalCredits;
}
