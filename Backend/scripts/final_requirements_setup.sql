-- ============================================================================
-- FINAL REQUIREMENTS SYSTEM SETUP
-- Integrates with existing schema (profiles, courses, plans, etc.)
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE REQUIREMENTS TABLES
-- ============================================================================

-- Majors table
-- Links to profiles.major_code (TEXT)
CREATE TABLE IF NOT EXISTS majors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- matches profiles.major_code (e.g., "CSCI")
    name TEXT NOT NULL,
    degree_type TEXT NOT NULL,
    total_credits_required INTEGER NOT NULL DEFAULT 120,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requirement groups table
CREATE TABLE IF NOT EXISTS requirement_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    major_id UUID NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    group_type TEXT NOT NULL,
    credits_required_min INTEGER,
    credits_required_max INTEGER,
    courses_required INTEGER,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(major_id, group_id),
    CHECK (group_type IN ('all_of', 'choose_one', 'choose_n', 'credit_threshold', 'fill_remaining'))
);

-- Requirement courses table
-- course_code matches courses.course_code (TEXT)
CREATE TABLE IF NOT EXISTS requirement_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES requirement_groups(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL, -- matches courses.course_code
    course_name TEXT,
    credits INTEGER,
    is_required BOOLEAN DEFAULT true,
    requires_corequisite TEXT,
    corequisite_for TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requirement rules table
CREATE TABLE IF NOT EXISTS requirement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES requirement_groups(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    subject_code TEXT, -- matches subjects.code
    min_level INTEGER,
    max_level INTEGER,
    exclude_courses TEXT[],
    custom_rule_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, rule_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_majors_code ON majors(code);
CREATE INDEX IF NOT EXISTS idx_requirement_groups_major ON requirement_groups(major_id);
CREATE INDEX IF NOT EXISTS idx_requirement_courses_group ON requirement_courses(group_id);
CREATE INDEX IF NOT EXISTS idx_requirement_courses_code ON requirement_courses(course_code);
CREATE INDEX IF NOT EXISTS idx_requirement_rules_group ON requirement_rules(group_id);

-- Add comments
COMMENT ON TABLE majors IS 'Degree programs (CS, Biology, etc.) - links to profiles.major_code';
COMMENT ON TABLE requirement_groups IS 'Requirement categories (Major Requirements, Cognates, etc.)';
COMMENT ON TABLE requirement_courses IS 'Courses that belong to requirement groups - links to courses.course_code';
COMMENT ON TABLE requirement_rules IS 'Pattern-based rules (e.g., "any CSCI 200+ level")';

COMMENT ON COLUMN majors.code IS 'Major code - matches profiles.major_code (e.g., "CSCI")';
COMMENT ON COLUMN requirement_courses.course_code IS 'Course code - matches courses.course_code (e.g., "CSCI 241")';


-- ============================================================================
-- STEP 2: INSERT CS MAJOR
-- ============================================================================

INSERT INTO majors (code, name, degree_type, total_credits_required, description)
VALUES (
    'CSCI',
    'Computer Science',
    'B.S.',
    120,
    'Bachelor of Science in Computer Science'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    degree_type = EXCLUDED.degree_type,
    total_credits_required = EXCLUDED.total_credits_required,
    updated_at = NOW();


-- ============================================================================
-- STEP 3: INSERT REQUIREMENT GROUPS AND COURSES
-- ============================================================================

DO $$
DECLARE
    cs_major_id UUID;
    core_fixed_id UUID;
    core_a_id UUID;
    core_c_id UUID;
    core_d_id UUID;
    core_e_id UUID;
    foreign_lang_id UUID;
    cognates_id UUID;
    major_req_id UUID;
    major_elec_id UUID;
    general_elec_id UUID;
BEGIN
    -- Get CS major ID
    SELECT id INTO cs_major_id FROM majors WHERE code = 'CSCI';

    -- Insert CORE Requirements - Fixed Courses
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'core_fixed', 'CORE Requirements - Fixed Courses', 'all_of', 18, 18, 'Required core curriculum courses', 1)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO core_fixed_id;

    INSERT INTO requirement_courses (group_id, course_code, course_name, credits) VALUES
    (core_fixed_id, 'CORE 100', 'New Student Orientation Seminar', 1),
    (core_fixed_id, 'CORE 150', 'Composition I', 3),
    (core_fixed_id, 'CORE 160', 'Composition II and Oral Communication', 3),
    (core_fixed_id, 'CORE 120', 'Critical Thinking', 2),
    (core_fixed_id, 'CORE 201', 'Introduction to Business and Entrepreneurship', 3),
    (core_fixed_id, 'CORE 260', 'Humanities', 3),
    (core_fixed_id, 'CORE 360', 'The World and Its Peoples', 3);

    -- Insert CORE - Group A: Cultural Exposure
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'core_group_a', 'CORE - Group A: Cultural Exposure', 'choose_one', 3, 3, 'Choose one course from Group A', 2)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO core_a_id;

    INSERT INTO requirement_courses (group_id, course_code, credits, is_required) VALUES
    (core_a_id, 'ART 291', 3, false),
    (core_a_id, 'ART 292', 3, false),
    (core_a_id, 'ENG 180S', 2, false),
    (core_a_id, 'ENG 275', 3, false),
    (core_a_id, 'HIS 180', 3, false),
    (core_a_id, 'HIS 270', 3, false),
    (core_a_id, 'MUS 200', 2, false),
    (core_a_id, 'MUS 206', 3, false),
    (core_a_id, 'HSS 250', 3, false);

    -- Insert CORE - Group C: The Arts
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'core_group_c', 'CORE - Group C: The Arts', 'choose_one', 3, 3, 'Choose one course from Group C', 3)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO core_c_id;

    INSERT INTO requirement_courses (group_id, course_code, credits, is_required) VALUES
    (core_c_id, 'CORE 220', 3, false),
    (core_c_id, 'MUS 207', 3, false),
    (core_c_id, 'MUS 208', 3, false),
    (core_c_id, 'MUS 205', 3, false),
    (core_c_id, 'ART 207', 3, false),
    (core_c_id, 'ART 208', 3, false),
    (core_c_id, 'HSS 170T', 3, false),
    (core_c_id, 'ENG 180A', 3, false);

    -- Insert CORE - Group D: The Science
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'core_group_d', 'CORE - Group D: The Science', 'choose_one', 3, 4, 'Choose one course from Group D', 4)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO core_d_id;

    INSERT INTO requirement_courses (group_id, course_code, credits, is_required) VALUES
    (core_d_id, 'CORE 240', 3, false),
    (core_d_id, 'BIOL 101', 3, false),
    (core_d_id, 'CHEM 113', 3, false),
    (core_d_id, 'PHYS 130', 3, false),
    (core_d_id, 'PHYS 117', 3, false);

    -- Insert CORE - Group E: Social Science
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'core_group_e', 'CORE - Group E: Social Science', 'choose_one', 3, 3, 'Choose one course from Group E', 5)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO core_e_id;

    INSERT INTO requirement_courses (group_id, course_code, credits, is_required) VALUES
    (core_e_id, 'ECON 230', 3, false),
    (core_e_id, 'ECON 240', 3, false),
    (core_e_id, 'HIS 160', 3, false),
    (core_e_id, 'PSCI 122', 3, false),
    (core_e_id, 'PSY 180', 3, false),
    (core_e_id, 'SOC 100', 3, false);

    -- Insert Foreign Language
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order, notes)
    VALUES (cs_major_id, 'foreign_language', 'Foreign Language', 'all_of', 6, 6, 'Elementary foreign language I and II', 6, 'Must complete a sequence (e.g., SPAN 101 + SPAN 102)')
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO foreign_lang_id;

    INSERT INTO requirement_courses (group_id, course_code, course_name, credits) VALUES
    (foreign_lang_id, 'SPAN 101', 'Elementary Spanish I', 3),
    (foreign_lang_id, 'SPAN 102', 'Elementary Spanish II', 3),
    (foreign_lang_id, 'JPN 101', 'Elementary Japanese I', 3),
    (foreign_lang_id, 'JPN 102', 'Elementary Japanese II', 3),
    (foreign_lang_id, 'FREN 101', 'Elementary French I', 3),
    (foreign_lang_id, 'FREN 102', 'Elementary French II', 3);

    -- Insert Cognates
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'cognates', 'Required Cognates', 'all_of', 17, 17, 'Mathematics and statistics courses required for CS major', 7)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO cognates_id;

    INSERT INTO requirement_courses (group_id, course_code, course_name, credits) VALUES
    (cognates_id, 'MATH 120', 'Calculus I', 4),
    (cognates_id, 'MATH 130', 'Calculus II', 4),
    (cognates_id, 'MATH 125', 'Discrete Mathematics', 3),
    (cognates_id, 'MATH 240', 'Linear Algebra', 3),
    (cognates_id, 'NSCI 360', 'Statistics', 3);

    -- Insert Major Requirements
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'major_requirements', 'Major Requirements', 'all_of', 37, 37, 'Required computer science courses and labs', 8)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO major_req_id;

    INSERT INTO requirement_courses (group_id, course_code, course_name, credits, requires_corequisite) VALUES
    (major_req_id, 'CSCI 110', 'Introduction to Computer Science I', 3, 'CSCI 110L'),
    (major_req_id, 'CSCI 110L', 'Introduction to CS Lab I', 1, null),
    (major_req_id, 'CSCI 120', 'Introduction to Computer Science II', 3, 'CSCI 120L'),
    (major_req_id, 'CSCI 120L', 'Intro. to Comp. Sci. II Lab', 1, null),
    (major_req_id, 'CSCI 210', 'Sophomore Seminar', 1, null),
    (major_req_id, 'CSCI 230', 'Computer Organization', 3, 'CSCI 230L'),
    (major_req_id, 'CSCI 230L', 'Computer Organization Lab', 1, null),
    (major_req_id, 'CSCI 241', 'Data Structures and Algorithms', 3, 'CSCI 241L'),
    (major_req_id, 'CSCI 241L', 'Data Structures and Algo Lab', 1, null),
    (major_req_id, 'CSCI 261', 'Operating Systems', 3, 'CSCI 261L'),
    (major_req_id, 'CSCI 261L', 'Operating Systems Lab', 1, null),
    (major_req_id, 'CSCI 282', 'Programming Languages', 3, 'CSCI 282L'),
    (major_req_id, 'CSCI 282L', 'Programming Languages Lab', 1, null),
    (major_req_id, 'CSCI 291', 'Theory of Computation', 3, null),
    (major_req_id, 'CSCI 310', 'Junior Seminar', 1, null),
    (major_req_id, 'CSCI 312', 'Database Management', 3, 'CSCI 312L'),
    (major_req_id, 'CSCI 312L', 'Database Management Lab', 1, null),
    (major_req_id, 'CSCI 411', 'Senior Seminar I', 2, null),
    (major_req_id, 'CSCI 412', 'Senior Seminar II', 2, null);

    -- Insert Major Electives
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'major_electives', 'Major Required Electives', 'credit_threshold', 6, 8, 'Departmentally approved CS electives at 200 level or above', 9)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO major_elec_id;

    -- Insert rule for major electives (any CSCI 200+ not in required list)
    INSERT INTO requirement_rules (group_id, rule_type, subject_code, min_level, exclude_courses)
    VALUES (
        major_elec_id,
        'subject_level',
        'CSCI',
        200,
        ARRAY['CSCI 210', 'CSCI 230', 'CSCI 230L', 'CSCI 241', 'CSCI 241L',
              'CSCI 261', 'CSCI 261L', 'CSCI 282', 'CSCI 282L', 'CSCI 291',
              'CSCI 310', 'CSCI 312', 'CSCI 312L', 'CSCI 411', 'CSCI 412']
    )
    ON CONFLICT (group_id, rule_type) DO UPDATE
    SET subject_code = EXCLUDED.subject_code,
        min_level = EXCLUDED.min_level,
        exclude_courses = EXCLUDED.exclude_courses;

    -- Insert General Electives
    INSERT INTO requirement_groups (major_id, group_id, group_name, group_type, credits_required_min, credits_required_max, description, display_order)
    VALUES (cs_major_id, 'general_electives', 'General Electives', 'fill_remaining', null, null, 'Any courses to reach 120 total credits', 10)
    ON CONFLICT (major_id, group_id) DO UPDATE SET updated_at = NOW();

END $$;


-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Show all majors
SELECT * FROM majors;

-- Show all requirement groups for CS with course counts
SELECT
    rg.group_name,
    rg.group_type,
    rg.credits_required_min || '-' || COALESCE(rg.credits_required_max::text, rg.credits_required_min::text) as credits,
    COUNT(rc.id) as num_courses
FROM requirement_groups rg
LEFT JOIN requirement_courses rc ON rc.group_id = rg.id
JOIN majors m ON m.id = rg.major_id
WHERE m.code = 'CSCI'
GROUP BY rg.id, rg.group_name, rg.group_type, rg.credits_required_min, rg.credits_required_max, rg.display_order
ORDER BY rg.display_order;

-- Show sample: Major Requirements courses
SELECT
    rc.course_code,
    rc.course_name,
    rc.credits
FROM requirement_courses rc
JOIN requirement_groups rg ON rg.id = rc.group_id
JOIN majors m ON m.id = rg.major_id
WHERE m.code = 'CSCI' AND rg.group_id = 'major_requirements'
ORDER BY rc.course_code;

-- Show how many courses link to existing courses table
SELECT
    COUNT(DISTINCT rc.course_code) as total_requirement_courses,
    COUNT(DISTINCT c.course_code) as courses_exist_in_catalog,
    COUNT(DISTINCT rc.course_code) - COUNT(DISTINCT c.course_code) as missing_from_catalog
FROM requirement_courses rc
JOIN requirement_groups rg ON rg.id = rc.group_id
JOIN majors m ON m.id = rg.major_id
LEFT JOIN courses c ON c.course_code = rc.course_code
WHERE m.code = 'CSCI';
