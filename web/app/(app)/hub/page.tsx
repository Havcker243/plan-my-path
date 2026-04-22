"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Loader2, MessageSquare, Send, Flame, X, Sparkles, Users,
  ThumbsUp, ThumbsDown, Star,
} from "lucide-react";
import AdvisorChat from "@/components/advisor-chat";
import { cn, timeAgo } from "@/lib/utils";
import {
  fetchRecentReviews,
  fetchReviews,
  submitReview,
  searchCourses,
  fetchProfessors,
  fetchProfessorReviews,
  type CourseReview,
  type ProfessorSummary,
  type BackendCourse,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";

const TERMS = ["Fall", "Spring", "Summer", "Winter"] as const;
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

const TAGS = [
  "Tough Grader", "Heavy Workload", "Caring", "Clear Explanations",
  "Group Projects", "Many Tests", "Extra Credit", "Attendance Mandatory",
  "Easy A", "Inspirational", "Accessible Outside Class", "Participation Matters",
];

function StarPicker({
  value, onChange, label,
}: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors border",
              value !== null && n <= value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            <Star className="w-3.5 h-3.5" fill={value !== null && n <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}

function StarDisplay({ value, max = 5, size = "sm" }: { value: number | null; max?: number; size?: "sm" | "xs" }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5", i < Math.round(value) ? "text-primary" : "text-border")}
          fill={i < Math.round(value) ? "currentColor" : "none"}
        />
      ))}
      <span className={cn("ml-1 font-medium text-foreground", size === "sm" ? "text-xs" : "text-[10px]")}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewCard({ review }: { review: CourseReview }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-foreground">{review.course_code}</span>
            {review.term_taken && review.year_taken && (
              <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {review.term_taken} {review.year_taken}
              </span>
            )}
            {review.professor && (
              <span className="text-[10px] text-muted-foreground">with {review.professor}</span>
            )}
          </div>
          {review.course_title && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{review.course_title}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(review.created_at)}</span>
      </div>

      {/* Ratings row */}
      {(review.quality !== null || review.difficulty !== null || review.would_take_again !== null) && (
        <div className="flex items-center gap-4 flex-wrap">
          {review.quality !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Quality</span>
              <StarDisplay value={review.quality} size="xs" />
            </div>
          )}
          {review.difficulty !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Difficulty</span>
              <StarDisplay value={review.difficulty} size="xs" />
            </div>
          )}
          {review.would_take_again !== null && (
            <div className="flex items-center gap-1">
              {review.would_take_again
                ? <ThumbsUp className="w-3 h-3 text-green-600" />
                : <ThumbsDown className="w-3 h-3 text-destructive" />}
              <span className="text-[10px] text-muted-foreground">
                {review.would_take_again ? "Would take again" : "Wouldn't take again"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {review.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
    </div>
  );
}

function ProfessorCard({
  prof, onClick,
}: { prof: ProfessorSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground text-sm">{prof.professor}</p>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {prof.review_count} review{prof.review_count !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {prof.avg_quality !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Quality</span>
            <StarDisplay value={prof.avg_quality} size="xs" />
          </div>
        )}
        {prof.avg_difficulty !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Difficulty</span>
            <StarDisplay value={prof.avg_difficulty} size="xs" />
          </div>
        )}
        {prof.would_take_again_pct !== null && (
          <span className={cn(
            "text-[10px] font-medium",
            prof.would_take_again_pct >= 70 ? "text-green-600" : prof.would_take_again_pct >= 40 ? "text-amber-600" : "text-destructive"
          )}>
            {prof.would_take_again_pct}% would take again
          </span>
        )}
      </div>
      {prof.courses.length > 0 && (
        <p className="text-[10px] text-muted-foreground truncate">
          {prof.courses.slice(0, 5).join(" · ")}{prof.courses.length > 5 ? ` +${prof.courses.length - 5} more` : ""}
        </p>
      )}
    </button>
  );
}

function SubmitForm({ defaultCourse, onSubmitted }: { defaultCourse?: string; onSubmitted: (r: CourseReview) => void }) {
  const { user } = useAuth();
  const [courseCode, setCourseCode] = useState(defaultCourse ?? "");
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [year, setYear] = useState(currentYear);
  const [term, setTerm] = useState<string>("Fall");
  const [professor, setProfessor] = useState("");
  const [comment, setComment] = useState("");
  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [wouldTakeAgain, setWouldTakeAgain] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [suggestions, setSuggestions] = useState<BackendCourse[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCourseInput = (val: string) => {
    setCourseCode(val.toUpperCase());
    setCourseTitle(null);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const trimmed = val.trim();
    if (trimmed.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestLoading(true);
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchCourses(trimmed, undefined, 1, 8);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (err) { console.error("[hub] course autocomplete failed:", err); setSuggestions([]); } finally { setSuggestLoading(false); }
    }, 300);
  };

  const selectCourse = (course: BackendCourse) => {
    setCourseCode(course.course_code);
    setCourseTitle(course.title);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 6 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async () => {
    const code = courseCode.trim().toUpperCase();
    if (!code) { toast.error("Enter a course code"); return; }
    if (!comment.trim()) { toast.error("Please write a comment"); return; }
    if (!user) { toast.error("Sign in to leave a review"); return; }
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const review = await submitReview(token, {
        course_code: code, year_taken: year, term_taken: term,
        professor: professor.trim() || null, comment: comment.trim(),
        quality, difficulty, would_take_again: wouldTakeAgain, tags: selectedTags,
      });
      onSubmitted(review);
      setCourseCode(defaultCourse ?? "");
      setCourseTitle(null);
      setComment(""); setProfessor(""); setQuality(null); setDifficulty(null);
      setWouldTakeAgain(null); setSelectedTags([]);
      toast.success("Review submitted — thank you!");
    } catch (err) {
      console.error("[HubPage] submit review error:", err);
      toast.error("Couldn't submit your review. Please try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Share Your Experience</h2>
      <p className="text-xs text-muted-foreground -mt-2">Anonymous — your name is never stored or shown.</p>

      {/* Course autocomplete */}
      <div ref={wrapperRef} className="relative">
        <label className="text-xs font-medium text-muted-foreground block mb-1">Course</label>
        <div className="relative">
          <input
            type="text" value={courseCode} onChange={(e) => handleCourseInput(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Search by code or title…"
            className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {suggestLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        {courseTitle && <p className="text-[11px] text-muted-foreground mt-1 pl-0.5">{courseTitle}</p>}
        {showSuggestions && (
          <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {suggestions.map((c) => (
              <li key={c.course_code}>
                <button type="button" onMouseDown={() => selectCourse(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-baseline gap-2">
                  <span className="text-sm font-mono font-semibold text-foreground shrink-0">{c.course_code}</span>
                  <span className="text-xs text-muted-foreground truncate">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Term + Year */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)}
            className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40">
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Year</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Professor */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Professor <span className="font-normal">(optional)</span>
        </label>
        <input type="text" value={professor} onChange={(e) => setProfessor(e.target.value)}
          placeholder="e.g. Dr. Smith"
          className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Ratings */}
      <div className="grid grid-cols-2 gap-4">
        <StarPicker value={quality} onChange={setQuality} label="Overall Quality" />
        <StarPicker value={difficulty} onChange={setDifficulty} label="Difficulty" />
      </div>

      {/* Would take again */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">Would you take this course again?</label>
        <div className="flex gap-2">
          {([true, false] as const).map((val) => (
            <button key={String(val)} type="button" onClick={() => setWouldTakeAgain(wouldTakeAgain === val ? null : val)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                wouldTakeAgain === val
                  ? val ? "bg-green-600 text-white border-green-600" : "bg-destructive text-destructive-foreground border-destructive"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}>
              {val ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
              {val ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">
          Tags <span className="font-normal">(pick up to 6)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((tag) => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Your review <span className="text-destructive">*</span>
        </label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="What was this class like? Workload, tips, would you recommend it?"
          rows={4} maxLength={2000}
          className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none" />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{comment.length}/2000</p>
      </div>

      <button onClick={handleSubmit} disabled={submitting || !comment.trim() || !courseCode.trim()}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit Review</>}
      </button>
    </div>
  );
}

function ProfessorsTab() {
  const [search, setSearch] = useState("");
  const [professors, setProfessors] = useState<ProfessorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProfessorSummary | null>(null);
  const [profReviews, setProfReviews] = useState<CourseReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProfessors().then(setProfessors).catch((err) => { console.error("[hub] professors load failed:", err); setProfessors([]); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      fetchProfessors(search || undefined).then(setProfessors).catch((err) => { console.error("[hub] professors search failed:", err); setProfessors([]); }).finally(() => setLoading(false));
    }, 300);
  }, [search]);

  const openProfessor = async (prof: ProfessorSummary) => {
    setSelected(prof);
    setLoadingReviews(true);
    try {
      const reviews = await fetchProfessorReviews(prof.professor);
      setProfReviews(reviews);
    } catch (err) { console.error("[hub] professor reviews load failed:", err); setProfReviews([]); } finally { setLoadingReviews(false); }
  };

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
          ← All professors
        </button>
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="text-lg font-bold text-foreground">{selected.professor}</h2>
          <p className="text-xs text-muted-foreground mb-3">{selected.review_count} review{selected.review_count !== 1 ? "s" : ""}</p>
          <div className="flex flex-wrap gap-6">
            {selected.avg_quality !== null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Quality</p>
                <StarDisplay value={selected.avg_quality} />
              </div>
            )}
            {selected.avg_difficulty !== null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Difficulty</p>
                <StarDisplay value={selected.avg_difficulty} />
              </div>
            )}
            {selected.would_take_again_pct !== null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Would Take Again</p>
                <p className={cn("text-sm font-bold",
                  selected.would_take_again_pct >= 70 ? "text-green-600" : selected.would_take_again_pct >= 40 ? "text-amber-600" : "text-destructive"
                )}>{selected.would_take_again_pct}%</p>
              </div>
            )}
          </div>
          {selected.courses.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Courses Taught</p>
              <div className="flex flex-wrap gap-1">
                {selected.courses.map((c) => (
                  <span key={c} className="text-[10px] font-mono font-medium bg-muted px-2 py-0.5 rounded">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {loadingReviews ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {profReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            {profReviews.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No reviews found.</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search professors…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : professors.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No professors yet</p>
          <p className="text-xs text-muted-foreground">Professor profiles appear once students leave reviews with a professor name.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {professors.map((p) => <ProfessorCard key={p.professor} prof={p} onClick={() => openProfessor(p)} />)}
        </div>
      )}
    </div>
  );
}

export default function HubPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"reviews" | "professors" | "advisor">(
    searchParams.get("tab") === "advisor" ? "advisor"
    : searchParams.get("tab") === "professors" ? "professors"
    : "reviews"
  );
  const [recentReviews, setRecentReviews] = useState<CourseReview[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState(false);
  const [query, setQuery] = useState(searchParams.get("course") ?? "");
  const [searchResults, setSearchResults] = useState<CourseReview[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWrite, setShowWrite] = useState(false);
  const [writeForCourse, setWriteForCourse] = useState<string | undefined>();

  useEffect(() => {
    fetchRecentReviews(30)
      .then(setRecentReviews)
      .catch((err) => { console.error("[hub] recent reviews load failed:", err); setRecentError(true); setRecentReviews([]); })
      .finally(() => setLoadingRecent(false));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) { setSearchResults([]); setSearched(false); setSearchError(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await fetchReviews(trimmed);
        setSearchResults(results); setSearchError(false); setSearched(true);
      } catch (err) { console.error("[hub] review search failed:", err); setSearchResults([]); setSearchError(true); setSearched(true); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const handleNewReview = (review: CourseReview) => {
    setRecentReviews((prev) => [review, ...prev]);
    if (searched && query.trim().toUpperCase() === review.course_code)
      setSearchResults((prev) => [review, ...prev]);
    setShowWrite(false);
    setWriteForCourse(undefined);
  };

  const isSearching = query.trim().length > 0;

  return (
    <div className="px-4 md:px-8 py-6 pb-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real experiences from students who&apos;ve been there. Ratings, professor reviews, and your AI advisor.
          </p>
        </div>
        {tab === "reviews" && (
          <button onClick={() => { setWriteForCourse(undefined); setShowWrite(true); }}
            className="flex-shrink-0 flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors">
            <MessageSquare className="w-4 h-4" /> Write a Review
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border border-border rounded-xl p-1 bg-muted/30 w-fit">
        {(["reviews", "professors", "advisor"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "reviews" && <><MessageSquare className="w-3.5 h-3.5" /> Reviews</>}
            {t === "professors" && <><Users className="w-3.5 h-3.5" /> Professors</>}
            {t === "advisor" && <><Sparkles className="w-3.5 h-3.5" /> AI Advisor</>}
          </button>
        ))}
      </div>

      {tab === "advisor" && (
        <div className="bg-card border border-border rounded-xl p-5"><AdvisorChat /></div>
      )}

      {tab === "professors" && <ProfessorsTab />}

      {tab === "reviews" && (
        <>
          {showWrite && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">New Review</p>
                <button onClick={() => setShowWrite(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SubmitForm defaultCourse={writeForCourse} onSubmitted={handleNewReview} />
            </div>
          )}

          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course code (e.g. CSCI-241)…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {isSearching && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Results for {query.trim().toUpperCase()}</p>
                {searched && (
                  <button onClick={() => { setWriteForCourse(query.trim().toUpperCase()); setShowWrite(true); }}
                    className="text-xs text-primary font-medium hover:text-primary/80 transition-colors">
                    + Review this course
                  </button>
                )}
              </div>
              {searching ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : searchError && searched ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <p className="text-sm font-medium text-foreground mb-1">Couldn&apos;t load reviews</p>
                  <p className="text-xs text-muted-foreground">Try again in a moment.</p>
                </div>
              ) : searchResults.length === 0 && searched ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No reviews yet for {query.trim().toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground mb-4">Be the first student to share your experience.</p>
                  <button onClick={() => { setWriteForCourse(query.trim().toUpperCase()); setShowWrite(true); }}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Write the first review →
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">{searchResults.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
              )}
            </div>
          )}

          {!isSearching && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Recent Reviews</p>
                {recentReviews.length > 0 && <span className="text-xs text-muted-foreground">{recentReviews.length} reviews</span>}
              </div>
              {loadingRecent ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : recentError ? (
                <div className="text-center py-16 border border-dashed border-border rounded-xl">
                  <p className="text-sm font-semibold text-foreground mb-1">Reviews unavailable</p>
                  <p className="text-xs text-muted-foreground">Couldn&apos;t load reviews right now.</p>
                </div>
              ) : recentReviews.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-xl">
                  <Flame className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground mb-1">No reviews yet</p>
                  <p className="text-xs text-muted-foreground mb-5">The Hub is brand new. Be the first student to leave a review.</p>
                  <button onClick={() => { setWriteForCourse(undefined); setShowWrite(true); }}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Write the first review →
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">{recentReviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
