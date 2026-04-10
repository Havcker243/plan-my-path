-- Course reviews schema
-- Anonymous reviews left by students for courses they've taken.
-- No user_id stored — auth is required to post (prevents spam) but identity is not recorded.

CREATE TABLE IF NOT EXISTS course_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code TEXT NOT NULL,          -- e.g. "CSCI-241"
    year_taken INTEGER,                 -- e.g. 2024
    term_taken TEXT,                    -- e.g. "Fall", "Spring"
    professor TEXT,                     -- optional, free-text
    comment TEXT NOT NULL,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_code ON course_reviews (course_code);
CREATE INDEX IF NOT EXISTS idx_course_reviews_created_at ON course_reviews (created_at DESC);
