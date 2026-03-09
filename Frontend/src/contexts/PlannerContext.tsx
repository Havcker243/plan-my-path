import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0,
};
import { Course, Plan, Semester, PlannedCourse, OnboardingData, StudentProfile } from '@/types/planner';
import type { ProfilePayload } from '@/lib/api';
import { fetchCourses, fetchPlan, fetchTermCalendar, updatePlan } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface PlannerContextType {
  // State
  currentPlan: Plan | null;
  semesters: Semester[];
  studentProfile: StudentProfile | null;
  isOnboarded: boolean;
  selectedCourse: PlannedCourse | null;

  // Actions
  moveCourse: (courseId: string, fromSemesterId: string, toSemesterId: string) => void;
  removeCourse: (courseId: string, semesterId: string) => void;
  addCourse: (course: PlannedCourse, semesterId: string) => void;
  markCourseCompleted: (courseId: string, grade: string) => void;
  setSelectedCourse: (course: PlannedCourse | null) => void;
  generatePlan: () => void;
  resetPlan: () => void;
  loadCourses: (subjectCode: string | null) => Promise<void>;
  addSemester: (semester: Semester) => void;
  createSemester: (term: Semester['type'], year: number) => Semester;
  replaceSemesters: (semesters: Semester[]) => void;
  hydrateProfile: (profile: ProfilePayload) => void;
  savePlan: () => Promise<void>;

  // Computed
  totalCredits: number;
  earnedCredits: number;
  currentGPA: number;
  totalCourses: number;
  availableCourses: Course[];
}

const PlannerContext = createContext<PlannerContextType | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [termCalendar, setTermCalendar] = useState<Array<{ term: string; year: number; start_date: string; end_date: string }>>([]);
  const { accessToken, user } = useAuth();

  const loadCourses = useCallback(async (subjectCode: string | null) => {
    if (!subjectCode) {
      setAvailableCourses([]);
      return;
    }
    try {
      const courses = await fetchCourses(subjectCode);
      if (courses.length) {
        setAvailableCourses(courses);
      } else {
        setAvailableCourses([]);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  }, []);

  useEffect(() => {
    if (!studentProfile?.majorId) return;
    if (studentProfile.majorId === 'UNDECLARED') {
      setAvailableCourses([]);
      return;
    }
    void loadCourses(studentProfile.majorId);
  }, [studentProfile, loadCourses]);

  useEffect(() => {
    fetchTermCalendar()
      .then(setTermCalendar)
      .catch(() => setTermCalendar([]));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    fetchPlan(accessToken)
      .then((plan) => {
        if (!plan) return;
        const normalizedSemesters: Semester[] = plan.semesters.map((semester) => ({
          id: semester.id,
          type: semester.term.toLowerCase() as Semester['type'],
          year: semester.year,
          label: semester.label,
          startDate: semester.start_date ?? null,
          endDate: semester.end_date ?? null,
          courses: semester.courses.map((course) => ({
            id: course.id,
            code: course.code,
            title: course.title,
            credits: course.credits,
            description: course.description ?? undefined,
            prerequisites: course.prerequisites ?? [],
            offeredTerms: course.offeredTerms ?? ['fall', 'spring'],
            type: (course.type ?? 'core') as PlannedCourse['type'],
            requirementBucket: course.requirementBucket ?? undefined,
            status: (course.status as PlannedCourse['status']) ?? 'planned',
            grade: course.grade ?? undefined,
            gradePoints: course.grade ? (GRADE_POINTS[course.grade] ?? 0) : 0,
            semesterId: semester.id,
            selectedSectionId: course.selectedSectionId ?? null,
          })),
        }));
        const order = { spring: 1, summer: 2, fall: 3, winter: 4 } as const;
        normalizedSemesters.sort(
          (a, b) => (a.year - b.year) || (order[a.type] - order[b.type])
        );
        setSemesters(normalizedSemesters);
        setCurrentPlan({
          id: plan.id,
          name: plan.name,
          majorId: studentProfile?.majorId ?? 'UNDECLARED',
          semesters: normalizedSemesters,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        });
      })
      .catch(() => null);
  }, [accessToken, studentProfile?.majorId]);

  const resolveTermDates = useCallback((term: Semester['type'], year: number) => {
    const found = termCalendar.find(
      (entry) => entry.term.toLowerCase() === term && entry.year === year
    );
    return {
      startDate: found?.start_date ?? null,
      endDate: found?.end_date ?? null,
    };
  }, [termCalendar]);

  const buildSemester = (term: Semester['type'], year: number) => {
    const dates = resolveTermDates(term, year);
    return {
    id: `${term}-${year}-${Math.random().toString(36).slice(2, 8)}`,
    type: term,
    year,
    label: `${term.charAt(0).toUpperCase() + term.slice(1)} ${year}`,
    courses: [],
    startDate: dates.startDate,
    endDate: dates.endDate,
  };
  };

  const addSemester = useCallback((semester: Semester) => {
    setSemesters((prev) => {
      const next = [...prev, semester];
      const order = { spring: 1, summer: 2, fall: 3, winter: 4 } as const;
      next.sort((a, b) => (a.year - b.year) || (order[a.type] - order[b.type]));
      return next;
    });
  }, []);

  const replaceSemesters = useCallback((nextSemesters: Semester[]) => {
    const order = { spring: 1, summer: 2, fall: 3, winter: 4 } as const;
    const normalized = nextSemesters
      .map((semester) => ({
        ...semester,
        courses: semester.courses.map((course) => ({
          ...course,
          semesterId: semester.id,
        })),
      }))
      .sort((a, b) => (a.year - b.year) || (order[a.type] - order[b.type]));

    setSemesters(normalized);
    setCurrentPlan((prev) =>
      prev
        ? {
            ...prev,
            semesters: normalized,
            updatedAt: new Date(),
          }
        : prev
    );
  }, []);

  const createSemester = useCallback(
    (term: Semester['type'], year: number) => buildSemester(term, year),
    [buildSemester]
  );

  const completeOnboarding = useCallback((data: OnboardingData): Semester => {
    const subjectCode = data.majorId === 'UNDECLARED' ? null : data.majorId;
    if (subjectCode) {
      void loadCourses(subjectCode);
    }

    // Map completed course IDs to PlannedCourse objects using availableCourses
    const completedCourseObjects: PlannedCourse[] = data.completedCourses
      .map((courseId) => {
        const course = availableCourses.find((c) => c.id === courseId || c.code === courseId);
        if (!course) return null;
        return { ...course, status: 'completed' as const, semesterId: '' };
      })
      .filter(Boolean) as PlannedCourse[];

    const metadata = user?.user_metadata as { name?: string } | undefined;
    const profile: StudentProfile = {
      id: 'student-1',
      name: studentProfile?.name ?? metadata?.name ?? 'Student',
      email: studentProfile?.email ?? user?.email ?? '',
      majorId: data.majorId,
      admittedYear: data.admittedYear,
      startTerm: data.startTerm,
      graduationYear: data.graduationYear,
      graduationTerm: (data.graduationTerm.toLowerCase() as Semester['type']) ?? 'spring',
      targetGraduation: data.targetGraduation,
      completedCourses: completedCourseObjects,
      currentGPA: data.existingGPA ?? 0,
      totalCredits: 0,
      earnedCredits: 0,
    };

    setStudentProfile(profile);
    const initialSemester = buildSemester(data.startTerm, data.admittedYear);
    initialSemester.courses = completedCourseObjects.map((course) => ({
      ...course,
      semesterId: initialSemester.id,
    }));
    const newSemesters = [initialSemester];
    setSemesters(newSemesters);

    const plan: Plan = {
      id: 'plan-1',
      name: 'My 4-Year Plan',
      majorId: data.majorId,
      semesters: newSemesters,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };
    setCurrentPlan(plan);
    // isOnboarded is set by hydrateProfile (called from ProfileContext.markComplete)
    // after the backend confirms the save — not here.

    return initialSemester;
  }, [availableCourses, loadCourses, studentProfile?.email, studentProfile?.name, user?.email, user?.user_metadata]);

  const hydrateProfile = useCallback((profile: ProfilePayload) => {
    const majorId = profile.major_code ?? 'UNDECLARED';
    const admittedYear = profile.start_year ?? new Date().getFullYear();
    const startTerm = (profile.start_term?.toLowerCase() as Semester['type']) ?? 'fall';
    const graduationTerm = (profile.graduation_term?.toLowerCase() as Semester['type']) ?? 'spring';

    const metadata = user?.user_metadata as { name?: string } | undefined;
    const hydrated: StudentProfile = {
      id: 'student-1',
      name: profile.name ?? metadata?.name ?? 'Student',
      email: profile.email ?? user?.email ?? '',
      majorId,
      admittedYear,
      startTerm,
      graduationYear: profile.graduation_year ?? admittedYear + 4,
      graduationTerm,
      targetGraduation: `${profile.graduation_term ?? 'Spring'} ${profile.graduation_year ?? admittedYear + 4}`,
      completedCourses: [],
      currentGPA: profile.gpa ?? 0,
      totalCredits: 0,
      earnedCredits: 0,
    };

    setStudentProfile(hydrated);
    setIsOnboarded(true);
    if (majorId !== 'UNDECLARED') {
      void loadCourses(majorId);
    } else {
      setAvailableCourses([]);
    }
  }, [loadCourses]);

  const moveCourse = useCallback((courseId: string, fromSemesterId: string, toSemesterId: string) => {
    setSemesters(prev => {
      const newSemesters = [...prev];
      const fromSemester = newSemesters.find(s => s.id === fromSemesterId);
      const toSemester = newSemesters.find(s => s.id === toSemesterId);
      
      if (!fromSemester || !toSemester) return prev;
      
      const courseIndex = fromSemester.courses.findIndex(c => c.id === courseId);
      if (courseIndex === -1) return prev;
      
      const [course] = fromSemester.courses.splice(courseIndex, 1);
      course.semesterId = toSemesterId;
      toSemester.courses.push(course);
      
      return newSemesters;
    });
  }, []);

  const removeCourse = useCallback((courseId: string, semesterId: string) => {
    setSemesters(prev => {
      return prev.map(semester => {
        if (semester.id !== semesterId) return semester;
        return {
          ...semester,
          courses: semester.courses.filter(c => c.id !== courseId),
        };
      });
    });
  }, []);

  const addCourse = useCallback((course: PlannedCourse, semesterId: string) => {
    setSemesters(prev => {
      return prev.map(semester => {
        if (semester.id !== semesterId) return semester;
        // Check if course already exists (compare by code — DB-loaded courses have UUID ids
        // while newly added courses use course_code as id)
        if (semester.courses.some(c => c.code === course.code)) return semester;
        return {
          ...semester,
          courses: [...semester.courses, { ...course, semesterId }],
        };
      });
    });
  }, []);

  const markCourseCompleted = useCallback((courseId: string, grade: string) => {
    setSemesters(prev => {
      return prev.map(semester => ({
        ...semester,
        courses: semester.courses.map(course => {
          if (course.id !== courseId) return course;
          return {
            ...course,
            status: 'completed',
            grade,
            gradePoints: GRADE_POINTS[grade] ?? 0,
          };
        }),
      }));
    });
  }, []);

  const generatePlan = useCallback(() => {
    const admittedYear = studentProfile?.admittedYear || new Date().getFullYear();
    const startTerm = studentProfile?.startTerm || 'fall';
    setSemesters([buildSemester(startTerm, admittedYear)]);
  }, [studentProfile]);

  const resetPlan = useCallback(() => {
    setSemesters([]);
    setStudentProfile(null);
    setCurrentPlan(null);
    setIsOnboarded(false);
  }, []);

  // Computed values
  const allCourses = semesters.flatMap(s => s.courses);
  const completedCourses = allCourses.filter(c => c.status === 'completed');
  
  const plannedCredits = semesters.reduce(
    (sum, semester) => sum + semester.courses.reduce((inner, course) => inner + course.credits, 0),
    0
  );
  const totalCredits = plannedCredits;
  const earnedCredits = completedCourses.reduce((sum, c) => sum + c.credits, 0);
  const totalCourses = semesters.reduce((sum, semester) => sum + semester.courses.length, 0);
  
  const currentGPA = completedCourses.length > 0
    ? completedCourses.reduce((sum, c) => sum + (c.gradePoints || 0) * c.credits, 0) / 
      completedCourses.reduce((sum, c) => sum + c.credits, 0)
    : 0;

  const savePlan = useCallback(async () => {
    if (!accessToken) return;
    const payload = {
      name: currentPlan?.name ?? 'My Academic Plan',
      semesters: semesters.map((semester) => ({
        id: semester.id,
        type: semester.type,
        year: semester.year,
        label: semester.label,
        startDate: semester.startDate ?? null,
        endDate: semester.endDate ?? null,
        courses: semester.courses.map((course) => ({
          id: course.id,
          code: course.code,
          credits: course.credits,
          status: course.status,
          grade: course.grade ?? null,
          selectedSectionId: course.selectedSectionId ?? null,
        })),
      })),
    };
    await updatePlan(accessToken, payload);
  }, [accessToken, currentPlan?.name, semesters]);

  const value: PlannerContextType = {
    currentPlan,
    semesters,
    studentProfile,
    isOnboarded,
    selectedCourse,
    moveCourse,
    removeCourse,
    addCourse,
    markCourseCompleted,
    setSelectedCourse,
    generatePlan,
    resetPlan,
    loadCourses,
    addSemester,
    createSemester,
    replaceSemesters,
    hydrateProfile,
    savePlan,
    totalCredits,
    earnedCredits,
    currentGPA,
    totalCourses,
    availableCourses,
  };

  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
}
