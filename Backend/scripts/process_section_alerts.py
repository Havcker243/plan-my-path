#!/usr/bin/env python3
"""
Send email alerts when subscribed sections open up.

Environment:
  SUPABASE_POOLER_URL / SUPABASE_DB_URL / DATABASE_URL
  SMTP_HOST
  SMTP_PORT (optional, default 587)
  SMTP_USERNAME
  SMTP_PASSWORD
  SMTP_FROM_EMAIL
  APP_BASE_URL (optional, default https://fiskgrad.app)

Usage:
  python scripts/process_section_alerts.py
  python scripts/process_section_alerts.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

import psycopg2


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() not in os.environ:
            os.environ[key.strip()] = value.strip().strip("'").strip('"')


def _database_url() -> str:
    candidates = (
        os.getenv("SUPABASE_POOLER_URL"),
        os.getenv("SUPABASE_DB_URL"),
        os.getenv("DATABASE_URL"),
        os.getenv("supabase_POOLER_URL"),
        os.getenv("supabase_URL"),
    )
    for candidate in candidates:
        if candidate and candidate.startswith("postgresql://"):
            if "@@" in candidate and "%40" not in candidate:
                return candidate.replace("@@", "%40@", 1)
            return candidate
    raise RuntimeError("No PostgreSQL connection URL found in environment")


def _send_email(to_email: str, subject: str, body: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not all([smtp_host, smtp_username, smtp_password, smtp_from]):
        raise RuntimeError("SMTP configuration is incomplete")

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)


def main() -> None:
    parser = argparse.ArgumentParser(description="Process queued section opening alerts.")
    parser.add_argument("--dry-run", action="store_true", help="Print emails instead of sending them")
    args = parser.parse_args()

    _load_env_file(Path(__file__).resolve().parents[1] / ".env")
    app_base_url = os.getenv("APP_BASE_URL", "https://fiskgrad.app")

    with psycopg2.connect(_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT sa.id,
                       sa.course_code,
                       sa.term,
                       sec.section_code,
                       sec.seats_available,
                       sec.seats_capacity,
                       p.email
                FROM section_alerts sa
                JOIN sections sec ON sec.id = sa.section_id
                JOIN profiles p ON p.user_id = sa.user_id
                WHERE sa.emailed_at IS NULL
                  AND COALESCE(sec.seats_available, 0) > 0
                  AND p.email IS NOT NULL
                ORDER BY sa.created_at
                """
            )
            rows = cur.fetchall()

            if not rows:
                print("No section alerts ready to send.")
                return

            sent_ids: list[str] = []
            for alert_id, course_code, term, section_code, seats_available, seats_capacity, email in rows:
                subject = f"Section open: {course_code} {section_code}"
                body = (
                    f"A seat just opened in {course_code} {section_code}.\n\n"
                    f"Term: {term or 'Current term'}\n"
                    f"Seats open: {seats_available}/{seats_capacity or '?'}\n\n"
                    f"Review your plan and sections in FiskGrad:\n{app_base_url}/planner\n"
                )

                if args.dry_run:
                    print(f"[DRY RUN] Would send to {email}: {subject}")
                else:
                    _send_email(email, subject, body)
                    print(f"Sent alert to {email}: {subject}")

                sent_ids.append(str(alert_id))

            if not args.dry_run and sent_ids:
                cur.execute(
                    "UPDATE section_alerts SET emailed_at = NOW(), updated_at = NOW() WHERE id = ANY(%s::uuid[])",
                    (sent_ids,),
                )
                conn.commit()


if __name__ == "__main__":
    main()
