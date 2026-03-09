import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlanner } from '@/contexts/PlannerContext';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { PlannedCourse, Semester } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSectionsForTerm, searchCourses } from '@/lib/api';
import { usePlannerValidation } from '@/hooks/usePlannerValidation';
import { toast } from '@/hooks/use-toast';

export function Courses() {
  const { availableCourses, semesters, addCourse, studentProfile } = usePlanner();
  const { validateDrop } = usePlannerValidation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [selectedForAdd, setSelectedForAdd] = useState<PlannedCourse | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [sectionStep, setSectionStep] = useState<'semester' | 'section'>('semester');
  const [sectionsForCourse, setSectionsForCourse] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
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
    if (!selectedForAdd) {
      setSectionsForCourse([]);
      setSelectedSectionId('');
    }
  }, [selectedForAdd]);

  const visibleSemesters = useMemo(() => semesters, [semesters]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    searchCourses(query, undefined, 1, 25)
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

  // Accepts a full Semester to build the correct "fall 2024" term string
  const loadSectionsForSemester = async (courseCode: string, semester: Semester) => {
    setSectionsLoading(true);
    try {
      const term = `${semester.type} ${semester.year}`;
      const data = await fetchSectionsForTerm([courseCode], term);
      setSectionsForCourse(data[courseCode] || []);
    } catch {
      setSectionsForCourse([]);
    } finally {
      setSectionsLoading(false);
    }
  };

  const openDetailModal = (course: PlannedCourse) => {
    setSelectedCourse({ ...course, status: 'planned', semesterId: '' });
  };

  const openAddDialog = (course: PlannedCourse) => {
    setSelectedForAdd({ ...course, status: 'planned', semesterId: '' });
    setSelectedSemesterId('');
    setSelectedSectionId('');
    setSectionStep('semester');
    setShowAddDialog(true);
  };

  const handleAddCourse = (sectionId?: string) => {
    if (!selectedForAdd || !selectedSemesterId) return;
    const targetSemester = semesters.find((s) => s.id === selectedSemesterId);
    if (!targetSemester) return;

    const validation = validateDrop(selectedForAdd, targetSemester, semesters);

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
      { ...selectedForAdd, semesterId: selectedSemesterId, selectedSectionId: sectionId ?? null },
      selectedSemesterId
    );
    setSelectedSemesterId('');
    setSelectedSectionId('');
    setShowAddDialog(false);
    setSelectedForAdd(null);
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
              className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-accent/50 transition-colors"
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => openDetailModal(course as PlannedCourse)}
                >
                  <p className="text-sm font-semibold text-foreground">{course.code}</p>
                  <p className="text-sm text-muted-foreground">{course.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {course.description || 'No description available.'}
                  </p>
                </button>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{course.credits} cr</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={() => openAddDialog(course as PlannedCourse)}
                  >
                    + Add
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Course detail modal — opened by clicking the course name/description */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onAddToPlanner={() => {
            const course = selectedCourse;
            setSelectedCourse(null);
            openAddDialog(course);
          }}
        />
      )}

      {/* Add to planner dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to planner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedForAdd?.code}</p>
              <p className="text-xs text-muted-foreground">{selectedForAdd?.title}</p>
            </div>

            {sectionStep === 'semester' && (
              <>
                <Select
                  value={selectedSemesterId}
                  onValueChange={async (value) => {
                    setSelectedSemesterId(value);
                    const semester = semesters.find((s) => s.id === value);
                    if (semester && selectedForAdd) {
                      await loadSectionsForSemester(selectedForAdd.code, semester);
                      setSectionStep('section');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSemesters.map((semester) => (
                      <SelectItem key={semester.id} value={semester.id}>
                        {semester.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => handleAddCourse()}
                  disabled={!selectedSemesterId}
                >
                  Add without section
                </Button>
              </>
            )}

            {sectionStep === 'section' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Select a section (optional)</p>
                  {sectionsLoading && (
                    <p className="text-sm text-muted-foreground">Loading sections…</p>
                  )}
                  {!sectionsLoading && sectionsForCourse.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sections found for this term</p>
                  )}
                  {!sectionsLoading && sectionsForCourse.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sectionsForCourse.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                            selectedSectionId === section.id
                              ? 'border-accent bg-accent/10'
                              : 'border-border'
                          }`}
                          onClick={() => setSelectedSectionId(section.id)}
                        >
                          <div className="font-medium">
                            Section {section.section_code} · {section.term ?? 'Term TBA'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {section.status ?? 'Status TBA'} ·{' '}
                            {section.seats?.available ?? 0}/{section.seats?.capacity ?? 0} seats
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSectionStep('semester');
                      setSelectedSectionId('');
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleAddCourse(selectedSectionId || undefined)}
                    disabled={!selectedSemesterId}
                  >
                    Add course
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
