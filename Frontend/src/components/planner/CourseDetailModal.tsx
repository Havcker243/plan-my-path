import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  BookOpen,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  GraduationCap,
  MessageSquare,
  ThumbsUp,
  Meh,
  ThumbsDown,
  MapPin,
} from 'lucide-react';
import { PlannedCourse, CourseSection, MeetingTime } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSections } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface CourseDetailModalProps {
  course: PlannedCourse;
  onClose: () => void;
  onMarkCompleted?: (grade: string) => void;
  /** Called with the chosen sectionId and its term once the user picks one and clicks Add to Planner (Courses page) */
  onAddToPlanner?: (sectionId: string, sectionTerm: string) => void;
  /** Called when user picks/changes a section from within the Planner (no semester picker needed) */
  onSelectSection?: (sectionId: string) => void;
}

export function CourseDetailModal({
  course,
  onClose,
  onMarkCompleted,
  onAddToPlanner,
  onSelectSection,
}: CourseDetailModalProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [pickedSectionId, setPickedSectionId] = useState<string | null>(
    course.selectedSectionId ?? null
  );
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [termFilter, setTermFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openOnly, setOpenOnly] = useState(false);

  const hasPrereqs = course.prerequisites && course.prerequisites.length > 0;

  useEffect(() => {
    let mounted = true;
    const loadSections = async () => {
      setSectionsLoading(true);
      try {
        // Use the dedicated /api/sections endpoint (returns all terms for this course)
        const result = await fetchSections([course.code]);
        if (mounted) {
          setSections(result[course.code] ?? []);
        }
      } catch {
        if (mounted) {
          setSections([]);
        }
      } finally {
        if (mounted) {
          setSectionsLoading(false);
        }
      }
    };

    void loadSections();
    return () => {
      mounted = false;
    };
  }, [course.code]);

  const termOptions = useMemo(() => {
    const terms = new Set<string>();
    sections.forEach((section) => {
      if (section.term) terms.add(section.term);
    });
    return Array.from(terms);
  }, [sections]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    sections.forEach((section) => {
      if (section.status) statuses.add(section.status);
    });
    return Array.from(statuses);
  }, [sections]);

  const filteredSections = useMemo(() => {
    return sections.filter((section) => {
      if (termFilter !== 'all' && section.term !== termFilter) return false;
      if (statusFilter !== 'all' && section.status !== statusFilter) return false;
      if (openOnly && (section.seats?.available ?? 0) <= 0) return false;
      return true;
    });
  }, [sections, termFilter, statusFilter, openOnly]);

  const handleMarkCompleted = () => {
    if (selectedGrade && onMarkCompleted) {
      onMarkCompleted(selectedGrade);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-foreground">{course.code}</h2>
                <Badge 
                  variant="secondary" 
                  className={
                    course.status === 'completed' ? 'bg-success/20 text-success border-0' :
                    course.status === 'failed' ? 'bg-destructive/20 text-destructive border-0' :
                    'bg-muted'
                  }
                >
                  {course.status === 'completed' && course.grade ? course.grade : course.status}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {course.credits} credits
                </Badge>
              </div>
              <h3 className="text-lg text-muted-foreground">{course.title}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="border-b border-border px-6">
            <TabsList className="bg-transparent h-12 p-0 gap-6">
              <TabsTrigger 
                value="overview" 
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-accent rounded-none px-0"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="sections"
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-accent rounded-none px-0"
              >
                Sections
              </TabsTrigger>
              <TabsTrigger 
                value="feedback"
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-accent rounded-none px-0"
              >
                Feedback
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 overflow-y-auto max-h-[50vh] custom-scrollbar">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />
                  Description
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {course.description || 'No description available.'}
                </p>
              </div>

              {/* Prerequisites */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Prerequisites
                </h4>
                {hasPrereqs ? (
                  <div className="flex flex-wrap gap-2">
                    {course.prerequisites!.map((prereq) => (
                      <Badge key={prereq} variant="outline" className="cursor-pointer hover:bg-muted">
                        {prereq}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No prerequisites required.</p>
                )}
                {course.prereqExpression && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires: {course.prereqExpression}
                  </p>
                )}
              </div>

              {/* Offered Terms */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  Typical Offering
                </h4>
                <div className="flex gap-2">
                  {course.offeredTerms.map((term) => (
                    <Badge 
                      key={term} 
                      variant="secondary"
                      className={
                        term === 'fall' ? 'bg-semester-fall/20 text-semester-fall border-0' :
                        term === 'spring' ? 'bg-semester-spring/20 text-semester-spring border-0' :
                        term === 'summer' ? 'bg-semester-summer/20 text-semester-summer border-0' :
                        'bg-semester-winter/20 text-semester-winter border-0'
                      }
                    >
                      {term.charAt(0).toUpperCase() + term.slice(1)}
                    </Badge>
                  ))}
                </div>
                {course.offeredTerms.length === 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ Typically offered {course.offeredTerms[0]} only — check with advisor.
                  </p>
                )}
              </div>

              {/* Requirement Bucket */}
              {course.requirementBucket && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-accent" />
                    Satisfies Requirement
                  </h4>
                  <Badge variant="outline">{course.requirementBucket}</Badge>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sections" className="mt-0">
              {(onAddToPlanner || onSelectSection) && (
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  {onAddToPlanner
                    ? <>Select a section below to enable <strong>Add to Planner</strong>.</>
                    : 'Click a section to select it for this course.'}
                </p>
              )}
              {sectionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Loading sections...</p>
                </div>
              ) : sections.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Term</span>
                      <Select value={termFilter} onValueChange={setTermFilter}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="All terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All terms</SelectItem>
                          {termOptions.map((term) => (
                            <SelectItem key={term} value={term}>
                              {term}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status</span>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={openOnly}
                        onCheckedChange={(value) => setOpenOnly(Boolean(value))}
                      />
                      Open seats only
                    </label>
                  </div>

                  {filteredSections.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No sections match these filters.</p>
                    </div>
                  ) : filteredSections.map((section) => {
                    const isSelectable = !!onAddToPlanner || !!onSelectSection;
                    const isPicked = isSelectable && pickedSectionId === section.id;
                    const sectionBody = (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                Section {section.section_code}
                              </span>
                              {isPicked && (
                                <Badge className="bg-accent/20 text-accent border-0 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {section.instructors?.map((inst) => inst.name).join(', ') || 'Instructor TBA'}
                            </p>
                          </div>
                          <Badge
                            variant={section.seats?.available < 5 ? 'destructive' : 'secondary'}
                            className={section.seats?.available < 5 ? '' : 'bg-success/20 text-success border-0'}
                          >
                            {section.seats?.available ?? 0}/{section.seats?.capacity ?? 0} seats
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>
                            {section.meeting_times?.map((mt: MeetingTime) => {
                              const time = mt.start_time && mt.end_time ? `${mt.start_time} – ${mt.end_time}` : 'Time TBA';
                              return `${mt.days ?? ''} ${time}`.trim();
                            }).join(' | ') || 'Meeting time TBA'}
                          </span>
                        </div>
                        {section.meeting_times?.some((mt: MeetingTime) => mt.building || mt.room) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span>
                              {section.meeting_times.map((mt: MeetingTime) =>
                                [mt.building, mt.room].filter(Boolean).join(' ')
                              ).filter(Boolean).join(' | ')}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {section.term || section.term_code || 'Term TBA'} • {section.status || 'Status TBA'}
                        </div>
                      </>
                    );

                    const sharedClass = `w-full text-left p-4 rounded-lg border transition-colors ${
                      isPicked ? 'border-accent bg-accent/10' : 'bg-muted/50 border-border'
                    }`;

                    return isSelectable ? (
                      <button
                        key={`${section.section_code}-${section.term_code}`}
                        type="button"
                        className={`${sharedClass} hover:border-accent/50 cursor-pointer`}
                        onClick={() => setPickedSectionId(isPicked ? null : section.id)}
                      >
                        {sectionBody}
                      </button>
                    ) : (
                      <div
                        key={`${section.section_code}-${section.term_code}`}
                        className={sharedClass}
                      >
                        {sectionBody}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No section data available.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="mt-0">
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">How was this course?</p>
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => toast({ title: 'Feedback submitted', description: `Marked ${course.code} as Helpful` })}
                  >
                    <ThumbsUp className="w-4 h-4 text-success" />
                    Helpful
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => toast({ title: 'Feedback submitted', description: `Marked ${course.code} as Neutral` })}
                  >
                    <Meh className="w-4 h-4 text-warning" />
                    Neutral
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => toast({ title: 'Feedback submitted', description: `Marked ${course.code} as Challenging` })}
                  >
                    <ThumbsDown className="w-4 h-4 text-destructive" />
                    Challenging
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            {course.status !== 'completed' && onMarkCompleted && (
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground">Mark as completed:</Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'].map((grade) => (
                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  size="sm" 
                  onClick={handleMarkCompleted}
                  disabled={!selectedGrade}
                  className="bg-success hover:bg-success/90"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm
                </Button>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {course.status === 'planned' && onAddToPlanner && (
                <Button
                  onClick={() => {
                    if (!pickedSectionId) return;
                    const picked = sections.find((s) => s.id === pickedSectionId);
                    onAddToPlanner(pickedSectionId, picked?.term ?? '');
                  }}
                  disabled={!pickedSectionId}
                  className="bg-accent hover:bg-accent/90 disabled:opacity-50"
                  title={!pickedSectionId ? 'Select a section first' : undefined}
                >
                  {pickedSectionId ? 'Add to Planner' : 'Pick a Section First'}
                </Button>
              )}
              {onSelectSection && (
                <Button
                  onClick={() => {
                    if (!pickedSectionId) return;
                    onSelectSection(pickedSectionId);
                    onClose();
                  }}
                  disabled={!pickedSectionId || pickedSectionId === course.selectedSectionId}
                  className="bg-accent hover:bg-accent/90 disabled:opacity-50"
                >
                  {pickedSectionId && pickedSectionId !== course.selectedSectionId
                    ? 'Save Section'
                    : pickedSectionId
                    ? 'Section Saved'
                    : 'Pick a Section'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
