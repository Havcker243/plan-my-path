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
  fetchSections,
  fetchMajors,
  fetchTermCalendar,
  searchCourses as apiSearchCourses,
  type BackendProfile,
  type BackendSection,
  type CourseLabelEntry,
  type ElectiveRule,
  type Major,
  type TermCalendarEntry,
} from "@/lib/api";
import type { Course, Semester, SemesterTerm } from "@/lib/data";
import { capitalizeTerm, parseCodeParts, resolveLabel } from "@/lib/course-utils";
import { groupCoursesByTerm, buildCourseEntry, TERM_ORDER, type OnboardingCourse } from "@/lib/transcript";
import {
  searchCourseToCourse,
  buildSemesters,
  buildInitialSemesters,
  isSemesterPast,
  semesterEndDateStr,
  fetchCatalogMetadataForTranscriptCourses,
} from "@/lib/api-adapters";
import {
  addCourseToSemesterState,
  buildSavePlanPayload,
  getTranscriptFallbackSemester,
  sameCourseCode,
  syncSemesterIdsFromBackend,
} from "@/lib/plan-state";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Context types ─────────────────────────────────────────────────────────────

// OnboardingCourse is defined in lib/transcript and re-exported from there.
export type { OnboardingCourse };

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
      const result = await apiSavePlan(
        accessToken,
        buildSavePlanPayload(nextSemesters, nextPlanCatalog, termCalendar)
      );
      return result;
    },
    [accessToken, planCatalog, termCalendar]
  );

  const savePlan = useCallback(async () => {
    const result = await persistPlan(semesters, planCatalog);
    // Sync IDs that the backend may have assigned (e.g. new semester rows)
    if (result?.semesters?.length) {
      setSemesters((prev) => syncSemesterIdsFromBackend(prev, result.semesters));
    }
  }, [persistPlan, semesters, planCatalog]);

  const addCourseToSemester = useCallback(
    async (course: Course, semesterId: string) => {
      const nextState = addCourseToSemesterState(semesters, planCatalog, course, semesterId);
      if (!nextState.ok) return false;
      const { semesters: nextSemesters, planCatalog: nextPlanCatalog } = nextState;

      setPlanCatalog(nextPlanCatalog);
      setSemesters(nextSemesters);

      try {
        const result = await persistPlan(nextSemesters, nextPlanCatalog);
        if (result?.semesters?.length) {
          setSemesters((prev) => syncSemesterIdsFromBackend(prev, result.semesters));
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
      const fallbackSemester = getTranscriptFallbackSemester(
        profile?.start_term,
        profile?.start_year,
        semesters
      );

      const groups = groupCoursesByTerm(courses, fallbackSemester);

      for (const { term, year, courses: groupCourses } of groups.values()) {
        // Find an existing semester for this term/year.
        // Do NOT create it yet — only create it when we know at least one course
        // will actually be added (prevents empty ghost semesters).
        let sem = nextSemesters.find((s) => s.term === term && s.year === year);

        for (const oc of groupCourses) {
          const meta = metaByCode[oc.code];
          const code = meta?.code ?? oc.code;

          // Only truly skip if metadata is already in the catalog.
          // A course may be in sem.courseIds (from onboarding) but missing from
          // planCatalog (if the old key-mismatch bug prevented metadata loading).
          // In that case we still need to populate the catalog.
          const existingCatalogCode = Object.keys(nextCatalog).find((c) => sameCourseCode(c, code));
          const alreadyInSemesters = nextSemesters.some((semester) =>
            semester.courseIds.some((courseId) => sameCourseCode(courseId, code))
          );
          const alreadyInCatalog = existingCatalogCode !== undefined || alreadyInSemesters;
          if (alreadyInCatalog) { skipped++; continue; }

          // Build course entry: DB metadata when available, transcript data as authoritative fallback.
          // Never skip a course just because it isn't in our DB catalog.
          const courseEntry = buildCourseEntry(oc, code, meta, labels, electiveRules);

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

          nextCatalog[code] = courseEntry;

          // Only append to courseIds if not already there (avoids duplicates)
          if (!sem.courseIds.some((courseId) => sameCourseCode(courseId, code))) {
            sem = { ...sem, courseIds: [...sem.courseIds, code] };
            nextSemesters = nextSemesters.map((s) => (s.id === sem!.id ? sem! : s));
          }
          added++;
        }
      }

      // Sort semesters chronologically
      nextSemesters.sort((a, b) =>
        a.year !== b.year
          ? a.year - b.year
          : (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9)
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
      const termGroups = new Map<string, { term: string; year: number; courses: OnboardingCourse[] }>();

      for (const { source: oc } of normalizedCourses) {
        let key: string;
        let term: string;
        let year: number;

        if (oc.term && oc.year) {
          // Known term from transcript
          const normTerm = capitalizeTerm(oc.term);
          key = `${oc.year}-${TERM_ORDER[normTerm] ?? 9}-${normTerm}`;
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
