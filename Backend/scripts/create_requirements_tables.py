#!/usr/bin/env python3
"""
Create requirements tables in Supabase database

This script executes the requirements_schema.sql file to create the tables.
"""

import os
import sys
from pathlib import Path
import psycopg2

def load_env_lines(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def sanitize_pooler_url(url: str) -> str:
    if '@@' in url and '%40' not in url:
        return url.replace('@@', '%40@', 1)
    return url


def resolve_database_url(script_dir: Path) -> str:
    keys = (
        'SUPABASE_POOLER_URL',
        'SUPABASE_DB_URL',
        'DATABASE_URL',
        'SUPABASE_URL',
    )

    for key in keys:
        value = os.getenv(key)
        if value:
            return sanitize_pooler_url(value)

    env_paths = (script_dir / '.env', script_dir.parent / '.env')
    for env_path in env_paths:
        env_values = load_env_lines(env_path)
        for key in keys:
            value = env_values.get(key)
            if value:
                return sanitize_pooler_url(value)

    raise RuntimeError(
        'Database URL not found. Set SUPABASE_POOLER_URL, SUPABASE_DB_URL, or DATABASE_URL.'
    )

def create_tables():
    """Create requirements tables"""
    script_dir = Path(__file__).parent
    schema_file = script_dir / 'requirements_schema.sql'
    database_url = resolve_database_url(script_dir)

    print("=" * 80)
    print("CREATING REQUIREMENTS TABLES")
    print("=" * 80)
    print()

    # Read SQL schema file
    print(f"Reading schema from: {schema_file}")
    try:
        with open(schema_file, 'r', encoding='utf-8') as f:
            sql_schema = f.read()
    except FileNotFoundError:
        print(f"ERROR: Schema file not found: {schema_file}")
        sys.exit(1)

    # Connect to database
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        print("OK Connected")
        print()
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)

    # Execute schema
    print("Creating tables...")
    try:
        cur.execute(sql_schema)
        conn.commit()
        print("OK Tables created successfully!")
        print()

        # List created tables
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('majors', 'requirement_groups', 'requirement_courses', 'requirement_rules')
            ORDER BY table_name
        """)

        tables = cur.fetchall()
        print("Created tables:")
        for table in tables:
            print(f"  OK {table[0]}")

        print()
        print("=" * 80)
        print("SUCCESS!")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print(f"ERROR: Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    create_tables()
