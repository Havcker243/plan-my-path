import React, { createContext, useContext, useState, useCallback } from 'react';
import { Semester, CourseSection } from '@/types/planner';
import { fetchSectionsForTerm } from '@/lib/api';

/**
 * Cache entry for a single semester
 */
interface SemesterSectionCache {
  data: Record<string, CourseSection[]>; // keyed by course code
  timestamp: number;
  loading: boolean;
}

/**
 * Cache structure: semesterId -> section data
 */
type SectionCache = Record<string, SemesterSectionCache>;

interface SectionContextType {
  // Get sections for a specific course in a semester
  getSectionForCourse: (
    courseCode: string,
    sectionId: string | null | undefined,
    semesterId: string
  ) => CourseSection | null;

  // Get all sections for a course in a semester
  getSectionsForCourse: (courseCode: string, semesterId: string) => CourseSection[];

  // Fetch sections for an entire semester
  fetchSectionsForSemester: (semester: Semester) => Promise<void>;

  // Check if sections are currently loading for a semester
  isSemesterLoading: (semesterId: string) => boolean;

  // Check if sections are cached for a semester
  isSemesterCached: (semesterId: string) => boolean;

  // Clear cache (useful for testing or when data changes)
  clearCache: () => void;

  // Clear cache for specific semester
  clearSemesterCache: (semesterId: string) => void;
}

const SectionContext = createContext<SectionContextType | null>(null);

// Cache invalidation time: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<SectionCache>({});

  /**
   * Check if cache entry is still valid (not expired)
   */
  const isCacheValid = useCallback((entry: SemesterSectionCache | undefined): boolean => {
    if (!entry) return false;
    const now = Date.now();
    return now - entry.timestamp < CACHE_TTL;
  }, []);

  /**
   * Fetch sections for all courses in a semester
   */
  const fetchSectionsForSemester = useCallback(
    async (semester: Semester) => {
      // Check if already cached and valid
      const existingCache = cache[semester.id];
      if (existingCache && isCacheValid(existingCache)) {
        return; // Cache is still valid, no need to fetch
      }

      // Don't fetch if already loading
      if (existingCache?.loading) {
        return;
      }

      // Get all course codes in the semester
      const courseCodes = semester.courses.map((course) => course.code);
      if (courseCodes.length === 0) {
        // Empty semester, store empty cache
        setCache((prev) => ({
          ...prev,
          [semester.id]: {
            data: {},
            timestamp: Date.now(),
            loading: false,
          },
        }));
        return;
      }

      // Mark as loading
      setCache((prev) => ({
        ...prev,
        [semester.id]: {
          data: prev[semester.id]?.data || {},
          timestamp: Date.now(),
          loading: true,
        },
      }));

      try {
        // Build term string from semester (e.g., "fall2024")
        const term = `${semester.type}${semester.year}`.toLowerCase();

        // Fetch sections from API
        const sectionsData = await fetchSectionsForTerm(courseCodes, term);

        // Transform to typed format
        const typedData: Record<string, CourseSection[]> = {};
        Object.entries(sectionsData).forEach(([courseCode, sections]) => {
          typedData[courseCode] = sections as CourseSection[];
        });

        // Update cache
        setCache((prev) => ({
          ...prev,
          [semester.id]: {
            data: typedData,
            timestamp: Date.now(),
            loading: false,
          },
        }));
      } catch (error) {
        console.error('Failed to fetch sections for semester:', semester.id, error);

        // Mark as not loading on error, keep existing data if any
        setCache((prev) => ({
          ...prev,
          [semester.id]: {
            data: prev[semester.id]?.data || {},
            timestamp: Date.now(),
            loading: false,
          },
        }));
      }
    },
    [cache, isCacheValid]
  );

  /**
   * Get all sections for a specific course in a semester
   */
  const getSectionsForCourse = useCallback(
    (courseCode: string, semesterId: string): CourseSection[] => {
      const semesterCache = cache[semesterId];
      if (!semesterCache || !isCacheValid(semesterCache)) {
        return [];
      }

      return semesterCache.data[courseCode] || [];
    },
    [cache, isCacheValid]
  );

  /**
   * Get a specific section for a course
   * If sectionId is provided, returns that section
   * Otherwise, returns first available section
   */
  const getSectionForCourse = useCallback(
    (
      courseCode: string,
      sectionId: string | null | undefined,
      semesterId: string
    ): CourseSection | null => {
      const sections = getSectionsForCourse(courseCode, semesterId);

      if (sections.length === 0) {
        return null;
      }

      // If sectionId is specified, find that specific section
      if (sectionId) {
        const section = sections.find((s) => s.id === sectionId);
        if (section) return section;
      }

      // Otherwise, return first section as fallback
      return sections[0] || null;
    },
    [getSectionsForCourse]
  );

  /**
   * Check if sections are currently loading for a semester
   */
  const isSemesterLoading = useCallback(
    (semesterId: string): boolean => {
      return cache[semesterId]?.loading || false;
    },
    [cache]
  );

  /**
   * Check if sections are cached (and valid) for a semester
   */
  const isSemesterCached = useCallback(
    (semesterId: string): boolean => {
      const semesterCache = cache[semesterId];
      return semesterCache ? isCacheValid(semesterCache) : false;
    },
    [cache, isCacheValid]
  );

  /**
   * Clear all cache
   */
  const clearCache = useCallback(() => {
    setCache({});
  }, []);

  /**
   * Clear cache for a specific semester
   */
  const clearSemesterCache = useCallback((semesterId: string) => {
    setCache((prev) => {
      const newCache = { ...prev };
      delete newCache[semesterId];
      return newCache;
    });
  }, []);

  const value: SectionContextType = {
    getSectionForCourse,
    getSectionsForCourse,
    fetchSectionsForSemester,
    isSemesterLoading,
    isSemesterCached,
    clearCache,
    clearSemesterCache,
  };

  return <SectionContext.Provider value={value}>{children}</SectionContext.Provider>;
}

/**
 * Hook to access section context
 */
export function useSections() {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error('useSections must be used within a SectionProvider');
  }
  return context;
}
