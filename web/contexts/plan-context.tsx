"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";
import {
  fetchProfile,
  updateProfile as apiUpdateProfile,
  fetchPlan,
  savePlan as apiSavePlan,
  fetchCourseLabels,
  fetchCoursesBySubject,
  fetchSections,
  fetchMajors,
  fetchTermCalendar,
  searchCourses as apiSearchCourses,
  type BackendProfile,
  type BackendPlanCourse,
  type BackendSemester,
  type BackendCourse,
  type BackendSection,
  type BackendSubjectCourse,
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

function normalizeCourseCode(code: string): string {
  return code.replace(/[-\s]+/g, " ").trim().toUpperCase();
}

function sameCourseCode(a: string, b: string): boolean {
  return normalizeCourseCode(a) === normalizeCourseCode(b);
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
  const normalizedCode = normalizeCourseCode(code);

  for (const [labelCode, entry] of Object.entries(labels)) {
    if (normalizeCourseCode(labelCode) === normalizedCode) {
      return mapBackendLabel(entry);
    }
  }

  const { subject, level } = parseCodeParts(normalizedCode);

  for (const rule of rules) {
    if (
      subject.toUpperCase() === rule.subject_code.toUpperCase() &&
      level >= rule.min_level &&
      (rule.max_level == null || level <= rule.max_level) &&
      !rule.exclude_courses.some((excluded) => normalizeCourseCode(excluded) === normalizedCode)
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

function normalizePrereqs(requisites: unknown): string[] {
  if (!requisites) return [];
  if (Array.isArray(requisites)) {
    const deduped = new Set<string>();
    requisites.forEach((value) => {
      extractCourseCodes(String(value)).forEach((code) => deduped.add(code));
    });
    return Array.from(deduped);
  }
  if (typeof requisites === "string") {
    return extractCourseCodes(requisites);
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

function subjectCourseToCourse(
  bc: BackendSubjectCourse,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[] = []
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
    offeredTerms: (bc.offeredTerms ?? []).map(capitalizeTerm) as SemesterTerm[],
    subject,
    level,
  };
}

async function fetchCatalogMetadataForTranscriptCourses(
  courses: OnboardingCourse[],
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[]
): Promise<Record<string, Course>> {
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
      const course = subjectCourseToCourse(row, labels, rules);
      catalogByNormalizedCode[normalizeCourseCode(course.code)] = course;
    });
  });

  const metaByRequestedCode: Record<string, Course> = {};
  courses.forEach((course) => {
    const matched = catalogByNormalizedCode[normalizeCourseCode(course.code)];
    if (matched) {
      metaByRequestedCode[course.code] = matched;
    }
  });

  return metaByRequestedCode;
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
  // Only scaffold Spring and Fall — students almost never take Summer/Winter
  // by default. Those can be added manually from the planner.
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
  /** Total credits required for the current major — pulled from DB, falls back to 120. */
  degreeCreditTotal: number;
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
  loadSectionsForCourses: (courseCodes: string[], term?: string) => Promise<Record<string, BackendSection[]>>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  importTranscript: (courses: OnboardingCourse[], gpa: number | null) => Promise<{ added: number; skipped: number }>;
  clearPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function isSemesterPast(
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

function previousSemester(term: SemesterTerm, year: number): { term: SemesterTerm; year: number } {
  const allTerms: SemesterTerm[] = ["Spring", "Summer", "Fall", "Winter"];
  const index = allTerms.indexOf(term);
  const prevIndex = (index - 1 + allTerms.length) % allTerms.length;
  return {
    term: allTerms[prevIndex],
    year: prevIndex === allTerms.length - 1 ? year - 1 : year,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth();
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [planCatalog, setPlanCatalog] = useState<Record<string, Course>>({});
  const [courseCache, setCourseCache] = useState<Record<string, Course>>({});
  const [labels, setLabels] = useState<Record<string, CourseLabelEntry>>({});
  const [electiveRules, setElectiveRules] = useState<ElectiveRule[]>([]);
  const [degreeCreditTotal, setDegreeCreditTotal] = useState(120);
  const [majors, setMajors] = useState<Major[]>([]);
  const [majorsLoading, setMajorsLoading] = useState(true);
  const [majorsError, setMajorsError] = useState(false);
  const [termCalendar, setTermCalendar] = useState<TermCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const termCalendarPromiseRef = useRef<Promise<TermCalendarEntry[]> | null>(null);
  const termCalendarRef = useRef<TermCalendarEntry[]>([]);
  const accessTokenRef = useRef<string | null>(accessToken);
  const searchQueryCacheRef = useRef<Record<string, Course[]>>({});
  const sectionsCacheRef = useRef<Record<string, BackendSection[]>>({});

  const loadTermCalendar = useCallback(async () => {
    if (termCalendarRef.current.length > 0) return termCalendarRef.current;
    if (!termCalendarPromiseRef.current) {
      termCalendarPromiseRef.current = fetchTermCalendar()
        .then((terms) => {
          termCalendarRef.current = terms;
          setTermCalendar(terms);
          return terms;
        })
        .finally(() => {
          termCalendarPromiseRef.current = null;
        });
    }
    return termCalendarPromiseRef.current;
  }, []);

  useEffect(() => {
    termCalendarRef.current = termCalendar;
  }, [termCalendar]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

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
    loadTermCalendar().catch(() => {});
  }, [loadTermCalendar]);

  // Fetch plan data whenever auth token changes
  useEffect(() => {
    if (!user?.id) {
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

    const token = accessTokenRef.current;
    if (!token) {
      setLoading(false);
      setInitialized(true);
      return;
    }

    Promise.all([fetchProfile(token), fetchPlan(token), loadTermCalendar()])
      .then(async ([prof, plan, terms]) => {
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
            setDegreeCreditTotal(res.total_credits ?? 120);
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
  }, [user?.id, loadTermCalendar]);

  useEffect(() => {
    searchQueryCacheRef.current = {};
  }, [labels, electiveRules]);

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
          credits: Number.isFinite(nextPlanCatalog[code]?.credits) ? nextPlanCatalog[code]!.credits : 3,
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
          setDegreeCreditTotal(res.total_credits ?? 120);
          // Re-resolve labels for every course already in the plan so the UI
          // immediately reflects the new major's requirements without a page reload.
          setPlanCatalog((prev) => {
            const next = { ...prev };
            for (const code of Object.keys(next)) {
              next[code] = { ...next[code], label: resolveLabel(code, res.labels, res.rules) };
            }
            return next;
          });
        } catch {
          // Labels are optional; keep the current UI usable if this fetch fails.
        }
      }
    },
    [accessToken, profile]
  );

  const searchCoursesCatalog = useCallback(
    async (q: string, subject?: string): Promise<Course[]> => {
      const cacheKey = `${subject ?? ""}::${q.trim().toUpperCase()}`;
      const cached = searchQueryCacheRef.current[cacheKey];
      if (cached) {
        setCourseCache((prev) => {
          const next = { ...prev };
          cached.forEach((c) => { next[c.code] = c; });
          return next;
        });
        return cached;
      }

      const { data } = await apiSearchCourses(q, subject, 1, 30);
      const courses = data.map((bc) => searchCourseToCourse(bc, labels, electiveRules));
      searchQueryCacheRef.current[cacheKey] = courses;
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

  const loadSectionsForCourses = useCallback(
    async (courseCodes: string[], term?: string): Promise<Record<string, BackendSection[]>> => {
      const normalizedCodes = Array.from(
        new Set(courseCodes.map((code) => code.trim()).filter(Boolean))
      );
      if (normalizedCodes.length === 0) return {};

      const nextResult: Record<string, BackendSection[]> = {};
      const missingCodes: string[] = [];

      normalizedCodes.forEach((code) => {
        const cacheKey = `${term ?? ""}::${code}`;
        const cached = sectionsCacheRef.current[cacheKey];
        if (cached) nextResult[code] = cached;
        else missingCodes.push(code);
      });

      if (missingCodes.length > 0) {
        const fetched = await fetchSections(missingCodes, term);
        missingCodes.forEach((code) => {
          const sections = fetched[code] ?? [];
          sectionsCacheRef.current[`${term ?? ""}::${code}`] = sections;
          nextResult[code] = sections;
        });
      }

      return nextResult;
    },
    []
  );

  /**
   * Import a parsed transcript into an existing plan.
   * Creates past semesters for each term found, preserving existing plan structure.
   * Skips courses already present in the plan.
   */
  const importTranscript = useCallback(
    async (courses: OnboardingCourse[], gpa: number | null): Promise<{ added: number; skipped: number }> => {
      if (!accessToken) throw new Error("Not authenticated");

      const metaByCode = await fetchCatalogMetadataForTranscriptCourses(courses, labels, electiveRules);

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
      const fallbackSemester = (() => {
        if (profile?.start_term && profile?.start_year) {
          const startTerm = capitalizeTerm(profile.start_term);
          return previousSemester(startTerm, profile.start_year);
        }
        const earliestSemester = [...semesters].sort((a, b) =>
          a.year !== b.year ? a.year - b.year : TERM_ORDER_MAP[a.term] - TERM_ORDER_MAP[b.term]
        )[0];
        return earliestSemester
          ? previousSemester(earliestSemester.term, earliestSemester.year)
          : { term: "Fall" as SemesterTerm, year: new Date().getFullYear() - 1 };
      })();

      for (const oc of courses) {
        const normTerm = oc.term ? capitalizeTerm(oc.term) as SemesterTerm : fallbackSemester.term;
        const year = oc.year ?? fallbackSemester.year;
        const key = `${year}-${TERM_ORDER_MAP[normTerm] ?? 9}-${normTerm}`;
        if (!groups.has(key)) groups.set(key, { term: normTerm, year, courses: [] });
        groups.get(key)!.courses.push(oc);
      }

      for (const { term, year, courses: groupCourses } of groups.values()) {
        // Find an existing semester for this term/year.
        // Do NOT create it yet — only create it when we know at least one course
        // will actually be added (prevents empty ghost semesters).
        let sem = nextSemesters.find((s) => s.term === term && s.year === year);

        for (const oc of groupCourses) {
          const meta = metaByCode[oc.code];
          const plannerCode = meta?.code ?? oc.code;

          // Only truly skip if metadata is already in the catalog.
          // A course may be in sem.courseIds (from onboarding) but missing from
          // planCatalog (if the old key-mismatch bug prevented metadata loading).
          // In that case we still need to populate the catalog.
          const existingCatalogCode = Object.keys(nextCatalog).find((code) => sameCourseCode(code, plannerCode));
          const alreadyInSemesters = nextSemesters.some((semester) =>
            semester.courseIds.some((courseId) => sameCourseCode(courseId, plannerCode))
          );
          const alreadyInCatalog = existingCatalogCode !== undefined || alreadyInSemesters;
          if (alreadyInCatalog) { skipped++; continue; }

          // Build course entry: DB metadata when available, transcript data as authoritative fallback.
          // Never skip a course just because it isn't in our DB catalog.
          const { subject, level } = parseCodeParts(plannerCode);
          const courseStatus = oc.status ?? (oc.grade ? "completed" : "planned");
          const courseEntry: Course = meta
            ? {
                ...meta,
                status: courseStatus,
                grade: courseStatus === "completed" ? (oc.grade ?? null) : null,
                title: oc.title?.trim() ? oc.title : meta.title,
                credits: Number.isFinite(oc.credits) ? oc.credits! : meta.credits,
              }
            : {
                id: plannerCode,
                code: plannerCode,
                title: oc.title ?? plannerCode,
                credits: Number.isFinite(oc.credits) ? oc.credits! : 3,
                label: resolveLabel(plannerCode, labels, electiveRules),
                status: courseStatus,
                grade: courseStatus === "completed" ? (oc.grade ?? null) : null,
                selectedSectionId: null,
                description: "",
                prereqs: [],
                offeredTerms: [],
                subject,
                level,
            };

          // Lazy-create the semester on the first course we successfully add
          if (!sem) {
            sem = {
              id: `import-${term.toLowerCase()}-${year}-${Math.random().toString(36).slice(2, 6)}`,
              term,
              year,
              courseIds: [],
              isPast: isSemesterPast(term, year, termCalendar),
              isCurrent: false,
            };
            nextSemesters = [...nextSemesters, sem];
          }

          nextCatalog[plannerCode] = courseEntry;

          // Only append to courseIds if not already there (avoids duplicates)
          if (!sem.courseIds.some((courseId) => sameCourseCode(courseId, plannerCode))) {
            sem = { ...sem, courseIds: [...sem.courseIds, plannerCode] };
            nextSemesters = nextSemesters.map((s) => (s.id === sem!.id ? sem! : s));
          }
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
          courses
            .filter((course) => (course.status ?? (course.grade ? "completed" : "planned")) === "completed")
            .forEach((course) => existingCompleted.add(metaByCode[course.code]?.code ?? course.code));
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

      const updated = await apiUpdateProfile(accessToken, {
        major_code: data.majorCode,
        start_year: data.startYear,
        start_term: data.startTerm.toLowerCase(),
        graduation_year: data.gradYear,
        graduation_term: data.gradTerm.toLowerCase(),
        completed_courses: [],
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
          setDegreeCreditTotal(res.total_credits ?? 120);
        } catch {
          // labels are optional
        }
      }

      const metaByCode = await fetchCatalogMetadataForTranscriptCourses(
        data.completedCourses,
        labelsData,
        rulesData
      );

      const normalizedCourses = data.completedCourses.map((course) => ({
        source: course,
        plannerCode: metaByCode[course.code]?.code ?? course.code,
        meta: metaByCode[course.code],
      }));

      const completedCourseCodes = normalizedCourses
        .filter(({ source }) => (source.status ?? (source.grade ? "completed" : "planned")) === "completed")
        .map(({ plannerCode }) => plannerCode);

      const persistedProfile = await apiUpdateProfile(accessToken, {
        ...updated,
        completed_courses: completedCourseCodes,
      });
      setProfile(persistedProfile);

      // ── Group completed courses by their actual term/year ──────────────────
      // Courses with known term (from transcript) go into their real semester.
      // Courses with no term (manual entry) go into a single "prev credits" bucket.
      const TERM_ORDER_MAP: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2, Winter: 3 };
      const termGroups = new Map<string, { term: string; year: number; courses: OnboardingCourse[] }>();

      for (const { source: oc } of normalizedCourses) {
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
        courseIds: courses.map((c) => metaByCode[c.code]?.code ?? c.code),
        isPast: isSemesterPast(term as SemesterTerm, year, termCalendar),
        isCurrent: false,
      }));

      // Populate planCatalog with completed entries (preserving grade from transcript).
      // Transcript data (title, credits) is authoritative — never skip a course.
      const completedCatalog: Record<string, Course> = {};
      for (const { source: oc, plannerCode, meta } of normalizedCourses) {
        const { subject, level } = parseCodeParts(plannerCode);
        const courseStatus = oc.status ?? (oc.grade ? "completed" : "planned");
        completedCatalog[plannerCode] = meta
          ? {
              ...meta,
              status: courseStatus,
              grade: courseStatus === "completed" ? (oc.grade ?? meta.grade) : null,
              title: oc.title?.trim() ? oc.title : meta.title,
              credits: Number.isFinite(oc.credits) ? oc.credits! : meta.credits,
            }
          : {
              id: plannerCode,
              code: plannerCode,
              title: oc.title ?? plannerCode,
              credits: Number.isFinite(oc.credits) ? oc.credits! : 3,
              label: resolveLabel(plannerCode, labelsData, rulesData),
              status: courseStatus,
              grade: courseStatus === "completed" ? (oc.grade ?? null) : null,
              selectedSectionId: null,
              description: "",
              prereqs: [],
              offeredTerms: [],
              subject,
              level,
            };
      }
      if (Object.keys(completedCatalog).length > 0) {
        setPlanCatalog((prev) => ({ ...completedCatalog, ...prev }));
      }

      // ── Build scaffold for future semesters ────────────────────────────────
      const futureSemesters = buildInitialSemesters(
        data.startTerm, data.startYear, data.gradTerm, data.gradYear, termCalendar
      ).filter(
        (semester) =>
          !pastSemesters.some(
            (existing) => existing.term === semester.term && existing.year === semester.year
          )
      );

      const allSemesters: Semester[] = [...pastSemesters, ...futureSemesters];
      setSemesters(allSemesters);

      // ── Persist to backend ─────────────────────────────────────────────────
      // Build a lookup: course code → OnboardingCourse (for grade/credits)
      const ocByCode = new Map(normalizedCourses.map(({ plannerCode, source }) => [plannerCode, source]));

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
                credits: Number.isFinite(completedCatalog[code]?.credits) ? completedCatalog[code]!.credits : 3,
                status: completedCatalog[code]?.status ?? "planned",
                grade: completedCatalog[code]?.status === "completed" ? (oc?.grade ?? null) : null,
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

  const clearPlan = useCallback(async () => {
    if (!accessToken) return;

    const prevSemesters = semesters;
    const prevPlanCatalog = planCatalog;
    const prevProfile = profile;

    setSemesters([]);
    setPlanCatalog({});

    try {
      if (profile) {
        const updatedProfile = await apiUpdateProfile(accessToken, {
          ...profile,
          completed_courses: [],
          gpa: null,
        });
        setProfile(updatedProfile);
      }

      await apiSavePlan(accessToken, { semesters: [] });
    } catch (error) {
      setSemesters(prevSemesters);
      setPlanCatalog(prevPlanCatalog);
      setProfile(prevProfile);
      throw error;
    }
  }, [accessToken, semesters, planCatalog, profile]);

  return (
    <PlanContext.Provider
      value={{
        profile,
        semesters,
        planCatalog,
        courseCache,
        labels,
        degreeCreditTotal,
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
        loadSectionsForCourses,
        completeOnboarding,
        importTranscript,
        clearPlan,
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
