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
  selectedSectionId?: string | null;
}

export interface Semester {
  id: string;
  type: SemesterType;
  year: number;
  label: string;
  courses: PlannedCourse[];
  startDate?: string | null;
  endDate?: string | null;
}

export interface Major {
  id: string;
  name: string;
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
  admittedYear: number;
  startTerm: SemesterType;
  graduationYear: number;
  graduationTerm: SemesterType;
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

export interface MeetingTime {
  days: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  building?: string | null;
  room?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  modality?: string | null;
}

export interface CourseSection {
  id: string;
  courseId?: string;
  course_id?: string;
  section_code: string;
  section_id: string;
  term: string;
  term_code?: string;
  status?: string;
  campus?: string;
  modality?: string;
  start_date?: string | null;
  end_date?: string | null;
  seats?: {
    available: number;
    capacity: number;
    enrolled?: number;
    waitlisted?: number;
  };
  instructors?: Array<{
    name: string;
    faculty_id?: string;
    role?: string;
  }>;
  meeting_times?: MeetingTime[];
}

// Onboarding types
export interface OnboardingData {
  majorId: string;
  admittedYear: number;
  startTerm: SemesterType;
  graduationYear: number;
  graduationTerm: SemesterType;
  targetGraduation: string;
  completedCourses: string[];
  existingGPA?: number;
}

// Constraint types for planner
export interface PlanConstraints {
  targetGraduation: string;
  preferredCourseLoad: 'light' | 'normal' | 'heavy';
  avoidSummer: boolean;
}

// Time conflict types
export interface TimeConflict {
  course1: PlannedCourse;
  course2: PlannedCourse;
  conflictingDays: string[];
  timeOverlap: { start: string; end: string };
}

// Validation result
export interface ConstraintViolation {
  type: 'error' | 'warning';
  courseId: string;
  message: string;
  suggestion?: string;
  conflictWith?: string; // For time conflicts - ID of conflicting course
}

export interface DropResult {
  success: boolean;
  violations?: ConstraintViolation[];
}
