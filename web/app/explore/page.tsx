"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  MessageSquare,
  ArrowRight,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";
import { formatSectionTime } from "@/lib/planner";
import {
  searchCourses,
  fetchReviews,
  fetchSubjects,
  type BackendCourse,
  type BackendSection,
  type CourseReview,
  type Major,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDays(days: string | null): string {
  if (!days) return "";
  return days
    .replace(/Mo/g, "Mon")
    .replace(/Tu/g, "Tue")
    .replace(/We/g, "Wed")
    .replace(/Th/g, "Thu")
    .replace(/Fr/g, "Fri")
    .replace(/Sa/g, "Sat")
    .replace(/Su/g, "Sun");
}



function creditRange(credits: BackendCourse["credits"]): string {
  const { min_credits: min, max_credits: max } = credits;
  if (min === max || max === null) return `${min ?? "?"}`;
  return `${min}–${max}`;
}

// ─── Section row ─────────────────────────────────────────────────────────────

function SectionRow({ section }: { section: BackendSection }) {
  const mt = section.meeting_times[0];
  const instructor = section.instructors[0]?.name ?? null;
  const seats = section.seats;
  const available = seats.available ?? (seats.capacity - (seats.enrolled ?? 0));

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 text-xs py-2 border-b border-border/50 last:border-0">
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-mono font-semibold text-foreground">{section.section_code}</span>
          {section.modality && (
            <span className="text-muted-foreground">{section.modality}</span>
          )}
          {instructor && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="w-3 h-3" /> {instructor}
            </span>
          )}
        </div>
        {mt && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
            {mt.days && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> {formatDays(mt.days)}
              </span>
            )}
            {mt.start_time && mt.end_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatSectionTime(mt.start_time)} – {formatSectionTime(mt.end_time)}
              </span>
            )}
            {(mt.building || mt.room) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {[mt.building, mt.room].filter(Boolean).join(" ")}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          available > 5 ? "bg-green-50 text-green-700" :
          available > 0 ? "bg-yellow-50 text-yellow-700" :
          "bg-red-50 text-red-700"
        )}>
          {available > 0 ? `${available} open` : "Full"}
        </span>
      </div>
    </div>
  );
}

// ─── Reviews panel ────────────────────────────────────────────────────────────

function ReviewsPanel({ courseCode }: { courseCode: string }) {
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReviews(courseCode)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [courseCode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading reviews…
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-3 italic">
        No reviews yet.{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up to be the first.
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.slice(0, 3).map((r) => (
        <div key={r.id} className="rounded-lg bg-muted/60 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>
              {[r.term_taken, r.year_taken].filter(Boolean).join(" ")}
              {r.professor ? ` · ${r.professor}` : ""}
            </span>
            <span>{timeAgo(r.created_at)}</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{r.comment}</p>
        </div>
      ))}
      {reviews.length > 3 && (
        <Link
          href={`/hub?course=${encodeURIComponent(courseCode)}`}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all {reviews.length} reviews <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Course card ──────────────────────────────────────────────────────────────

type Tab = "schedule" | "reviews";

function CourseCard({ course }: { course: BackendCourse }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("schedule");

  const hasSections = course.sections.length > 0;
  const credits = creditRange(course.credits);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold text-foreground">{course.course_code}</span>
            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {credits} cr
            </span>
            {!hasSections && (
              <span className="text-[10px] text-muted-foreground">No sections this term</span>
            )}
          </div>
          <p className="text-sm text-foreground font-medium leading-snug">{course.title ?? "Untitled"}</p>
          {course.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {(["schedule", "reviews"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors",
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "schedule" ? "Schedule & Sections" : "Student Reviews"}
              </button>
            ))}
          </div>

          {tab === "schedule" && (
            hasSections ? (
              <div>
                {course.sections.slice(0, 6).map((s) => (
                  <SectionRow key={s.id} section={s} />
                ))}
                {course.sections.length > 6 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{course.sections.length - 6} more sections
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No sections found for the current term.
              </p>
            )
          )}

          {tab === "reviews" && (
            <ReviewsPanel courseCode={course.course_code} />
          )}

          {/* CTA */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Want to add this to your plan?</p>
              <p className="text-xs text-muted-foreground">Track prereqs, see what fits your schedule, and stay on track to graduate.</p>
            </div>
            <Link href="/signup" className="flex-shrink-0">
              <Button size="sm" className="gap-1.5 text-xs">
                Create free account <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<Major[]>([]);
  const [results, setResults] = useState<BackendCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSubjects().then(setSubjects).catch(() => {});
  }, []);

  const doSearch = useCallback(async (q: string, subj: string) => {
    if (!q.trim() && !subj) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const { data, total: t } = await searchCourses(q, subj || undefined, 1, 30);
      setResults(data);
      setTotal(t);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuery = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, subject), 400);
  };

  const handleSubject = (val: string) => {
    setSubject(val);
    doSearch(query, val);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Fiskpath</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Create Account</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted/40 border-b border-border py-12 px-6 md:px-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <BookOpen className="w-3 h-3" />
            Open to everyone — no account needed
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 text-balance">
            Explore Fisk&apos;s Course Catalog
          </h1>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto leading-relaxed">
            Search any course to see available sections, class times, and what students say.
            Thinking about enrolling? This is the place to start.
          </p>

          {/* Search */}
          <div className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQuery(e.target.value)}
                placeholder="Search by course name or code…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={subject}
              onChange={(e) => handleSubject(e.target.value)}
              className="text-sm rounded-xl border border-input bg-background px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 text-muted-foreground min-w-[110px]"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>{s.code}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">

        {/* Teaser banner — show before search */}
        {!searched && (
          <div className="rounded-xl border border-border bg-card p-6 mb-8 flex flex-col md:flex-row items-center gap-5">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">Already a Fisk student?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sign up to build a full semester-by-semester graduation plan, track degree requirements, get AI advisor recommendations, and see your full class calendar.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href="/login">
                <Button variant="outline" size="sm">Sign in</Button>
              </Link>
              <Link href="/onboarding">
                <Button size="sm" className="gap-1.5">
                  Start planning <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Searching…</span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No courses found</p>
            <p className="text-xs text-muted-foreground">Try a different search term or subject filter.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              {total} course{total !== 1 ? "s" : ""} found
              {(query || subject) && (
                <span>
                  {query ? ` for "${query}"` : ""}
                  {subject ? ` in ${subject}` : ""}
                </span>
              )}
            </p>

            <div className="space-y-3">
              {results.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {total > results.length && (
              <p className="text-center text-xs text-muted-foreground mt-6">
                Showing {results.length} of {total}.{" "}
                <span className="text-foreground">Refine your search to narrow results.</span>
              </p>
            )}
          </>
        )}

        {/* Bottom CTA — always visible after scroll */}
        <div className="mt-12 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">Ready to plan your degree?</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Create a free account to build your full graduation plan, track requirements, and get personalized course recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/onboarding">
              <Button className="gap-2">
                Start Planning Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Fiskpath &copy; 2026</span>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
