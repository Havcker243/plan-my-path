import React, { createContext, useContext, useState, useCallback } from 'react';
import { Plan, Semester, PlannedCourse, OnboardingData, StudentProfile } from '@/types/planner';
import { generateSamplePlan, csMajor, csCourses } from '@/data/sampleData';

interface PlannerContextType {
  // State
  currentPlan: Plan | null;
  semesters: Semester[];
  studentProfile: StudentProfile | null;
  isOnboarded: boolean;
  selectedCourse: PlannedCourse | null;
  
  // Actions
  completeOnboarding: (data: OnboardingData) => void;
  moveCourse: (courseId: string, fromSemesterId: string, toSemesterId: string) => void;
  removeCourse: (courseId: string, semesterId: string) => void;
  addCourse: (course: PlannedCourse, semesterId: string) => void;
  markCourseCompleted: (courseId: string, grade: string) => void;
  setSelectedCourse: (course: PlannedCourse | null) => void;
  generatePlan: () => void;
  resetPlan: () => void;
  
  // Computed
  totalCredits: number;
  earnedCredits: number;
  currentGPA: number;
  availableCourses: typeof csCourses;
}

const PlannerContext = createContext<PlannerContextType | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  const completeOnboarding = useCallback((data: OnboardingData) => {
    const profile: StudentProfile = {
      id: 'student-1',
      name: 'Student',
      email: 'student@university.edu',
      majorId: data.majorId,
      catalogYear: data.catalogYear,
      admittedYear: data.admittedYear,
      targetGraduation: data.targetGraduation,
      completedCourses: [],
      currentGPA: data.existingGPA || 0,
      totalCredits: csMajor.requiredCredits,
      earnedCredits: 0,
    };
    
    setStudentProfile(profile);
    const newSemesters = generateSamplePlan(data.admittedYear);
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
    setIsOnboarded(true);
  }, []);

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
        // Check if course already exists
        if (semester.courses.some(c => c.id === course.id)) return semester;
        return {
          ...semester,
          courses: [...semester.courses, { ...course, semesterId }],
        };
      });
    });
  }, []);

  const markCourseCompleted = useCallback((courseId: string, grade: string) => {
    const gradePoints: Record<string, number> = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0,
    };

    setSemesters(prev => {
      return prev.map(semester => ({
        ...semester,
        courses: semester.courses.map(course => {
          if (course.id !== courseId) return course;
          return {
            ...course,
            status: 'completed',
            grade,
            gradePoints: gradePoints[grade] || 0,
          };
        }),
      }));
    });
  }, []);

  const generatePlan = useCallback(() => {
    const admittedYear = studentProfile?.admittedYear || new Date().getFullYear();
    const newSemesters = generateSamplePlan(admittedYear);
    setSemesters(newSemesters);
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
  
  const totalCredits = csMajor.requiredCredits;
  const earnedCredits = completedCourses.reduce((sum, c) => sum + c.credits, 0);
  
  const currentGPA = completedCourses.length > 0
    ? completedCourses.reduce((sum, c) => sum + (c.gradePoints || 0) * c.credits, 0) / 
      completedCourses.reduce((sum, c) => sum + c.credits, 0)
    : 0;

  const value: PlannerContextType = {
    currentPlan,
    semesters,
    studentProfile,
    isOnboarded,
    selectedCourse,
    completeOnboarding,
    moveCourse,
    removeCourse,
    addCourse,
    markCourseCompleted,
    setSelectedCourse,
    generatePlan,
    resetPlan,
    totalCredits,
    earnedCredits,
    currentGPA,
    availableCourses: csCourses,
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
