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
import re
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ModuleNotFoundError:
    psycopg2 = None
    execute_values = None

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

def _load_env_file(env_path: Path) -> None:
    """Load key=value pairs from a .env file into os.environ (does not overwrite existing)."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key not in os.environ:
            os.environ[key] = value


# Load Backend/.env automatically so scripts can be run without pre-setting env vars
_load_env_file(Path(__file__).resolve().parent.parent / ".env")


def get_db_connection():
    """Get database connection from environment variables."""
    if psycopg2 is None:
        print("ERROR: psycopg2 is required for database seeding. Install Backend requirements first.")
        sys.exit(1)
    # Accept the supabase_URL key (postgresql:// variant) used in Backend/.env
    database_url = (
        os.getenv('SUPABASE_DB_URL')
        or os.getenv('DATABASE_URL')
        or os.getenv('supabase_URL', '').split('\n')[0]  # first line if duplicated
    )
    # Only use it if it's a postgres URL (the .env has two supabase_URL entries)
    if database_url and not database_url.startswith('postgresql://'):
        database_url = None
    # Re-scan env for a postgresql:// supabase_URL
    if not database_url:
        for key in ('supabase_URL', 'SUPABASE_POOLER_URL', 'supabase_POOLER_URL'):
            val = os.getenv(key, '')
            if val.startswith('postgresql://'):
                database_url = val
                break

    if not database_url:
        print("ERROR: No PostgreSQL URL found in Backend/.env or environment")
        print("\nExpected one of these keys in Backend/.env:")
        print('  SUPABASE_DB_URL="postgresql://..."')
        print('  supabase_URL="postgresql://..."')
        sys.exit(1)

    # Fix unencoded @ in password (e.g. password@@host → password%40@host)
    if "@@" in database_url and "%40" not in database_url:
        database_url = database_url.replace("@@", "%40@", 1)

    try:
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
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


def resolve_groups(requirement_groups, data_dir, _seen=None):
    """
    Expand any template_reference groups by inlining the groups from the
    referenced file.  Returns a flat list with all template_reference entries
    replaced by the real groups they point to.
    """
    if _seen is None:
        _seen = set()

    result = []
    for group in requirement_groups:
        if group.get('group_type') == 'template_reference':
            ref_filename = group.get('template_reference', '')
            ref_path = data_dir / ref_filename
            if ref_filename in _seen:
                print(f"    ⚠ Skipping circular template_reference to {ref_filename}")
                continue
            if not ref_path.exists():
                print(f"    ⚠ template_reference file not found: {ref_path} — skipping")
                continue
            _seen = _seen | {ref_filename}
            ref_data = load_requirements_json(ref_path)
            print(f"    → Resolving template_reference → {ref_filename}")
            result.extend(resolve_groups(ref_data['requirement_groups'], data_dir, _seen))
        else:
            result.append(group)
    return result


def seed_requirement_groups(conn, major_id, requirement_groups, data_dir=None):
    """Insert requirement groups and their courses"""
    cur = conn.cursor()

    # Expand any template_reference groups before inserting
    if data_dir is not None:
        requirement_groups = resolve_groups(requirement_groups, data_dir)

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
    if execute_values is None:
        raise RuntimeError("psycopg2 is required for database seeding")
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


def load_major_codes_from_seed_sql(filepath: Path) -> list[str]:
    """Extract major codes from the seed_all_majors.sql VALUES block."""
    if not filepath.exists():
        return []
    content = filepath.read_text(encoding="utf-8")
    return re.findall(r"\('([A-Z0-9_]+)'\s*,", content)


def report_coverage(data_dir: Path, major_seed_file: Path) -> int:
    """Print requirements-template coverage against the majors seed list."""
    files = sorted(data_dir.glob("*_requirements.json"))
    if not files:
        print(f"ERROR: No *_requirements.json files found in {data_dir}")
        return 1

    template_codes: list[str] = []
    template_map: dict[str, str] = {}
    for filepath in files:
        payload = load_requirements_json(filepath)
        code = str(payload.get("major_code", "")).strip().upper()
        if not code:
            print(f"WARNING: {filepath.name} is missing major_code")
            continue
        template_codes.append(code)
        template_map[code] = filepath.name

    seeded_codes = load_major_codes_from_seed_sql(major_seed_file)
    missing_codes = sorted(code for code in seeded_codes if code not in template_map)
    extra_codes = sorted(code for code in template_codes if code not in seeded_codes)

    print("=" * 80)
    print("REQUIREMENTS TEMPLATE COVERAGE")
    print("=" * 80)
    print(f"Templates found: {len(template_codes)}")
    print(f"Majors in seed_all_majors.sql: {len(seeded_codes)}")
    print(f"Coverage: {len(template_codes)}/{len(seeded_codes) if seeded_codes else len(template_codes)}")
    print()
    print("Available templates:")
    for code in sorted(template_codes):
        print(f"  - {code}: {template_map[code]}")

    if missing_codes:
        print()
        print("Majors without requirement templates:")
        for code in missing_codes:
            print(f"  - {code}")

    if extra_codes:
        print()
        print("Templates not present in seed_all_majors.sql:")
        for code in extra_codes:
            print(f"  - {code}")

    print()
    print("Run `python scripts/seed_requirements.py --all` to seed all available templates.")
    return 0


def main():
    """Main seeding function"""
    import argparse
    parser = argparse.ArgumentParser(description="Seed degree requirements into the database.")
    parser.add_argument(
        "file",
        nargs="?",
        help="Path to requirements JSON file. Defaults to data/cs_requirements.json.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Seed all requirements JSON files found in the data/ directory.",
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Report which seeded majors do and do not have requirements JSON templates.",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    data_dir = project_root / "data"

    if args.coverage:
        sys.exit(report_coverage(data_dir, script_dir / "seed_all_majors.sql"))
    elif args.all:
        files = sorted(data_dir.glob("*_requirements.json"))
        if not files:
            print(f"ERROR: No *_requirements.json files found in {data_dir}")
            sys.exit(1)
    elif args.file:
        files = [Path(args.file)]
    else:
        files = [data_dir / "cs_requirements.json"]

    for requirements_file in files:
        major_label = requirements_file.stem.replace("_requirements", "").upper()
        print("=" * 80)
        print(f"SEEDING REQUIREMENTS: {requirements_file.name}")
        print("=" * 80)
        print()

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

            # Seed requirement groups (pass data_dir so template_references can be resolved)
            print("Seeding requirement groups...")
            seed_requirement_groups(conn, major_id, requirements_data['requirement_groups'], data_dir=data_dir)
            print()

            # Commit transaction
            conn.commit()
            print("=" * 80)
            print(f"✓ SUCCESS: {requirements_file.name} seeded successfully!")
            print("=" * 80)
            print()

        except Exception as e:
            conn.rollback()
            print()
            print("=" * 80)
            print(f"✗ ERROR: Failed to seed {requirements_file.name}: {e}")
            print("=" * 80)
            import traceback
            traceback.print_exc()
            sys.exit(1)

        finally:
            conn.close()


if __name__ == '__main__':
    main()
