from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from jose import JWTError, jwt

DEFAULT_ALLOWED_EMAIL_DOMAINS = ("my.fisk.edu",)
SUPPORTED_ASYMMETRIC_ALGORITHMS = ("ES256", "RS256")
_JWKS_CACHE: dict[str, tuple[float, dict[str, object]]] = {}
_JWKS_CACHE_SECONDS = 60 * 60


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


def resolve_supabase_url(env_path: Optional[Path] = None) -> Optional[str]:
    for key, value in os.environ.items():
        if key.upper() == "SUPABASE_URL" and value:
            return value.rstrip("/")
    if env_path:
        env = _load_env_lines(env_path)
        for key, value in env.items():
            if key.upper() == "SUPABASE_URL" and value:
                return value.rstrip("/")
    return None


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


def _issuer_base_url(payload: dict[str, object]) -> str:
    issuer = str(payload.get("iss") or "").strip().rstrip("/")
    suffix = "/auth/v1"
    if not issuer.endswith(suffix):
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    return issuer[: -len(suffix)]


def _fetch_jwks(supabase_url: str) -> dict[str, object]:
    now = time.monotonic()
    cached = _JWKS_CACHE.get(supabase_url)
    if cached and now - cached[0] < _JWKS_CACHE_SECONDS:
        return cached[1]

    jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(jwks_url, timeout=5) as response:
            import json

            jwks = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Could not load Supabase signing keys") from exc

    _JWKS_CACHE[supabase_url] = (now, jwks)
    return jwks


def _verify_asymmetric_token(token: str, configured_supabase_url: Optional[str]) -> dict[str, object]:
    header = jwt.get_unverified_header(token)
    payload = jwt.get_unverified_claims(token)
    token_supabase_url = _issuer_base_url(payload)
    expected_supabase_url = (configured_supabase_url or token_supabase_url).rstrip("/")

    if token_supabase_url.rstrip("/") != expected_supabase_url:
        raise HTTPException(status_code=401, detail="Token issuer does not match Supabase project")

    jwks = _fetch_jwks(expected_supabase_url)
    kid = header.get("kid")
    key = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Supabase signing key not found")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[str(header.get("alg"))],
            issuer=f"{expected_supabase_url}/auth/v1",
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def verify_token(token: str, jwt_secret: str) -> dict[str, object]:
    try:
        header = jwt.get_unverified_header(token)
        alg = str(header.get("alg") or "")
        if alg in SUPPORTED_ASYMMETRIC_ALGORITHMS:
            env_path = Path(__file__).resolve().parents[1] / ".env"
            return _verify_asymmetric_token(token, resolve_supabase_url(env_path))
        return jwt.decode(token, jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
