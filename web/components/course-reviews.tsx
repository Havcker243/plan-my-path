"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { fetchReviews, type CourseReview } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export default function CourseReviews({ courseCode }: { courseCode: string }) {
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReviews(courseCode)
      .then(setReviews)
      .catch((err) => { console.error("[course-reviews] load failed:", err); setReviews([]); })
      .finally(() => setLoading(false));
  }, [courseCode]);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Student Reviews
          {!loading && reviews.length > 0 && (
            <span className="text-muted-foreground font-normal">({reviews.length})</span>
          )}
        </p>
        <Link
          href={`/hub?course=${encodeURIComponent(courseCode)}`}
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all in Hub <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">No reviews yet.</p>
          <Link
            href={`/hub?course=${encodeURIComponent(courseCode)}`}
            className="text-xs text-primary font-medium hover:text-primary/80 transition-colors"
          >
            Be the first to review in the Hub →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.slice(0, 2).map((review) => (
            <div key={review.id} className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {review.term_taken && review.year_taken && (
                  <span className="text-[9px] font-medium bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                    {review.term_taken} {review.year_taken}
                  </span>
                )}
                {review.professor && (
                  <span className="text-[9px] text-muted-foreground">with {review.professor}</span>
                )}
                <span className="text-[9px] text-muted-foreground ml-auto">{timeAgo(review.created_at)}</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed line-clamp-2">{review.comment}</p>
            </div>
          ))}
          {reviews.length > 2 && (
            <Link
              href={`/hub?course=${encodeURIComponent(courseCode)}`}
              className="block text-center text-xs text-primary font-medium hover:text-primary/80 transition-colors pt-1"
            >
              See {reviews.length - 2} more in Hub →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
