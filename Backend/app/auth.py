from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from jose import JWTError, jwt

DEFAULT_ALLOWED_EMAIL_DOMAINS = ("my.fisk.edu",)


def _load_env_lines(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    pairs: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        pairs[key.strip()] = value.strip().strip("'").strip('"')
    return pairs


def resolve_jwt_secret(env_path: Optional[Path] = None) -> str:
    for key in ("SUPABASE_JWT_SECRET", "SUPABASE_JWT_SECRET_KEY"):
        if key in os.environ and os.environ[key]:
            return os.environ[key]
    if env_path:
        env = _load_env_lines(env_path)
        for key in ("SUPABASE_JWT_SECRET", "SUPABASE_JWT_SECRET_KEY"):
            if env.get(key):
                return env[key]
    raise RuntimeError("SUPABASE_JWT_SECRET not found in environment or .env")


def resolve_allowed_email_domains(env_path: Optional[Path] = None) -> tuple[str, ...]:
    raw = os.environ.get("ALLOWED_EMAIL_DOMAINS")
    if not raw and env_path:
        raw = _load_env_lines(env_path).get("ALLOWED_EMAIL_DOMAINS")
    if not raw:
        return DEFAULT_ALLOWED_EMAIL_DOMAINS

    domains = tuple(
        domain.strip().lower().lstrip("@")
        for domain in raw.split(",")
        if domain.strip()
    )
    return domains or DEFAULT_ALLOWED_EMAIL_DOMAINS


def require_allowed_email(payload: dict[str, object], allowed_domains: tuple[str, ...]) -> None:
    email = str(payload.get("email") or "").strip().lower()
    if not email or not any(email.endswith(f"@{domain}") for domain in allowed_domains):
        raise HTTPException(status_code=403, detail="Fisk email address required")


def verify_token(token: str, jwt_secret: str) -> dict[str, object]:
    try:
        return jwt.decode(token, jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
