import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlanner } from '@/contexts/PlannerContext';
import { CourseDetailModal } from '@/components/planner/CourseDetailModal';
import { PlannedCourse } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSections } from '@/lib/api';
import type { Semester } from '@/types/planner';

export function Courses() {
  const { availableCourses, semesters, addCourse } = usePlanner();
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<PlannedCourse | null>(null);
  const [selectedForAdd, setSelectedForAdd] = useState<PlannedCourse | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [allowedTerms, setAllowedTerms] = useState<Set<Semester['type']> | null>(null);

  useEffect(() => {
    if (!selectedForAdd) {
      setAllowedTerms(null);
      return;
    }
    fetchSections([selectedForAdd.code])
      .then((data) => {
        const sections = data[selectedForAdd.code] || [];
        const terms = new Set<Semester['type']>();
        for (const section of sections) {
          const term = typeof section.term === 'string' ? section.term.toLowerCase() : '';
          if (term.includes('fall')) terms.add('fall');
          if (term.includes('spring')) terms.add('spring');
          if (term.includes('summer')) terms.add('summer');
          if (term.includes('winter')) terms.add('winter');
        }
        setAllowedTerms(terms.size > 0 ? terms : null);
      })
      .catch(() => setAllowedTerms(null));
  }, [selectedForAdd]);

  const visibleSemesters = useMemo(() => {
    if (!allowedTerms || allowedTerms.size === 0) return semesters;
    return semesters.filter((semester) => allowedTerms.has(semester.type));
  }, [allowedTerms, semesters]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableCourses;
    return availableCourses.filter((course) => {
      return (
        course.code.toLowerCase().includes(query) ||
        course.title.toLowerCase().includes(query) ||
        (course.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [availableCourses, search]);

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
            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
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
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
