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

// ─── Requirement label helpers ───────────────────────────────────────────────

export const LABEL_META: Record<RequirementLabel, { label: string; color: string; bg: string }> = {
  required: { label: "Required", color: "text-red-700", bg: "bg-red-50" },
  group: { label: "Group Choice", color: "text-orange-700", bg: "bg-orange-50" },
  elective: { label: "Major Elective", color: "text-indigo-700", bg: "bg-indigo-50" },
  general: { label: "Gen. Elective", color: "text-slate-600", bg: "bg-slate-100" },
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
  return courseIds.reduce((acc, id) => acc + (catalog[id]?.credits ?? 0), 0);
}

export function getCompletedCredits(
  semesters: Semester[],
  catalog: Record<string, Course>
): number {
  return semesters
    .flatMap((s) => s.courseIds)
    .reduce((acc, id) => {
      const course = catalog[id];
      return course?.status === "completed" ? acc + course.credits : acc;
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
    for (const prereqId of course.prereqs) {
      const prereqIdx = semesterIndexForCourse[prereqId];
      if (prereqIdx === undefined || prereqIdx >= semIdx) {
        warnings.push({ courseId, prereqId });
      }
    }
  }
  return warnings;
}
