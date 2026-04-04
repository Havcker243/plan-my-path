"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";
import {
  fetchProfile,
  updateProfile as apiUpdateProfile,
  fetchPlan,
  savePlan as apiSavePlan,
  fetchCourseLabels,
  fetchMajors,
  searchCourses as apiSearchCourses,
  type BackendProfile,
  type BackendPlanCourse,
  type BackendSemester,
  type BackendCourse,
  type CourseLabelEntry,
  type ElectiveRule,
  type Major,
} from "@/lib/api";
import type { Course, Semester, RequirementLabel, SemesterTerm } from "@/lib/data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCodeParts(code: string): { subject: string; level: 100 | 200 | 300 | 400 } {
  const match = code.match(/^([A-Za-z]+)[- ]?(\d+)/);
  const subject = match?.[1] ?? code;
  const num = parseInt(match?.[2] ?? "100", 10);
  const lvl = Math.floor(num / 100) * 100;
  const level = (lvl >= 100 && lvl <= 400 ? lvl : 100) as 100 | 200 | 300 | 400;
  return { subject, level };
}

function mapBackendLabel(entry: CourseLabelEntry | undefined): RequirementLabel {
  if (!entry) return "general";
  const map: Record<string, RequirementLabel> = {
    Required: "required",
    "Group Choice": "group",
    "Major Elective": "elective",
    "General Elective": "general",
  };
  return map[entry.label] ?? "general";
}

/**
 * Mirrors the backend get_course_label logic.
 * First checks the explicit labels dict; if not found, walks the elective rules
 * to determine if the course qualifies as a Major Elective by subject+level.
 */
function resolveLabel(
  code: string,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[]
): RequirementLabel {
  if (labels[code]) return mapBackendLabel(labels[code]);

  for (const rule of rules) {
    const prefix = rule.subject_code + "-";
    if (!code.startsWith(prefix)) continue;
    const afterPrefix = code.slice(prefix.length);
    const digits = afterPrefix.replace(/\D/g, "");
    if (!digits) continue;
    const level = parseInt(digits, 10);
    if (
      level >= rule.min_level &&
      (rule.max_level == null || level <= rule.max_level) &&
      !rule.exclude_courses.includes(code)
    ) {
      return "elective";
    }
  }

  return "general";
}

function capitalizeTerm(t: string): SemesterTerm {
  const first = (t ?? "").split(/[\s_-]/)[0].toLowerCase();
  const map: Record<string, SemesterTerm> = {
    fall: "Fall",
    spring: "Spring",
    summer: "Summer",
    winter: "Winter",
  };
  return map[first] ?? "Fall";
}

function normalizePrereqs(requisites: unknown): string[] {
  if (!requisites) return [];
  if (Array.isArray(requisites)) {
    return requisites
      .map((value) => String(value).trim())
      .filter(Boolean);
  }
  if (typeof requisites === "string") {
    return requisites
      .split(/[,;]|(?:\s+or\s+)|(?:\s+and\s+)/i)
      .map((value) => value.trim())
      .filter((value) => /^[A-Za-z]{2,6}[- ]?\d+[A-Za-z]?$/.test(value));
  }
  return [];
}

function planCourseToCourse(
  bc: BackendPlanCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = []
): Course {
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
    offeredTerms: (bc.offeredTerms ?? []).map(capitalizeTerm) as SemesterTerm[],
    subject,
    level,
  };
}

function searchCourseToCourse(
  bc: BackendCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = []
): Course {
  const { subject, level } = parseCodeParts(bc.course_code);
  const termSet = new Set<SemesterTerm>();
  (bc.sections ?? []).forEach((s) => {
    const t = capitalizeTerm(s.term);
    termSet.add(t);
  });
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
    offeredTerms,
    subject,
    level,
  };
}

function buildSemesters(
  backendSemesters: BackendSemester[],
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = []
): { semesters: Semester[]; catalog: Record<string, Course> } {
  const catalog: Record<string, Course> = {};
  const today = new Date();

  const semesters: Semester[] = backendSemesters.map((bs) => {
    const isPast = bs.end_date
      ? new Date(bs.end_date) < today
      : (() => {
          // No end_date stored — estimate from term + year
          const termLower = (bs.term ?? "fall").toLowerCase().split(/[\s_-]/)[0];
          const endMonth: Record<string, number> = { spring: 5, summer: 8, fall: 12, winter: 1 };
          const m = endMonth[termLower] ?? 12;
          const endYear = termLower === "winter" ? bs.year + 1 : bs.year;
          return new Date(endYear, m - 1, 15) < today;
        })();

    bs.courses.forEach((bc) => {
      catalog[bc.code] = planCourseToCourse(bc, labels, rules);
    });

    return {
      id: bs.id,
      term: capitalizeTerm(bs.term),
      year: bs.year,
      courseIds: bs.courses.map((c) => c.code),
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

// Returns "YYYY-MM-15" end date string for a given term + year
function semesterEndDateStr(term: SemesterTerm, year: number): string {
  const endMonth: Record<string, number> = { Spring: 5, Summer: 8, Fall: 12, Winter: 1 };
  const month = endMonth[term] ?? 12;
  const endYear = term === "Winter" ? year + 1 : year;
  return `${endYear}-${String(month).padStart(2, "0")}-15`;
}

// ─── Initial semester scaffold ────────────────────────────────────────────────

function buildInitialSemesters(
  startTerm: string,
  startYear: number,
  gradTerm: string,
  gradYear: number
): Semester[] {
  const today = new Date();
  // Only scaffold Fall + Spring (most common US schedule)
  const termCycle: SemesterTerm[] = ["Spring", "Fall"];
  // Approximate end month for each term (used for isPast calculation)
  const termEndMonth: Record<string, number> = { spring: 5, summer: 8, fall: 12, winter: 2 };

  // Normalize start to nearest Fall or Spring
  const startNorm: SemesterTerm =
    startTerm.toLowerCase() === "spring" || startTerm.toLowerCase() === "winter"
      ? "Spring"
      : "Fall";
  const startYearNorm =
    startTerm.toLowerCase() === "winter" ? startYear + 1 : startYear;

  // Normalize grad to nearest Fall or Spring
  const gradNorm: SemesterTerm =
    gradTerm.toLowerCase() === "spring" || gradTerm.toLowerCase() === "winter"
      ? "Spring"
      : "Fall";
  const gradYearNorm =
    gradTerm.toLowerCase() === "winter" ? gradYear + 1 : gradYear;

  const semesters: Semester[] = [];
  // Spring=0, Fall=1
  let termIdx = startNorm === "Spring" ? 0 : 1;
  let year = startYearNorm;

  for (let i = 0; i < 16; i++) {
    const term = termCycle[termIdx];
    const termLower = term.toLowerCase();

    // Stop if we've gone past graduation
    if (
      year > gradYearNorm ||
      (year === gradYearNorm &&
        termEndMonth[termLower] > termEndMonth[gradNorm.toLowerCase()])
    )
      break;

    const semEndDate = new Date(year, termEndMonth[termLower] - 1, 30);
    const isPast = semEndDate < today;

    semesters.push({
      id: `new-${termLower}-${year}`,
      term,
      year,
      courseIds: [],
      isPast,
      isCurrent: false,
    });

    // Advance: Spring(0)→Fall(1) same year, Fall(1)→Spring(0) next year
    if (termIdx === 0) {
      termIdx = 1;
    } else {
      termIdx = 0;
      year += 1;
    }
  }

  // Mark first non-past semester as current
  const firstFutureIdx = semesters.findIndex((s) => !s.isPast);
  if (firstFutureIdx !== -1) {
    semesters[firstFutureIdx] = { ...semesters[firstFutureIdx], isCurrent: true };
  }

  return semesters;
}

// ─── Context types ─────────────────────────────────────────────────────────────

export interface OnboardingData {
  majorCode: string;
  startYear: number;
  startTerm: string;
  gradYear: number;
  gradTerm: string;
  completedCourseCodes: string[];
}

interface PlanContextValue {
  profile: BackendProfile | null;
  semesters: Semester[];
  planCatalog: Record<string, Course>;
  labels: Record<string, CourseLabelEntry>;
  majors: Major[];
  loading: boolean;
  /** True once the first profile+plan fetch cycle has completed (even if profile is null). */
  initialized: boolean;
  setSemesters: React.Dispatch<React.SetStateAction<Semester[]>>;
  addCoursesToCatalog: (courses: Course[]) => void;
  addCourseToSemester: (course: Course, semesterId: string) => Promise<boolean>;
  updateCourse: (courseCode: string, updates: Partial<Pick<Course, "status" | "grade" | "selectedSectionId">>) => void;
  savePlan: () => Promise<void>;
  doUpdateProfile: (data: Partial<BackendProfile>) => Promise<void>;
  searchCoursesCatalog: (q: string, subject?: string) => Promise<Course[]>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [planCatalog, setPlanCatalog] = useState<Record<string, Course>>({});
  const [labels, setLabels] = useState<Record<string, CourseLabelEntry>>({});
  const [electiveRules, setElectiveRules] = useState<ElectiveRule[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch majors once (public endpoint)
  useEffect(() => {
    fetchMajors().then(setMajors).catch(() => {});
  }, []);

  // Fetch plan data whenever auth token changes
  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setSemesters([]);
      setPlanCatalog({});
      setLabels({});
      setInitialized(false);
      return;
    }

    setLoading(true);

    Promise.all([fetchProfile(accessToken), fetchPlan(accessToken)])
      .then(async ([prof, plan]) => {
        setProfile(prof);

        let labelsData: Record<string, CourseLabelEntry> = {};
        let rulesData: ElectiveRule[] = [];
        if (prof?.major_code) {
          try {
            const res = await fetchCourseLabels(prof.major_code);
            labelsData = res.labels;
            rulesData = res.rules;
            setLabels(labelsData);
            setElectiveRules(rulesData);
          } catch {
            // labels are optional
          }
        }

        if (plan?.semesters?.length) {
          const { semesters: sems, catalog } = buildSemesters(plan.semesters, labelsData, rulesData);
          setSemesters(sems);
          setPlanCatalog(catalog);
        } else {
          setSemesters([]);
          setPlanCatalog({});
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, [accessToken]);

  const addCoursesToCatalog = useCallback((courses: Course[]) => {
    setPlanCatalog((prev) => {
      const next = { ...prev };
      courses.forEach((c) => {
        if (!next[c.code]) next[c.code] = c;
      });
      return next;
    });
  }, []);

  const updateCourse = useCallback(
    (courseCode: string, updates: Partial<Pick<Course, "status" | "grade" | "selectedSectionId">>) => {
      setPlanCatalog((prev) => {
        const current = prev[courseCode];
        if (!current) return prev;
        return {
          ...prev,
          [courseCode]: {
            ...current,
            ...updates,
          },
        };
      });
    },
    []
  );

  const persistPlan = useCallback(
    async (
      nextSemesters: Semester[],
      nextPlanCatalog: Record<string, Course> = planCatalog
    ) => {
      if (!accessToken) return null;
      const result = await apiSavePlan(accessToken, {
        semesters: nextSemesters.map((sem) => ({
        id: sem.id,
        type: sem.term.toLowerCase(),
        year: sem.year,
        label: `${sem.term} ${sem.year}`,
        startDate: null,
        endDate: semesterEndDateStr(sem.term, sem.year),
        courses: sem.courseIds.map((code) => ({
          code,
          credits: nextPlanCatalog[code]?.credits ?? 3,
          status: nextPlanCatalog[code]?.status ?? "planned",
          grade: nextPlanCatalog[code]?.grade ?? null,
          selectedSectionId: nextPlanCatalog[code]?.selectedSectionId ?? null,
        })),
        })),
      });
      return result;
    },
    [accessToken, planCatalog]
  );

  const savePlan = useCallback(async () => {
    const result = await persistPlan(semesters, planCatalog);
    // Sync IDs that the backend may have assigned (e.g. new semester rows)
    if (result?.semesters?.length) {
      setSemesters((prev) =>
        prev.map((sem, i) => {
          const backendSem = result.semesters[i];
          return backendSem ? { ...sem, id: backendSem.id } : sem;
        })
      );
    }
  }, [persistPlan, semesters, planCatalog]);

  const addCourseToSemester = useCallback(
    async (course: Course, semesterId: string) => {
      const semesterExists = semesters.some((sem) => sem.id === semesterId);
      if (!semesterExists) return false;

      const nextPlanCatalog = {
        ...planCatalog,
        [course.code]: planCatalog[course.code] ?? course,
      };
      const nextSemesters = semesters.map((sem) => {
        if (sem.id !== semesterId || sem.courseIds.includes(course.code)) {
          return sem;
        }
        return { ...sem, courseIds: [...sem.courseIds, course.code] };
      });

      setPlanCatalog(nextPlanCatalog);
      setSemesters(nextSemesters);

      try {
        const result = await persistPlan(nextSemesters, nextPlanCatalog);
        if (result?.semesters?.length) {
          setSemesters((prev) =>
            prev.map((sem, i) => {
              const backendSem = result.semesters[i];
              return backendSem ? { ...sem, id: backendSem.id } : sem;
            })
          );
        }
        return true;
      } catch (error) {
        setPlanCatalog(planCatalog);
        setSemesters(semesters);
        throw error;
      }
    },
    [persistPlan, planCatalog, semesters]
  );

  const doUpdateProfile = useCallback(
    async (data: Partial<BackendProfile>) => {
      if (!accessToken) return;
      const updated = await apiUpdateProfile(accessToken, data);
      setProfile(updated);
      if (data.major_code) {
        try {
          const res = await fetchCourseLabels(data.major_code);
          setLabels(res.labels);
          setElectiveRules(res.rules);
        } catch {}
      }
    },
    [accessToken]
  );

  const searchCoursesCatalog = useCallback(
    async (q: string, subject?: string): Promise<Course[]> => {
      const { data } = await apiSearchCourses(q, subject, 1, 30);
      const courses = data.map((bc) => searchCourseToCourse(bc, labels, electiveRules));
      addCoursesToCatalog(courses);
      return courses;
    },
    [labels, electiveRules, addCoursesToCatalog]
  );

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      if (!accessToken) return;
      const updated = await apiUpdateProfile(accessToken, {
        major_code: data.majorCode,
        start_year: data.startYear,
        start_term: data.startTerm.toLowerCase(),
        graduation_year: data.gradYear,
        graduation_term: data.gradTerm.toLowerCase(),
        completed_courses: data.completedCourseCodes,
      });
      setProfile(updated);

      let labelsData: Record<string, CourseLabelEntry> = {};
      let rulesData: ElectiveRule[] = [];
      if (updated.major_code) {
        try {
          const res = await fetchCourseLabels(updated.major_code);
          labelsData = res.labels;
          rulesData = res.rules;
          setLabels(labelsData);
          setElectiveRules(rulesData);
        } catch {
          // labels are optional
        }
      }

      // Fetch full metadata for each completed course in parallel
      const completedCourseObjects: Course[] = [];
      if (data.completedCourseCodes.length > 0) {
        const settled = await Promise.allSettled(
          data.completedCourseCodes.map((code) =>
            apiSearchCourses(code, undefined, 1, 1).then((r) => {
              const bc = r.data[0];
              if (!bc) return null;
              return {
                ...searchCourseToCourse(bc, labelsData, rulesData),
                status: "completed" as const,
              };
            })
          )
        );
        settled.forEach((r) => {
          if (r.status === "fulfilled" && r.value) completedCourseObjects.push(r.value);
        });
      }

      // Build an initial semester scaffold from the student's timeline
      const futureSemesters = buildInitialSemesters(
        data.startTerm,
        data.startYear,
        data.gradTerm,
        data.gradYear
      );

      // If we have completed courses, put them in a past "Previous Credits" semester
      // placed just before the student's start term
      let allSemesters: Semester[] = futureSemesters;
      if (completedCourseObjects.length > 0) {
        // Completed catalog entries (status=completed, isPast)
        const completedCatalog: Record<string, Course> = {};
        completedCourseObjects.forEach((c) => { completedCatalog[c.code] = c; });
        setPlanCatalog((prev) => ({ ...completedCatalog, ...prev }));

        // Semester just before the student's start: if they start Fall → use Spring of same year
        // if they start Spring → use Fall of prior year
        const prevTerm: SemesterTerm =
          data.startTerm.toLowerCase() === "fall" ? "Spring" : "Fall";
        const prevYear =
          data.startTerm.toLowerCase() === "fall" ? data.startYear : data.startYear - 1;

        const prevSem: Semester = {
          id: `prev-credits-${prevTerm.toLowerCase()}-${prevYear}`,
          term: prevTerm,
          year: prevYear,
          courseIds: completedCourseObjects.map((c) => c.code),
          isPast: true,
          isCurrent: false,
        };
        allSemesters = [prevSem, ...futureSemesters];
      }

      setSemesters(allSemesters);

      // Persist the full scaffold (including completed semester) to the backend
      try {
        const result = await apiSavePlan(accessToken, {
          semesters: allSemesters.map((sem) => ({
            id: sem.id,
            type: sem.term.toLowerCase(),
            year: sem.year,
            label: `${sem.term} ${sem.year}`,
            startDate: null,
            endDate: semesterEndDateStr(sem.term, sem.year),
            courses: sem.courseIds.map((code) => ({
              code,
              credits: completedCourseObjects.find((c) => c.code === code)?.credits ?? 3,
              status: "completed" as const,
              grade: null,
              selectedSectionId: null,
            })),
          })),
        });
        // Sync backend-assigned IDs
        if (result?.semesters?.length) {
          setSemesters(
            allSemesters.map((sem, i) => {
              const backendSem = result.semesters[i];
              return backendSem ? { ...sem, id: backendSem.id } : sem;
            })
          );
        }
      } catch {
        // Plan save is best-effort; semesters are already set in local state
      }
    },
    [accessToken]
  );

  return (
    <PlanContext.Provider
      value={{
        profile,
        semesters,
        planCatalog,
        labels,
        majors,
        loading,
        initialized,
        setSemesters,
        addCoursesToCatalog,
        addCourseToSemester,
        updateCourse,
        savePlan,
        doUpdateProfile,
        searchCoursesCatalog,
        completeOnboarding,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
