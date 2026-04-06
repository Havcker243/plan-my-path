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
  fetchTermCalendar,
  searchCourses as apiSearchCourses,
  type BackendProfile,
  type BackendPlanCourse,
  type BackendSemester,
  type BackendCourse,
  type CourseLabelEntry,
  type ElectiveRule,
  type Major,
  type TermCalendarEntry,
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
  rules: ElectiveRule[] = [],
  termCalendar: TermCalendarEntry[] = []
): { semesters: Semester[]; catalog: Record<string, Course> } {
  const catalog: Record<string, Course> = {};
  const today = new Date();

  const semesters: Semester[] = backendSemesters.map((bs) => {
    const isPast = bs.end_date
      ? new Date(bs.end_date) < today
      : (() => {
          const termLower = (bs.term ?? "fall").toLowerCase().split(/[\s_-]/)[0];
          // Try real term calendar before estimating
          const calEntry = termCalendar.find(
            (t) => t.term.toLowerCase() === termLower && t.year === bs.year
          );
          if (calEntry?.end_date) return new Date(calEntry.end_date) < today;
          // Fall back to estimate
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

// Returns the end date string for a given term + year.
// Uses real backend calendar data when available; falls back to a fixed estimate.
function semesterEndDateStr(
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

// ─── Initial semester scaffold ────────────────────────────────────────────────

function buildInitialSemesters(
  startTerm: string,
  startYear: number,
  gradTerm: string,
  gradYear: number,
  termCalendar: TermCalendarEntry[] = []
): Semester[] {
  const today = new Date();
  const termCycle: SemesterTerm[] = ["Spring", "Summer", "Fall", "Winter"];
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

    // Stop once we've passed the graduation term
    const afterGrad =
      year > gradYear ||
      (year === gradYear && termIdx > gradTermIdx);
    if (afterGrad) break;

    // isPast: use real calendar data when available, otherwise estimate
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

    // Advance: Winter(3) → Spring(0) of next year; otherwise stay in same year
    if (termIdx === termCycle.length - 1) {
      termIdx = 0;
      year += 1;
    } else {
      termIdx += 1;
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

export interface OnboardingCourse {
  code: string;
  grade: string | null;
  /** null means "unknown" (manual entry — will be grouped into one pre-start semester) */
  term: string | null;
  year: number | null;
}

export interface OnboardingData {
  majorCode: string;
  startYear: number;
  startTerm: string;
  gradYear: number;
  gradTerm: string;
  /** Full completed-course info. grade/term/year may be null for manually-entered courses. */
  completedCourses: OnboardingCourse[];
  gpa?: number | null;
}

interface PlanContextValue {
  profile: BackendProfile | null;
  semesters: Semester[];
  /** Only courses whose code appears in at least one semester. */
  planCatalog: Record<string, Course>;
  /** Search/browse results — not in the plan unless also in planCatalog. */
  courseCache: Record<string, Course>;
  labels: Record<string, CourseLabelEntry>;
  majors: Major[];
  majorsLoading: boolean;
  majorsError: boolean;
  termCalendar: TermCalendarEntry[];
  loading: boolean;
  /** True once the first profile+plan fetch cycle has completed (even if profile is null). */
  initialized: boolean;
  /** True if the profile/plan fetch failed (network error, server error, etc.). */
  initError: boolean;
  /** True when the backend confirmed a profile was loaded successfully. */
  profileLoaded: boolean;
  setSemesters: React.Dispatch<React.SetStateAction<Semester[]>>;
  /** Adds courses to the search/browse cache only — does NOT add them to the plan. */
  addCoursesToCatalog: (courses: Course[]) => void;
  addCourseToSemester: (course: Course, semesterId: string) => Promise<boolean>;
  updateCourse: (courseCode: string, updates: Partial<Pick<Course, "status" | "grade" | "selectedSectionId">>) => void;
  savePlan: () => Promise<void>;
  doUpdateProfile: (data: Partial<BackendProfile>) => Promise<void>;
  searchCoursesCatalog: (q: string, subject?: string) => Promise<Course[]>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  importTranscript: (courses: OnboardingCourse[], gpa: number | null) => Promise<{ added: number; skipped: number }>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [planCatalog, setPlanCatalog] = useState<Record<string, Course>>({});
  const [courseCache, setCourseCache] = useState<Record<string, Course>>({});
  const [labels, setLabels] = useState<Record<string, CourseLabelEntry>>({});
  const [electiveRules, setElectiveRules] = useState<ElectiveRule[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [majorsLoading, setMajorsLoading] = useState(true);
  const [majorsError, setMajorsError] = useState(false);
  const [termCalendar, setTermCalendar] = useState<TermCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Fetch public data once on mount
  useEffect(() => {
    setMajorsLoading(true);
    setMajorsError(false);
    fetchMajors()
      .then(setMajors)
      .catch(() => {
        setMajors([]);
        setMajorsError(true);
      })
      .finally(() => setMajorsLoading(false));
    fetchTermCalendar().then(setTermCalendar).catch(() => {});
  }, []);

  // Fetch plan data whenever auth token changes
  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setSemesters([]);
      setPlanCatalog({});
      setLabels({});
      setInitialized(false);
      setInitError(false);
      setProfileLoaded(false);
      return;
    }

    setLoading(true);
    setInitError(false);
    setProfileLoaded(false);

    Promise.all([fetchProfile(accessToken), fetchPlan(accessToken), fetchTermCalendar()])
      .then(async ([prof, plan, terms]) => {
        setTermCalendar(terms);
        setProfile(prof);
        setProfileLoaded(true);

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
          const { semesters: sems, catalog } = buildSemesters(plan.semesters, labelsData, rulesData, terms);
          setSemesters(sems);
          setPlanCatalog(catalog);
        } else {
          setSemesters([]);
          setPlanCatalog({});
        }
      })
      .catch(() => {
        setInitError(true);
      })
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, [accessToken]);

  // Writes to the search/browse cache — not to planCatalog.
  // planCatalog is only written when a course is added to a semester.
  const addCoursesToCatalog = useCallback((courses: Course[]) => {
    setCourseCache((prev) => {
      const next = { ...prev };
      courses.forEach((c) => { next[c.code] = c; });
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
        endDate: semesterEndDateStr(sem.term, sem.year, termCalendar),
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
    [accessToken, planCatalog, termCalendar]
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
      if (!accessToken || !profile) return;
      // Merge with the full existing profile so fields we're not updating are preserved
      const merged: BackendProfile = { ...profile, ...data };
      const updated = await apiUpdateProfile(accessToken, merged);
      setProfile(updated);
      if (data.major_code && data.major_code !== profile.major_code) {
        try {
          const res = await fetchCourseLabels(data.major_code);
          setLabels(res.labels);
          setElectiveRules(res.rules);
        } catch {}
      }
    },
    [accessToken, profile]
  );

  const searchCoursesCatalog = useCallback(
    async (q: string, subject?: string): Promise<Course[]> => {
      const { data } = await apiSearchCourses(q, subject, 1, 30);
      const courses = data.map((bc) => searchCourseToCourse(bc, labels, electiveRules));
      // Populate the browse cache so consumers can look up metadata by code
      setCourseCache((prev) => {
        const next = { ...prev };
        courses.forEach((c) => { next[c.code] = c; });
        return next;
      });
      return courses;
    },
    [labels, electiveRules]
  );

  /**
   * Import a parsed transcript into an existing plan.
   * Creates past semesters for each term found, preserving existing plan structure.
   * Skips courses already present in the plan.
   */
  const importTranscript = useCallback(
    async (courses: OnboardingCourse[], gpa: number | null): Promise<{ added: number; skipped: number }> => {
      if (!accessToken) throw new Error("Not authenticated");

      // Fetch metadata for all incoming codes
      const metaByCode: Record<string, Course> = {};
      await Promise.allSettled(
        courses.map((oc) =>
          apiSearchCourses(oc.code, undefined, 1, 1).then((r) => {
            const bc = r.data[0];
            if (bc) metaByCode[bc.course_code] = {
              ...searchCourseToCourse(bc, labels, electiveRules),
              status: "completed" as const,
            };
          })
        )
      );

      // Current plan state (read-only snapshots for closure safety)
      const prevSemesters = semesters;
      const prevCatalog = planCatalog;
      let nextSemesters = [...semesters];
      const nextCatalog = { ...planCatalog };
      let added = 0;
      let skipped = 0;

      // Group incoming courses by term/year
      const TERM_ORDER_MAP: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2, Winter: 3 };
      const groups = new Map<string, { term: SemesterTerm; year: number; courses: OnboardingCourse[] }>();

      for (const oc of courses) {
        if (!oc.term || !oc.year) continue; // skip courses without term info
        const normTerm = capitalizeTerm(oc.term) as SemesterTerm;
        const key = `${oc.year}-${TERM_ORDER_MAP[normTerm] ?? 9}-${normTerm}`;
        if (!groups.has(key)) groups.set(key, { term: normTerm, year: oc.year, courses: [] });
        groups.get(key)!.courses.push(oc);
      }

      for (const { term, year, courses: groupCourses } of groups.values()) {
        // Find existing semester for this term/year or create one
        let sem = nextSemesters.find((s) => s.term === term && s.year === year);
        if (!sem) {
          sem = {
            id: `import-${term.toLowerCase()}-${year}-${Math.random().toString(36).slice(2, 6)}`,
            term,
            year,
            courseIds: [],
            isPast: true,
            isCurrent: false,
          };
          nextSemesters = [...nextSemesters, sem];
        }

        for (const oc of groupCourses) {
          if (sem.courseIds.includes(oc.code)) { skipped++; continue; }
          const meta = metaByCode[oc.code];
          if (!meta) { skipped++; continue; }

          nextCatalog[oc.code] = { ...meta, status: "completed", grade: oc.grade ?? null };
          sem = { ...sem, courseIds: [...sem.courseIds, oc.code] };
          // Reflect updated sem back into nextSemesters
          nextSemesters = nextSemesters.map((s) => (s.id === sem!.id ? sem! : s));
          added++;
        }
      }

      // Sort semesters chronologically
      nextSemesters.sort((a, b) =>
        a.year !== b.year
          ? a.year - b.year
          : (TERM_ORDER_MAP[a.term] ?? 9) - (TERM_ORDER_MAP[b.term] ?? 9)
      );

      if (added === 0) {
        return { added: 0, skipped };
      }

      setPlanCatalog(nextCatalog);
      setSemesters(nextSemesters);

      try {
        if (profile) {
          const existingCompleted = new Set(profile.completed_courses ?? []);
          courses.forEach((course) => existingCompleted.add(course.code));
          const updatedProfile = await apiUpdateProfile(accessToken, {
            ...profile,
            completed_courses: Array.from(existingCompleted),
            ...(gpa !== null ? { gpa } : {}),
          });
          setProfile(updatedProfile);
        }

        const result = await persistPlan(nextSemesters, nextCatalog);
        if (!result) {
          throw new Error("Plan save returned no data");
        }

        if (result.semesters?.length) {
          const { semesters: savedSemesters, catalog: savedCatalog } = buildSemesters(
            result.semesters,
            labels,
            electiveRules,
            termCalendar
          );
          setSemesters(savedSemesters);
          setPlanCatalog((prev) => ({ ...prev, ...savedCatalog }));
        }
      } catch (error) {
        setPlanCatalog(prevCatalog);
        setSemesters(prevSemesters);
        throw error;
      }

      return { added, skipped };
    },
    [accessToken, semesters, planCatalog, labels, electiveRules, persistPlan, profile, termCalendar]
  );

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      if (!accessToken) return;

      const allCodes = data.completedCourses.map((c) => c.code);

      const updated = await apiUpdateProfile(accessToken, {
        major_code: data.majorCode,
        start_year: data.startYear,
        start_term: data.startTerm.toLowerCase(),
        graduation_year: data.gradYear,
        graduation_term: data.gradTerm.toLowerCase(),
        completed_courses: allCodes,
        ...(data.gpa != null ? { gpa: data.gpa } : {}),
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

      // Fetch full catalog metadata for each completed course
      const metaByCode: Record<string, Course> = {};
      if (allCodes.length > 0) {
        const settled = await Promise.allSettled(
          allCodes.map((code) =>
            apiSearchCourses(code, undefined, 1, 1).then((r) => {
              const bc = r.data[0];
              if (!bc) return null;
              return { ...searchCourseToCourse(bc, labelsData, rulesData), status: "completed" as const };
            })
          )
        );
        settled.forEach((r) => {
          if (r.status === "fulfilled" && r.value) metaByCode[r.value.code] = r.value;
        });
      }

      // ── Group completed courses by their actual term/year ──────────────────
      // Courses with known term (from transcript) go into their real semester.
      // Courses with no term (manual entry) go into a single "prev credits" bucket.
      const TERM_ORDER_MAP: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2, Winter: 3 };
      const termGroups = new Map<string, { term: string; year: number; courses: OnboardingCourse[] }>();

      for (const oc of data.completedCourses) {
        let key: string;
        let term: string;
        let year: number;

        if (oc.term && oc.year) {
          // Known term from transcript
          const normTerm = capitalizeTerm(oc.term);
          key = `${oc.year}-${TERM_ORDER_MAP[normTerm] ?? 9}-${normTerm}`;
          term = normTerm;
          year = oc.year;
        } else {
          // Manual entry — place just before start term
          const allTerms: SemesterTerm[] = ["Spring", "Summer", "Fall", "Winter"];
          const startNorm = capitalizeTerm(data.startTerm);
          const startIdx = allTerms.indexOf(startNorm);
          const prevIdx = (startIdx - 1 + allTerms.length) % allTerms.length;
          term = allTerms[prevIdx];
          year = prevIdx === allTerms.length - 1 ? data.startYear - 1 : data.startYear;
          key = `manual-prev`;
        }

        if (!termGroups.has(key)) termGroups.set(key, { term, year, courses: [] });
        termGroups.get(key)!.courses.push(oc);
      }

      // Sort term groups chronologically
      const sortedGroups = [...termGroups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, g]) => g);

      // Build past semesters — one per term group
      const pastSemesters: Semester[] = sortedGroups.map(({ term, year, courses }) => ({
        id: `past-${term.toLowerCase()}-${year}-${Math.random().toString(36).slice(2, 6)}`,
        term: term as SemesterTerm,
        year,
        courseIds: courses.map((c) => c.code),
        isPast: true,
        isCurrent: false,
      }));

      // Populate planCatalog with completed entries (preserving grade from transcript)
      const completedCatalog: Record<string, Course> = {};
      for (const oc of data.completedCourses) {
        const meta = metaByCode[oc.code];
        if (meta) {
          completedCatalog[oc.code] = { ...meta, status: "completed", grade: oc.grade ?? meta.grade };
        }
      }
      if (Object.keys(completedCatalog).length > 0) {
        setPlanCatalog((prev) => ({ ...completedCatalog, ...prev }));
      }

      // ── Build scaffold for future semesters ────────────────────────────────
      const futureSemesters = buildInitialSemesters(
        data.startTerm, data.startYear, data.gradTerm, data.gradYear, termCalendar
      );

      const allSemesters: Semester[] = [...pastSemesters, ...futureSemesters];
      setSemesters(allSemesters);

      // ── Persist to backend ─────────────────────────────────────────────────
      // Build a lookup: course code → OnboardingCourse (for grade/credits)
      const ocByCode = new Map(data.completedCourses.map((c) => [c.code, c]));

      try {
        const result = await apiSavePlan(accessToken, {
          semesters: allSemesters.map((sem) => ({
            id: sem.id,
            type: sem.term.toLowerCase(),
            year: sem.year,
            label: `${sem.term} ${sem.year}`,
            startDate: null,
            endDate: semesterEndDateStr(sem.term, sem.year, termCalendar),
            courses: sem.courseIds.map((code) => {
              const oc = ocByCode.get(code);
              return {
                code,
                credits: metaByCode[code]?.credits ?? 3,
                status: "completed" as const,
                grade: oc?.grade ?? null,
                selectedSectionId: null,
              };
            }),
          })),
        });
        if (result?.semesters?.length) {
          setSemesters(
            allSemesters.map((sem, i) => {
              const backendSem = result.semesters[i];
              return backendSem ? { ...sem, id: backendSem.id } : sem;
            })
          );
        }
      } catch {
        // Plan save is best-effort
      }
    },
    [accessToken, termCalendar]
  );

  return (
    <PlanContext.Provider
      value={{
        profile,
        semesters,
        planCatalog,
        courseCache,
        labels,
        majors,
        majorsLoading,
        majorsError,
        termCalendar,
        loading,
        initialized,
        initError,
        profileLoaded,
        setSemesters,
        addCoursesToCatalog,
        addCourseToSemester,
        updateCourse,
        savePlan,
        doUpdateProfile,
        searchCoursesCatalog,
        completeOnboarding,
        importTranscript,
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
