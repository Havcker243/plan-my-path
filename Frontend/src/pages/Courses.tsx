import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlanner } from '@/contexts/PlannerContext';
import { useSections } from '@/contexts/SectionContext';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { PlannedCourse } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { searchCourses } from '@/lib/api';
import { usePlannerValidation } from '@/hooks/usePlannerValidation';
import { toast } from '@/hooks/use-toast';

export function Courses() {
  const { availableCourses, semesters, addCourse, studentProfile } = usePlanner();
  const { clearSemesterCache } = useSections();
  const { validateDrop } = usePlannerValidation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [selectedForAdd, setSelectedForAdd] = useState<{ course: PlannedCourse; sectionId: string; sectionTerm: string } | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<PlannedCourse[]>([]);
  const majorCode = studentProfile?.majorId ?? 'UNDECLARED';

  // Sync search state to URL param
  useEffect(() => {
    if (search.trim()) {
      setSearchParams({ q: search.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [search, setSearchParams]);



  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    // Use subject filter when query looks like "CSCI", "MUS 101", "ART 200" etc.
    // Pattern: 2–6 letters optionally followed by whitespace + digits only
    const subjectMatch = query.match(/^([A-Za-z]{2,6})(?:\s+\d+)?$/);
    const subjectHint = subjectMatch ? subjectMatch[1].toUpperCase() : undefined;
    searchCourses(query, subjectHint, 1, 50)
      .then((response) => {
        const mapped = response.data.map((course) => ({
          id: course.course_code,
          code: course.course_code,
          title: course.title ?? course.course_code,
          credits: course.credits?.min_credits ?? course.credits?.max_credits ?? 0,
          description: course.description ?? '',
          prerequisites: [],
          offeredTerms: ['fall', 'spring'],
          type: 'core',
          requirementBucket: undefined,
          status: 'planned',
          semesterId: '',
        })) as PlannedCourse[];
        const majorFirst = mapped.sort((a, b) => {
          const aIsMajor = majorCode !== 'UNDECLARED' && a.code.startsWith(majorCode);
          const bIsMajor = majorCode !== 'UNDECLARED' && b.code.startsWith(majorCode);
          if (aIsMajor === bIsMajor) return a.code.localeCompare(b.code);
          return aIsMajor ? -1 : 1;
        });
        setSearchResults(majorFirst);
      })
      .catch(() => setSearchResults([]));
  }, [search, majorCode]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableCourses;
    return searchResults;
  }, [availableCourses, search, searchResults]);

  const openDetailModal = (course: PlannedCourse) => {
    setSelectedCourse({ ...course, status: 'planned', semesterId: '' });
  };

  const handleAddToPlanner = (course: PlannedCourse, sectionId: string, sectionTerm: string) => {
    setSelectedCourse(null);
    setSelectedForAdd({ course: { ...course, status: 'planned', semesterId: '' }, sectionId, sectionTerm });
    setSelectedSemesterId('');
    setShowAddDialog(true);
  };

  const handleConfirmAdd = () => {
    if (!selectedForAdd || !selectedSemesterId) return;
    const { course, sectionId, sectionTerm } = selectedForAdd;
    const targetSemester = semesters.find((s) => s.id === selectedSemesterId);
    if (!targetSemester) return;

    // Warn if the selected section's term doesn't match the chosen semester
    if (sectionTerm) {
      const semesterTermStr = `${targetSemester.type} ${targetSemester.year}`.toLowerCase();
      const normalizedSectionTerm = sectionTerm.toLowerCase();
      if (!normalizedSectionTerm.includes(semesterTermStr) && !semesterTermStr.includes(normalizedSectionTerm.split(' ')[0])) {
        toast({
          title: 'Section term mismatch',
          description: `You picked a "${sectionTerm}" section but are adding to ${targetSemester.label}. The schedule may not show correctly on the calendar.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const validation = validateDrop(course, targetSemester, semesters);
    if (!validation.canDrop) {
      const err = validation.violations.find((v) => v.type === 'error');
      toast({
        title: 'Cannot add course',
        description: err?.message ?? 'This course cannot be added to this semester.',
        variant: 'destructive',
      });
      return;
    }

    const warnings = validation.violations.filter((v) => v.type === 'warning');
    if (warnings.length > 0) {
      toast({ title: 'Warning', description: warnings[0].message });
    }

    addCourse(
      { ...course, semesterId: selectedSemesterId, selectedSectionId: sectionId },
      selectedSemesterId
    );
    // Invalidate the section cache so CalendarView re-fetches with the new course included
    clearSemesterCache(selectedSemesterId);
    setSelectedSemesterId('');
    setShowAddDialog(false);
    setSelectedForAdd(null);
    toast({ title: 'Course added', description: `${course.code} added to your plan.` });
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Courses</h1>
          <p className="text-muted-foreground">Browse the full catalog and explore sections.</p>
        </div>

        <div className="mb-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code, title, or keyword"
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredCourses.map((course) => (
            <motion.div
              key={course.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-accent/50 transition-colors cursor-pointer"
              whileHover={{ scale: 1.01 }}
              onClick={() => openDetailModal(course as PlannedCourse)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{course.code}</p>
                  <p className="text-sm text-muted-foreground">{course.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {course.description || 'No description available.'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{course.credits} cr</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Course detail modal — pick a section here first, then Add to Planner */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onAddToPlanner={(sectionId, sectionTerm) => handleAddToPlanner(selectedCourse, sectionId, sectionTerm)}
        />
      )}

      {/* Semester picker — appears after section is chosen in the modal */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose a semester</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedForAdd?.course.code}</p>
              <p className="text-xs text-muted-foreground">{selectedForAdd?.course.title}</p>
            </div>
            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((semester) => (
                  <SelectItem key={semester.id} value={semester.id}>
                    {semester.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              onClick={handleConfirmAdd}
              disabled={!selectedSemesterId}
            >
              Add to planner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
