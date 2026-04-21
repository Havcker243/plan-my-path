-- Add structured rating fields to course_reviews
-- Run in Supabase SQL Editor

ALTER TABLE course_reviews
  ADD COLUMN IF NOT EXISTS difficulty     INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS quality        INTEGER CHECK (quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS would_take_again BOOLEAN,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]  DEFAULT '{}';

-- Index professor for the new Professors tab aggregation query
CREATE INDEX IF NOT EXISTS idx_course_reviews_professor ON course_reviews (professor);
