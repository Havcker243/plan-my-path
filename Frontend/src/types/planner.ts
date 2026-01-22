// Core types for the 4-Year Academic Planner

export type CourseStatus = 'planned' | 'completed' | 'failed' | 'in_progress';

export type CourseType = 'core' | 'elective' | 'general';

export type SemesterType = 'fall' | 'spring' | 'summer' | 'winter';

export type MoodType = 'positive' | 'neutral' | 'negative';

export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  description?: string;
  prerequisites?: string[];
  prereqExpression?: string;
  offeredTerms: SemesterType[];
  type: CourseType;
  requirementBucket?: string;
}

export interface PlannedCourse extends Course {
  status: CourseStatus;
  grade?: string;
  gradePoints?: number;
  semesterId: string;
  moodScore?: number;
  moodCount?: number;
}

export interface Semester {
  id: string;
  type: SemesterType;
  year: number;
  label: string;
  courses: PlannedCourse[];
  maxCredits: number;
}

export interface Major {
  id: string;
  name: string;
  catalogYear: string;
  requiredCredits: number;
  coreCredits: number;
  electiveCredits: number;
  courses: Course[];
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  majorId: string;
  catalogYear: string;
  admittedYear: number;
  targetGraduation: string;
  completedCourses: PlannedCourse[];
  currentGPA: number;
  totalCredits: number;
  earnedCredits: number;
}

export interface Plan {
  id: string;
  name: string;
  majorId: string;
  semesters: Semester[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CourseFeedback {
  id: string;
  courseId: string;
  userId: string;
  mood: MoodType;
  comment?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export interface CourseSection {
  id: string;
  courseId: string;
  sectionNumber: string;
  professor: string;
  seatsTotal: number;
  seatsOpen: number;
  meetingTimes: string;
}

// Onboarding types
export interface OnboardingData {
  majorId: string;
  catalogYear: string;
  admittedYear: number;
  targetGraduation: string;
  completedCourses: string[];
  existingGPA?: number;
}

// Constraint types for planner
export interface PlanConstraints {
  maxCreditsPerSemester: number;
  targetGraduation: string;
  preferredCourseLoad: 'light' | 'normal' | 'heavy';
  avoidSummer: boolean;
}

// Validation result
export interface ConstraintViolation {
  type: 'error' | 'warning';
  courseId: string;
  message: string;
  suggestion?: string;
}

export interface DropResult {
  success: boolean;
  violations?: ConstraintViolation[];
}
