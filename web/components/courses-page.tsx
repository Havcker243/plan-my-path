"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, X, ChevronRight, BookOpen, Check, AlertCircle, Loader2, CheckCircle2, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LABEL_META,
  LABEL_DOT,
  LABEL_BADGE,
  type Course,
  type RequirementLabel,
  type SemesterTerm,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlan } from "@/contexts/plan-context";
import { fetchSubjects } from "@/lib/api";
import { fetchCoursesBySubject } from "@/lib/api";
import { subjectCourseToCourse } from "@/lib/api-adapters";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type StatusFilter = "all" | "needed" | "in-plan" | "completed";
type SortDirection = "asc" | "desc";

const LEVELS = [100, 200, 300, 400] as const;
const TERMS: SemesterTerm[] = ["Fall", "Spring", "Summer", "Winter"];


const TERM_SHORT: Record<SemesterTerm, string> = {
  Fall: "F", Spring: "Sp", Summer: "Su", Winter: "W",
};

export default function CoursesPage() {
  const { planCatalog, semesters, labels, searchCoursesCatalog, addCourseToSemester } = usePlan();

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [termFilter, setTermFilter] = useState<SemesterTerm | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selected, setSelected] = useState<Course | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);
  const [catalogCourses, setCatalogCourses] = useState<Record<string, Course>>({});
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [targetSemesterId, setTargetSemesterId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  // Load subjects for filter chips
  useEffect(() => {
    fetchSubjects()
      .then((data) => setSubjects(data.map((s) => s.code).sort()))
      .catch((err) => console.error("[courses] subjects load failed:", err));
  }, []);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    fetchSubjects()
      .then(async (data) => {
        const subjectCodes = data.map((subject) => subject.code).sort();
        const settled = await Promise.allSettled(
          subjectCodes.map(async (subject) => ({
            subject,
            courses: await fetchCoursesBySubject(subject),
          }))
        );

        if (!active) return;
        const next: Record<string, Course> = {};
        settled.forEach((result) => {
          if (result.status !== "fulfilled") return;
          result.value.courses.forEach((course) => {
            const adapted = subjectCourseToCourse(course, labels);
            next[adapted.code] = adapted;
          });
        });
        setCatalogCourses(next);
      })
      .catch((err) => {
        console.error("[courses] catalog load failed:", err);
        if (active) setCatalogCourses({});
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [labels]);

  // Trigger API search when query changes (subject-only filtering uses planCatalog)
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCoursesCatalog(search, subjectFilter ?? undefined);
        setSearchResults(results);
      } catch (err) {
        console.error("[courses] search failed:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, subjectFilter, searchCoursesCatalog]);

  const completedIds = useMemo(() => {
    const planCodes = new Set(semesters.flatMap((s) => s.courseIds));
    return new Set([...planCodes].filter((id) => planCatalog[id]?.status === "completed"));
  }, [semesters, planCatalog]);

  const plannedSemesters = useMemo(() => {
    const map: Record<string, string> = {};
    semesters.filter((s) => !s.isPast).forEach((sem) => {
      sem.courseIds.forEach((id) => { map[id] = `${sem.term} ${sem.year}`; });
    });
    return map;
  }, [semesters]);

  const plannableSemesters = useMemo(
    () => semesters.filter((s) => !s.isPast),
    [semesters]
  );

  useEffect(() => {
    if (!semesterDialogOpen) return;
    if (!plannableSemesters.length) {
      setTargetSemesterId("");
      return;
    }
    if (!targetSemesterId || !plannableSemesters.some((sem) => sem.id === targetSemesterId)) {
      const preferred = plannableSemesters.find((sem) => sem.isCurrent) ?? plannableSemesters[0];
      setTargetSemesterId(preferred.id);
    }
  }, [semesterDialogOpen, plannableSemesters, targetSemesterId]);

  // Combine plan catalog + search results (search results take precedence)
  const allCourses = useMemo(() => {
    const base = { ...catalogCourses, ...planCatalog };
    searchResults.forEach((c) => { base[c.code] = c; });
    return Object.values(base);
  }, [catalogCourses, planCatalog, searchResults]);

  // Derive subjects from available courses if not loaded yet
  const derivedSubjects = useMemo(() => {
    const s = subjects.length > 0 ? subjects : [...new Set(allCourses.map((c) => c.subject))].sort();
    return s;
  }, [subjects, allCourses]);

  // Courses you still need (required label but not completed/planned)
  const coursesYouNeed = useMemo(() => {
    const requiredCodes = Object.entries(labels)
      .filter(([, entry]) => entry.label === "Required")
      .map(([code]) => code);
    return requiredCodes.filter((code) => !completedIds.has(code) && !plannedSemesters[code]);
  }, [labels, completedIds, plannedSemesters]);

  const filtered = allCourses.filter((c) => {
    if (statusFilter === "needed" && (completedIds.has(c.id) || plannedSemesters[c.id])) return false;
    if (statusFilter === "in-plan" && !plannedSemesters[c.id]) return false;
    if (statusFilter === "completed" && !completedIds.has(c.id)) return false;
    if (subjectFilter && c.subject !== subjectFilter) return false;
    if (levelFilter && c.level !== levelFilter) return false;
    if (termFilter && !c.offeredTerms.includes(termFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
    }
    return true;
  });

  const sortedSubjects = useMemo(() => {
    const next = [...derivedSubjects];
    next.sort((a, b) => sortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a));
    return next;
  }, [derivedSubjects, sortDirection]);

  const sortedFiltered = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const bySubject = a.subject.localeCompare(b.subject);
      if (bySubject !== 0) return sortDirection === "asc" ? bySubject : -bySubject;

      const codeA = a.code.toUpperCase();
      const codeB = b.code.toUpperCase();
      const byCode = codeA.localeCompare(codeB, undefined, { numeric: true });
      if (byCode !== 0) return sortDirection === "asc" ? byCode : -byCode;

      const byTitle = a.title.localeCompare(b.title);
      return sortDirection === "asc" ? byTitle : -byTitle;
    });
    return next;
  }, [filtered, sortDirection]);

  const grouped = sortedSubjects.reduce<Record<string, Course[]>>((acc, subj) => {
    const courses = sortedFiltered.filter((c) => c.subject === subj);
    if (courses.length) acc[subj] = courses;
    return acc;
  }, {});

  const hasFilters = !!subjectFilter || !!levelFilter || !!termFilter || !!search || statusFilter !== "all";
  const clearFilters = () => {
    setSubjectFilter(null); setLevelFilter(null); setTermFilter(null);
    setStatusFilter("all"); setSearch(""); setSearchResults([]);
  };

  const openAddDialog = useCallback((course: Course) => {
    setTargetCourse(course);
    setSemesterDialogOpen(true);
  }, []);

  const handleAddToPlanner = useCallback(async () => {
    if (!targetCourse || !targetSemesterId) return;
    setAdding(true);
    try {
      const saved = await addCourseToSemester(targetCourse, targetSemesterId);
      if (saved) {
        const semester = plannableSemesters.find((sem) => sem.id === targetSemesterId);
        setSemesterDialogOpen(false);
        setTargetCourse(null);
        toast.success(
          semester
            ? `${targetCourse.code} added to ${semester.term} ${semester.year}`
            : `${targetCourse.code} added to planner`
        );
      }
    } catch (err) {
      console.error("[CoursesPage] failed to add course:", err);
      toast.error("Couldn't add that course right now. Please try again.");
    } finally {
      setAdding(false);
    }
  }, [addCourseToSemester, targetCourse, targetSemesterId, plannableSemesters]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className={cn("flex flex-col flex-1 min-w-0 overflow-hidden", selected ? "hidden md:flex" : "flex")}>
        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-border bg-background flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
              <input
                type="text"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
            >
              Sort: {sortDirection === "asc" ? "A-Z" : "Z-A"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Subject chips */}
            <div className="flex flex-wrap gap-1">
              {derivedSubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubjectFilter(subjectFilter === s ? null : s)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                    subjectFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {derivedSubjects.length > 0 && <div className="h-5 w-px bg-border self-center" />}

            {/* Level */}
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(levelFilter === l ? null : l)}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                  levelFilter === l
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {l}+
              </button>
            ))}

            <div className="h-5 w-px bg-border self-center" />

            {/* Term */}
            {TERMS.map((t) => (
              <button
                key={t}
                onClick={() => setTermFilter(termFilter === t ? null : t)}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                  termFilter === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}

            <div className="h-5 w-px bg-border self-center" />

            {/* Status */}
            {([
              { key: "all", label: "All" },
              { key: "needed", label: "Needed" },
              { key: "in-plan", label: "In Plan" },
              { key: "completed", label: "Done" },
            ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                  statusFilter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-4">
          {/* Courses You Still Need */}
          {coursesYouNeed.length > 0 && statusFilter === "all" && !search && (
            <div className="mb-6 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-900">Courses You Still Need</span>
                <span className="text-xs text-yellow-700 ml-auto">{coursesYouNeed.length} required not in plan</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coursesYouNeed.slice(0, 6).map((code) => (
                  <button
                    key={code}
                    onClick={() => setSearch(code)}
                    className="text-xs bg-white border border-yellow-300 rounded-md px-2.5 py-1 font-medium hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {code}
                  </button>
                ))}
                {coursesYouNeed.length > 6 && (
                  <button
                    onClick={() => setStatusFilter("needed")}
                    className="text-xs text-yellow-700 hover:underline"
                  >
                    +{coursesYouNeed.length - 6} more
                  </button>
                )}
              </div>
            </div>
          )}

          {allCourses.length === 0 && !searching && !catalogLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No catalog courses are available yet.</p>
            </div>
          )}

          {catalogLoading && allCourses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-muted-foreground/60 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading the course catalog…</p>
            </div>
          )}

          {allCourses.length > 0 && (
            <p className="text-xs text-muted-foreground mb-4">{filtered.length} courses found</p>
          )}

          {Object.entries(grouped).map(([subject, courses]) => (
            <div key={subject} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">{subject}</h2>
                <span className="text-xs text-muted-foreground">{courses.length} courses</span>
              </div>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
                {courses.map((course) => {
                  const isDone    = completedIds.has(course.id);
                  const isPlanned = !isDone && !!plannedSemesters[course.id];
                  return (
                    <button
                      key={course.id}
                      onClick={() => setSelected(course)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        isDone
                          ? "bg-green-50/70 hover:bg-green-50"
                          : isPlanned
                          ? "bg-primary/3 hover:bg-primary/5"
                          : "hover:bg-muted/50",
                        selected?.id === course.id && "bg-primary/5"
                      )}
                    >
                      {/* Completion indicator — left-edge column */}
                      <div className="flex-shrink-0 w-5 flex items-center justify-center">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : isPlanned ? (
                          <Circle className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <span className={cn("w-2 h-2 rounded-full", LABEL_DOT[course.label])} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-sm font-semibold",
                            isDone ? "text-green-700" : "text-foreground"
                          )}>
                            {course.code}
                          </span>
                          {isDone ? (
                            <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              Completed
                            </span>
                          ) : isPlanned ? (
                            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {plannedSemesters[course.id]}
                            </span>
                          ) : (
                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", LABEL_BADGE[course.label])}>
                              {LABEL_META[course.label].label}
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          "text-xs truncate",
                          isDone ? "text-green-700/70" : "text-muted-foreground"
                        )}>
                          {course.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex gap-0.5">
                          {(["Fall", "Spring", "Summer"] as SemesterTerm[]).map((t) => (
                            <span
                              key={t}
                              className={cn(
                                "text-[9px] font-semibold w-4 h-4 rounded flex items-center justify-center",
                                course.offeredTerms.includes(t)
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground/40"
                              )}
                            >
                              {TERM_SHORT[t]}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{course.credits}cr</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && allCourses.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No courses match your filters.</p>
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <aside className={cn(
          "flex flex-col border-l border-border bg-card overflow-hidden",
          "w-full md:w-80 lg:w-96"
        )}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Course Details</h3>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full mt-0.5", LABEL_DOT[selected.label])} />
                <span className="text-lg font-bold text-foreground">{selected.code}</span>
              </div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", LABEL_BADGE[selected.label])}>
                {LABEL_META[selected.label].label}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground mb-3">{selected.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{selected.description || "No description available."}</p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Credits</p>
                <p className="font-semibold text-foreground">{selected.credits}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Level</p>
                <p className="font-semibold text-foreground">{selected.level}</p>
              </div>
            </div>

            <div className="mb-5">
              <Accordion type="single" collapsible className="w-full rounded-lg border border-border px-3">
                <AccordionItem value="offered-terms" className="border-b-0">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold text-foreground">Offered Terms</span>
                      <span className="text-xs text-muted-foreground">
                        {selected.offeredTerms.length > 0
                          ? selected.offeredTerms.join(", ")
                          : "No term data available"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {TERMS.map((t) => (
                        <span
                          key={t}
                          className={cn(
                            "text-xs font-medium px-2.5 py-1 rounded-md border",
                            selected.offeredTerms.includes(t)
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground/40 border-border"
                          )}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {selected.prereqs.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-foreground mb-2">Prerequisites</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.prereqs.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        const c = planCatalog[code];
                        if (c) setSelected(c);
                      }}
                      className="text-xs bg-muted border border-border rounded-md px-2.5 py-1 font-medium hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            {plannedSemesters[selected.id] ? (
              <div className="flex items-center justify-center gap-2 py-2 text-green-600 text-sm font-medium">
                <Check className="w-4 h-4" />
                In {plannedSemesters[selected.id]}
              </div>
            ) : plannableSemesters.length === 0 ? (
              <Button className="w-full gap-2" disabled>
                No semester available
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={() => openAddDialog(selected)}>
                Add to Planner
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </aside>
      )}

      <Dialog
        open={semesterDialogOpen}
        onOpenChange={(open) => {
          setSemesterDialogOpen(open);
          if (!open) {
            setTargetCourse(null);
            setAdding(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Planner</DialogTitle>
            <DialogDescription>
              Choose which semester should receive {targetCourse?.code ?? "this course"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{targetCourse?.code}</p>
              <p className="text-xs text-muted-foreground">{targetCourse?.title}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Semester</p>
              <Select value={targetSemesterId} onValueChange={setTargetSemesterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose semester" />
                </SelectTrigger>
                <SelectContent>
                  {plannableSemesters.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.term} {semester.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSemesterDialogOpen(false);
                setTargetCourse(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddToPlanner} disabled={!targetSemesterId || adding}>
              {adding ? "Adding..." : "Add course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
