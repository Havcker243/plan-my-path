-- Database schema for degree requirements system
-- This allows the app to track what courses are required for each major

-- ============================================================================
-- MAJORS TABLE
-- ============================================================================
-- Stores information about each major/degree program
CREATE TABLE IF NOT EXISTS majors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- e.g., "CSCI", "BIOL", "BUSI"
    name TEXT NOT NULL, -- e.g., "Computer Science"
    degree_type TEXT NOT NULL, -- e.g., "B.S.", "B.A.", "B.F.A."
    total_credits_required INTEGER NOT NULL DEFAULT 120,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by major code
CREATE INDEX IF NOT EXISTS idx_majors_code ON majors(code);

-- ============================================================================
-- REQUIREMENT GROUPS TABLE
-- ============================================================================
-- Stores groups of requirements (e.g., "Major Requirements", "Cognates")
-- Each major has multiple requirement groups
CREATE TABLE IF NOT EXISTS requirement_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    major_id UUID NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL, -- e.g., "major_requirements", "cognates"
    group_name TEXT NOT NULL, -- e.g., "Major Requirements", "CORE - Group E"
    group_type TEXT NOT NULL, -- "all_of", "choose_one", "choose_n", "credit_threshold", "fill_remaining"
    credits_required_min INTEGER, -- minimum credits needed
    credits_required_max INTEGER, -- maximum credits (null if no max)
    courses_required INTEGER, -- for choose_n: how many courses to pick
    description TEXT,
    display_order INTEGER DEFAULT 0, -- for sorting on UI
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure group_id is unique within a major
    UNIQUE(major_id, group_id),

    -- Validation: group_type must be one of the allowed values
    CHECK (group_type IN ('all_of', 'choose_one', 'choose_n', 'credit_threshold', 'fill_remaining'))
);

-- Index for quick lookups by major
CREATE INDEX IF NOT EXISTS idx_requirement_groups_major ON requirement_groups(major_id);

-- ============================================================================
-- REQUIREMENT COURSES TABLE
-- ============================================================================
-- Stores which courses belong to which requirement groups
-- This is the many-to-many relationship between groups and courses
CREATE TABLE IF NOT EXISTS requirement_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES requirement_groups(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL, -- e.g., "CSCI 241", "MATH 120"
    course_name TEXT, -- optional: name for display
    credits INTEGER, -- credits for this course
    is_required BOOLEAN DEFAULT true, -- for choose_one groups, all are options but not individually required
    requires_corequisite TEXT, -- e.g., "CSCI 110L" (course code of required corequisite)
    corequisite_for TEXT, -- e.g., "CSCI 110" (this course is a corequisite for...)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_requirement_courses_group ON requirement_courses(group_id);
CREATE INDEX IF NOT EXISTS idx_requirement_courses_code ON requirement_courses(course_code);

-- ============================================================================
-- REQUIREMENT RULES TABLE
-- ============================================================================
-- Stores special rules for groups (e.g., "any CSCI 200+ level course")
-- Used for major_electives and other pattern-based requirements
CREATE TABLE IF NOT EXISTS requirement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES requirement_groups(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL, -- "subject_level", "exclude_courses", "custom"
    subject_code TEXT, -- e.g., "CSCI" for "any CSCI course"
    min_level INTEGER, -- e.g., 200 for "200 level or above"
    max_level INTEGER, -- optional max level
    exclude_courses TEXT[], -- array of course codes to exclude
    custom_rule_json JSONB, -- for complex rules stored as JSON
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(group_id, rule_type)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_requirement_rules_group ON requirement_rules(group_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE majors IS 'Stores degree programs (majors) offered by the university';
COMMENT ON TABLE requirement_groups IS 'Stores requirement categories for each major (e.g., Major Requirements, Cognates)';
COMMENT ON TABLE requirement_courses IS 'Maps courses to requirement groups (many-to-many relationship)';
COMMENT ON TABLE requirement_rules IS 'Stores pattern-based rules for requirements (e.g., "any 200+ level CSCI course")';

COMMENT ON COLUMN requirement_groups.group_type IS 'Type of requirement: all_of (must take all), choose_one (pick 1), choose_n (pick N), credit_threshold (earn X credits), fill_remaining (general electives)';
COMMENT ON COLUMN requirement_rules.rule_type IS 'Type of rule: subject_level (e.g., CSCI 200+), exclude_courses (blacklist), custom (JSON-based)';
