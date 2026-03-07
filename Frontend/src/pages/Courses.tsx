import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlanner } from '@/contexts/PlannerContext';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { PlannedCourse } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSectionsForTerm, searchCourses, fetchCourseLabels, type CourseLabelsResponse } from '@/lib/api';
import type { Semester } from '@/types/planner';
import { cn } from '@/lib/utils';

export function Courses() {
  const { availableCourses, semesters, addCourse, studentProfile } = usePlanner();
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [selectedForAdd, setSelectedForAdd] = useState<PlannedCourse | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [sectionStep, setSectionStep] = useState<'semester' | 'section'>('semester');
  const [sectionsForCourse, setSectionsForCourse] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlannedCourse[]>([]);
  const [courseLabels, setCourseLabels] = useState<CourseLabelsResponse>({});
  const majorCode = studentProfile?.majorId ?? 'UNDECLARED';

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

  const loadSectionsForSemester = async (courseCode: string, term: Semester['type']) => {
    setSectionsLoading(true);
    try {
      const data = await fetchSectionsForTerm([courseCode], term);
      setSectionsForCourse(data[courseCode] || []);
    } catch {
      setSectionsForCourse([]);
    } finally {
      setSectionsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Courses</h1>
          <p className="text-muted-foreground">
            Browse the full catalog and explore sections.
          </p>
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
            <motion.button
              key={course.id}
              className="text-left rounded-xl border border-border bg-card p-4 shadow-sm hover:border-accent/50"
              onClick={() => {
                setSelectedForAdd({
                  ...course,
                  status: 'planned',
                  semesterId: '',
                });
                setSelectedSemesterId('');
                setSelectedSectionId('');
                setSectionStep('semester');
                setShowAddDialog(true);
              }}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{course.code}</p>
                  <p className="text-sm text-muted-foreground">{course.title}</p>
                </div>
                <span className="text-xs text-muted-foreground">{course.credits} cr</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {course.description || 'No description available.'}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <CourseDetailModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add course</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedForAdd?.code}</p>
              <p className="text-xs text-muted-foreground">{selectedForAdd?.title}</p>
            </div>
            {sectionStep === 'semester' && (
              <>
                <Select value={selectedSemesterId} onValueChange={async (value) => {
                  setSelectedSemesterId(value);
                  const semester = semesters.find((item) => item.id === value);
                  if (semester && selectedForAdd) {
                    await loadSectionsForSemester(selectedForAdd.code, semester.type);
                    setSectionStep('section');
                  }
                }}>
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
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!selectedForAdd || !selectedSemesterId) return;
                      addCourse(
                        { ...selectedForAdd, semesterId: selectedSemesterId },
                        selectedSemesterId
                      );
                      setSelectedSemesterId('');
                      setShowAddDialog(false);
                    }}
                    disabled={!selectedSemesterId}
                  >
                    Add course
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (!selectedForAdd) return;
                      setShowAddDialog(false);
                      setSelectedCourse(selectedForAdd);
                    }}
                  >
                    View details
                  </Button>
                </div>
              </>
            )}

            {sectionStep === 'section' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Select a section</p>
                  {sectionsLoading && <p className="text-sm text-muted-foreground">Loading sections…</p>}
                  {!sectionsLoading && sectionsForCourse.length === 0 && (
                    <p className="text-sm text-destructive">No sections yet for this term</p>
                  )}
                  {!sectionsLoading && sectionsForCourse.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sectionsForCourse.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                            selectedSectionId === section.id ? 'border-accent bg-accent/10' : 'border-border'
                          }`}
                          onClick={() => setSelectedSectionId(section.id)}
                        >
                          <div className="font-medium">
                            Section {section.section_code} · {section.term ?? 'Term TBA'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {section.status ?? 'Status TBA'} · {section.seats?.available ?? 0}/{section.seats?.capacity ?? 0} seats
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
                    onClick={() => {
                      if (!selectedForAdd || !selectedSemesterId) return;
                      addCourse(
                        {
                          ...selectedForAdd,
                          semesterId: selectedSemesterId,
                          selectedSectionId: selectedSectionId || null,
                        },
                        selectedSemesterId
                      );
                      setSelectedSemesterId('');
                      setSelectedSectionId('');
                      setShowAddDialog(false);
                    }}
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
