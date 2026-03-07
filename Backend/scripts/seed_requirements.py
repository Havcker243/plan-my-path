#!/usr/bin/env python3
"""
Seed the database with CS degree requirements

This script reads cs_requirements.json and populates the Supabase database
with major requirements, requirement groups, and requirement courses.

Usage:
    python seed_requirements.py
"""

import json
import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

def get_db_connection():
    """Get database connection from environment variables"""
    database_url = os.getenv('SUPABASE_DB_URL') or os.getenv('DATABASE_URL')

    if not database_url:
        print("ERROR: SUPABASE_DB_URL or DATABASE_URL environment variable not set")
        print("\nPlease set it in your .env file:")
        print('SUPABASE_DB_URL="postgresql://postgres:[password]@[host]:[port]/postgres"')
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)


def load_requirements_json(filepath):
    """Load requirements JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Requirements file not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in requirements file: {e}")
        sys.exit(1)


def seed_major(conn, requirements_data):
    """Insert or update major record"""
    cur = conn.cursor()

    major_code = requirements_data['major_code']
    major_name = requirements_data['major_name']
    degree_type = requirements_data['degree_type']
    total_credits = requirements_data['total_credits_required']

    # Upsert major
    cur.execute("""
        INSERT INTO majors (code, name, degree_type, total_credits_required)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            degree_type = EXCLUDED.degree_type,
            total_credits_required = EXCLUDED.total_credits_required,
            updated_at = NOW()
        RETURNING id
    """, (major_code, major_name, degree_type, total_credits))

    major_id = cur.fetchone()[0]
    print(f"✓ Inserted/updated major: {major_name} ({major_code})")

    cur.close()
    return major_id


def seed_requirement_groups(conn, major_id, requirement_groups):
    """Insert requirement groups and their courses"""
    cur = conn.cursor()

    for idx, group in enumerate(requirement_groups):
        group_id = group['group_id']
        group_name = group['group_name']
        group_type = group['group_type']
        description = group.get('description', '')

        # Handle credits_required (can be int or dict with min/max)
        credits_req = group.get('credits_required')
        if isinstance(credits_req, dict):
            credits_min = credits_req.get('min')
            credits_max = credits_req.get('max')
        elif isinstance(credits_req, int):
            credits_min = credits_req
            credits_max = credits_req
        else:
            credits_min = None
            credits_max = None

        # For choose_n groups
        courses_required = group.get('courses_required')

        # Insert requirement group
        cur.execute("""
            INSERT INTO requirement_groups
            (major_id, group_id, group_name, group_type, credits_required_min,
             credits_required_max, courses_required, description, display_order, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (major_id, group_id) DO UPDATE
            SET group_name = EXCLUDED.group_name,
                group_type = EXCLUDED.group_type,
                credits_required_min = EXCLUDED.credits_required_min,
                credits_required_max = EXCLUDED.credits_required_max,
                courses_required = EXCLUDED.courses_required,
                description = EXCLUDED.description,
                display_order = EXCLUDED.display_order,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING id
        """, (
            major_id, group_id, group_name, group_type,
            credits_min, credits_max, courses_required,
            description, idx, group.get('notes')
        ))

        req_group_id = cur.fetchone()[0]
        print(f"  ✓ Group: {group_name} ({group_type})")

        # Insert courses for this group
        if 'courses' in group and group['courses']:
            seed_requirement_courses(cur, req_group_id, group['courses'])

        # Insert rules for this group (e.g., for major_electives)
        if 'rules' in group and group['rules']:
            seed_requirement_rules(cur, req_group_id, group['rules'])

    cur.close()


def seed_requirement_courses(cur, group_id, courses):
    """Insert courses for a requirement group"""
    course_values = []

    for course in courses:
        course_code = course['course_code']
        course_name = course.get('course_name', '')
        credits = course.get('credits')
        requires_coreq = course.get('requires_corequisite')
        coreq_for = course.get('corequisite_for')

        course_values.append((
            group_id,
            course_code,
            course_name,
            credits,
            True,  # is_required (default)
            requires_coreq,
            coreq_for,
            None  # notes
        ))

    # Batch insert
    execute_values(cur, """
        INSERT INTO requirement_courses
        (group_id, course_code, course_name, credits, is_required,
         requires_corequisite, corequisite_for, notes)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, course_values)

    print(f"    → Added {len(courses)} courses")


def seed_requirement_rules(cur, group_id, rules):
    """Insert rules for a requirement group"""
    subject_code = rules.get('subject_code')
    min_level = rules.get('min_level')
    max_level = rules.get('max_level')
    exclude_courses = rules.get('exclude_courses', [])

    # Insert subject_level rule
    if subject_code and min_level:
        cur.execute("""
            INSERT INTO requirement_rules
            (group_id, rule_type, subject_code, min_level, max_level, exclude_courses)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (group_id, rule_type) DO UPDATE
            SET subject_code = EXCLUDED.subject_code,
                min_level = EXCLUDED.min_level,
                max_level = EXCLUDED.max_level,
                exclude_courses = EXCLUDED.exclude_courses
        """, (group_id, 'subject_level', subject_code, min_level, max_level, exclude_courses))

        print(f"    → Added rule: {subject_code} {min_level}+ level")


def main():
    """Main seeding function"""
    print("=" * 80)
    print("SEEDING CS DEGREE REQUIREMENTS")
    print("=" * 80)
    print()

    # Get project root directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    requirements_file = project_root / 'data' / 'cs_requirements.json'

    print(f"Loading requirements from: {requirements_file}")
    requirements_data = load_requirements_json(requirements_file)
    print()

    # Connect to database
    print("Connecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    print()

    try:
        # Seed major
        print("Seeding major...")
        major_id = seed_major(conn, requirements_data)
        print()

        # Seed requirement groups
        print("Seeding requirement groups...")
        seed_requirement_groups(conn, major_id, requirements_data['requirement_groups'])
        print()

        # Commit transaction
        conn.commit()
        print("=" * 80)
        print("✓ SUCCESS: CS requirements seeded successfully!")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print()
        print("=" * 80)
        print(f"✗ ERROR: Failed to seed requirements: {e}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        conn.close()


if __name__ == '__main__':
    main()
