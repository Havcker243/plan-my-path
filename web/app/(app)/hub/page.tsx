"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Loader2, MessageSquare, Send, Flame, X, Sparkles } from "lucide-react";
import AdvisorChat from "@/components/advisor-chat";
import { cn, timeAgo } from "@/lib/utils";
import {
  fetchRecentReviews,
  fetchReviews,
  submitReview,
  type CourseReview,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";

const TERMS = ["Fall", "Spring", "Summer", "Winter"] as const;
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);


function ReviewCard({ review }: { review: CourseReview }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-foreground">
            {review.course_code}
          </span>
          {review.term_taken && review.year_taken && (
            <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {review.term_taken} {review.year_taken}
            </span>
          )}
          {review.professor && (
            <span className="text-[10px] text-muted-foreground">
              with {review.professor}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {timeAgo(review.created_at)}
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
    </div>
  );
}

function SubmitForm({
  defaultCourse,
  onSubmitted,
}: {
  defaultCourse?: string;
  onSubmitted: (review: CourseReview) => void;
}) {
  const { user } = useAuth();
  const [courseCode, setCourseCode] = useState(defaultCourse ?? "");
  const [year, setYear] = useState(currentYear);
  const [term, setTerm] = useState<string>("Fall");
  const [professor, setProfessor] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        course_code: code,
        year_taken: year,
        term_taken: term,
        professor: professor.trim() || null,
        comment: comment.trim(),
      });

      onSubmitted(review);
      setCourseCode(defaultCourse ?? "");
      setComment("");
      setProfessor("");
      toast.success("Review submitted — thank you!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Share Your Experience</h2>
      <p className="text-xs text-muted-foreground -mt-2">
        Anonymous — your name is never stored or shown.
      </p>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Course Code</label>
        <input
          type="text"
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
          placeholder="e.g. CSCI-241"
          className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Professor <span className="font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={professor}
          onChange={(e) => setProfessor(e.target.value)}
          placeholder="e.g. Dr. Smith"
          className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Your review <span className="text-destructive">*</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What was this class like? Workload, tips, would you recommend it?"
          rows={4}
          maxLength={2000}
          className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{comment.length}/2000</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !comment.trim() || !courseCode.trim()}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          : <><Send className="w-4 h-4" /> Submit Review</>}
      </button>
    </div>
  );
}

export default function HubPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"reviews" | "advisor">(
    searchParams.get("tab") === "advisor" ? "advisor" : "reviews"
  );
  const [recentReviews, setRecentReviews] = useState<CourseReview[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState(false);

  // Course search — pre-fill from ?course= param
  const [query, setQuery] = useState(searchParams.get("course") ?? "");
  const [searchResults, setSearchResults] = useState<CourseReview[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Write review panel
  const [showWrite, setShowWrite] = useState(false);
  const [writeForCourse, setWriteForCourse] = useState<string | undefined>();

  useEffect(() => {
    fetchRecentReviews(30)
      .then(setRecentReviews)
      .catch(() => { setRecentError(true); setRecentReviews([]); })
      .finally(() => setLoadingRecent(false));
  }, []);

  // Debounced search by course code
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) {
      setSearchResults([]);
      setSearched(false);
      setSearchError(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await fetchReviews(trimmed);
        setSearchResults(results);
        setSearchError(false);
        setSearched(true);
      } catch {
        setSearchResults([]);
        setSearchError(true);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const handleNewReview = (review: CourseReview) => {
    setRecentReviews((prev) => [review, ...prev]);
    if (searched && searchResults.length >= 0 && query.trim().toUpperCase() === review.course_code) {
      setSearchResults((prev) => [review, ...prev]);
    }
    setShowWrite(false);
    setWriteForCourse(undefined);
  };

  const isSearching = query.trim().length > 0;

  return (
    <div className="px-4 md:px-8 py-6 pb-20 md:pb-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real experiences from students who&apos;ve been there. Search any course to see what others say.
          </p>
        </div>
        <button
          onClick={() => { setWriteForCourse(undefined); setShowWrite(true); }}
          className="flex-shrink-0 flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-4 h-4" /> Write a Review
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border border-border rounded-xl p-1 bg-muted/30 w-fit">
        <button
          onClick={() => setTab("reviews")}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors",
            tab === "reviews"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Reviews
        </button>
        <button
          onClick={() => setTab("advisor")}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors",
            tab === "advisor"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" /> AI Advisor
        </button>
      </div>

      {/* AI Advisor tab */}
      {tab === "advisor" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <AdvisorChat />
        </div>
      )}

      {tab === "reviews" && (<>

      {/* Write review panel */}
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

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course code (e.g. CSCI-241)…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search results */}
      {isSearching && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Results for {query.trim().toUpperCase()}
            </p>
            {searched && (
              <button
                onClick={() => { setWriteForCourse(query.trim().toUpperCase()); setShowWrite(true); }}
                className="text-xs text-primary font-medium hover:text-primary/80 transition-colors"
              >
                + Review this course
              </button>
            )}
          </div>

          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchError && searched ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Couldn&apos;t load reviews</p>
              <p className="text-xs text-muted-foreground">Try again in a moment.</p>
            </div>
          ) : searchResults.length === 0 && searched ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No reviews yet for {query.trim().toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mb-4">Be the first student to share your experience.</p>
              <button
                onClick={() => { setWriteForCourse(query.trim().toUpperCase()); setShowWrite(true); }}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Write the first review →
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {searchResults.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}
        </div>
      )}

      {/* Recent reviews feed */}
      {!isSearching && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Recent Reviews</p>
            {recentReviews.length > 0 && (
              <span className="text-xs text-muted-foreground">{recentReviews.length} reviews</span>
            )}
          </div>

          {loadingRecent ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentError ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Reviews unavailable</p>
              <p className="text-xs text-muted-foreground">
                Couldn&apos;t load reviews right now. Try again in a moment.
              </p>
            </div>
          ) : recentReviews.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Flame className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No reviews yet</p>
              <p className="text-xs text-muted-foreground mb-5">
                The Hub is brand new. Be the first student to leave a review.
              </p>
              <button
                onClick={() => { setWriteForCourse(undefined); setShowWrite(true); }}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Write the first review →
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}
        </>
      )}

      </>)}
    </div>
  );
}
