-- ============================================================================
-- DATABASE SCHEMA INSPECTION
-- Run this to see all tables, columns, and relationships in your database
-- ============================================================================

-- ============================================================================
-- 1. LIST ALL TABLES
-- ============================================================================
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- ============================================================================
-- 2. SHOW ALL COLUMNS FOR EACH TABLE
-- ============================================================================
SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ============================================================================
-- 3. SHOW FOREIGN KEY RELATIONSHIPS
-- ============================================================================
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ============================================================================
-- 4. SHOW ALL INDEXES
-- ============================================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ============================================================================
-- 5. SHOW PRIMARY KEYS
-- ============================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ============================================================================
-- 6. SHOW UNIQUE CONSTRAINTS
-- ============================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ============================================================================
-- 7. DETAILED TABLE STRUCTURE (Run for each table)
-- Replace 'table_name' with actual table names you see from query #1
-- ============================================================================

-- Example for 'courses' table:
-- \d courses

-- Or use this query:
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.is_nullable,
    c.column_default,
    pgd.description
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st
    ON c.table_schema = st.schemaname AND c.table_name = st.relname
LEFT JOIN pg_catalog.pg_description pgd
    ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'public'
    AND c.table_name = 'courses'  -- CHANGE THIS to inspect different tables
ORDER BY c.ordinal_position;


-- ============================================================================
-- 8. COUNT ROWS IN EACH TABLE
-- ============================================================================
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;


-- ============================================================================
-- 9. CHECK IF REQUIREMENTS TABLES ALREADY EXIST
-- ============================================================================
SELECT
    table_name,
    CASE
        WHEN table_name IN ('majors', 'requirement_groups', 'requirement_courses', 'requirement_rules')
        THEN 'EXISTS - Requirements table already created'
        ELSE 'Other table'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('majors', 'requirement_groups', 'requirement_courses', 'requirement_rules',
                       'courses', 'sections', 'subjects', 'profiles', 'plans', 'plan_semesters', 'plan_courses')
ORDER BY table_name;
