import { useCallback } from 'react';
import { Semester, PlannedCourse, ConstraintViolation } from '@/types/planner';
import { useSections } from '@/contexts/SectionContext';
import { isTBAOrOnline, doMeetingTimesConflict } from '@/utils/timeUtils';

interface ValidationResult {
  canDrop: boolean;
  violations: ConstraintViolation[];
}

export function usePlannerValidation() {
  const { getSectionForCourse, isSemesterLoading } = useSections();

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

  // Check for time conflicts with other courses in the semester
  const checkTimeConflicts = useCallback((
    course: PlannedCourse,
    targetSemester: Semester
  ): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];

    // Skip if sections are still loading
    if (isSemesterLoading(targetSemester.id)) {
      return violations;
    }

    // Get section for the course being added/moved
    const courseSection = getSectionForCourse(
      course.code,
      course.selectedSectionId,
      targetSemester.id
    );

    // Skip if no section data or TBA/online
    if (!courseSection || isTBAOrOnline(courseSection)) {
      return violations;
    }

    // Get first meeting time for the course
    const courseMeeting = courseSection.meeting_times?.[0];
    if (!courseMeeting) {
      return violations;
    }

    // Check against all existing courses in target semester
    for (const existingCourse of targetSemester.courses) {
      // Skip comparing with itself
      if (existingCourse.id === course.id) {
        continue;
      }

      // Get section for existing course
      const existingSection = getSectionForCourse(
        existingCourse.code,
        existingCourse.selectedSectionId,
        targetSemester.id
      );

      // Skip if no section or TBA/online
      if (!existingSection || isTBAOrOnline(existingSection)) {
        continue;
      }

      // Get first meeting time for existing course
      const existingMeeting = existingSection.meeting_times?.[0];
      if (!existingMeeting) {
        continue;
      }

      // Check if meeting times conflict
      if (doMeetingTimesConflict(courseMeeting, existingMeeting)) {
        violations.push({
          type: 'warning',
          courseId: course.id,
          conflictWith: existingCourse.id,
          message: `Time conflict with ${existingCourse.code}`,
          suggestion: `${course.code} and ${existingCourse.code} have overlapping meeting times`,
        });
      }
    }

    return violations;
  }, [getSectionForCourse, isSemesterLoading]);

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
    violations.push(...checkTimeConflicts(course, targetSemester));

    // Check for duplicates (compare by code, not id — added courses have code as id,
    // but courses loaded from DB have a UUID id)
    const isDuplicate = targetSemester.courses.some(c => c.code === course.code);
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
  }, [checkPrerequisites, checkOfferingTerm, checkTimeConflicts]);

  return { validateDrop };
}
