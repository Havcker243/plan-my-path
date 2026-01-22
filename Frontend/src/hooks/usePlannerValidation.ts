import { useCallback } from 'react';
import { Semester, PlannedCourse, ConstraintViolation, SemesterType } from '@/types/planner';
import { csCourses } from '@/data/sampleData';

interface ValidationResult {
  canDrop: boolean;
  violations: ConstraintViolation[];
}

export function usePlannerValidation() {
  // Check if prerequisites are satisfied
  const checkPrerequisites = useCallback((
    course: PlannedCourse,
    targetSemester: Semester,
    allSemesters: Semester[]
  ): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];
    
    if (!course.prerequisites || course.prerequisites.length === 0) {
      return violations;
    }

    // Get all courses completed before target semester
    const targetSemesterIndex = allSemesters.findIndex(s => s.id === targetSemester.id);
    const priorCourses = allSemesters
      .slice(0, targetSemesterIndex)
      .flatMap(s => s.courses)
      .map(c => c.code);

    const missingPrereqs = course.prerequisites.filter(prereq => !priorCourses.includes(prereq));

    if (missingPrereqs.length > 0) {
      violations.push({
        type: 'error',
        courseId: course.id,
        message: `Missing prerequisites: ${missingPrereqs.join(', ')}`,
        suggestion: `Complete ${missingPrereqs.join(', ')} in an earlier semester`,
      });
    }

    return violations;
  }, []);

  // Check offering term compatibility
  const checkOfferingTerm = useCallback((
    course: PlannedCourse,
    targetSemester: Semester
  ): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];

    if (!course.offeredTerms.includes(targetSemester.type)) {
      violations.push({
        type: 'warning',
        courseId: course.id,
        message: `${course.code} is typically offered in ${course.offeredTerms.join('/')} only`,
        suggestion: `Move to a ${course.offeredTerms[0]} semester`,
      });
    }

    return violations;
  }, []);

  // Check credit limit
  const checkCreditLimit = useCallback((
    course: PlannedCourse,
    targetSemester: Semester
  ): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];

    const currentCredits = targetSemester.courses.reduce((sum, c) => sum + c.credits, 0);
    const newTotal = currentCredits + course.credits;

    if (newTotal > targetSemester.maxCredits) {
      violations.push({
        type: 'warning',
        courseId: course.id,
        message: `Adding ${course.code} would exceed credit limit (${newTotal}/${targetSemester.maxCredits})`,
        suggestion: 'Consider reducing course load or moving another course',
      });
    }

    return violations;
  }, []);

  // Main validation function
  const validateDrop = useCallback((
    course: PlannedCourse,
    targetSemester: Semester,
    allSemesters: Semester[]
  ): ValidationResult => {
    const violations: ConstraintViolation[] = [];

    // Run all checks
    violations.push(...checkPrerequisites(course, targetSemester, allSemesters));
    violations.push(...checkOfferingTerm(course, targetSemester));
    violations.push(...checkCreditLimit(course, targetSemester));

    // Check for duplicates
    const isDuplicate = targetSemester.courses.some(c => c.id === course.id);
    if (isDuplicate) {
      violations.push({
        type: 'error',
        courseId: course.id,
        message: `${course.code} is already in this semester`,
      });
    }

    // Hard errors prevent drop, soft warnings allow with feedback
    const hasHardErrors = violations.some(v => v.type === 'error');

    return {
      canDrop: !hasHardErrors,
      violations,
    };
  }, [checkPrerequisites, checkOfferingTerm, checkCreditLimit]);

  return { validateDrop };
}
