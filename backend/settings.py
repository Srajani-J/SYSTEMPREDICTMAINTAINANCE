"""
Central configuration for SmartPredict.

Loads an optional project-root ``.env`` file, validates the security
configuration and exposes every runtime setting from one place.

Design notes
------------
* No third-party settings library is required; the loader is intentionally tiny.
* Real environment variables always win over values from ``.env``.
* Secrets never fall back to a hard-coded constant.  In production a short or
  missing secret is a startup error (fail closed).  In development an ephemeral
  random secret is generated so the process is still protected, at the cost of
  invalidating sessions on restart.
"""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

logger = logging.getLogger("smartpredict.settings")


def _load_env_file(path: Path) -> None:
    """Minimal ``.env`` reader: ``KEY=VALUE`` lines, ``#`` comments ignored."""
    if not path.exists():
        return

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        logger.warning("Could not read %s; continuing with process environment.", path)
        return

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(ENV_FILE)


def _text(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _int(name: str, default: int) -> int:
    raw = _text(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid integer for %s=%r; using %s.", name, raw, default)
        return default


def _csv(name: str, default: str) -> list[str]:
    raw = _text(name) or default
    return [item.strip() for item in raw.split(",") if item.strip()]


# =====================================================================
# ENVIRONMENT
# =====================================================================

ENVIRONMENT = _text("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# =====================================================================
# DATABASE
# =====================================================================

DATABASE_PATH = BASE_DIR / "notification_data.db"


def database_path() -> Path:
    """Resolve the SQLite path at call time (tests override the env var)."""
    override = _text("SMARTPREDICT_DB_PATH")
    return Path(override) if override else DATABASE_PATH


# =====================================================================
# HTTP / CORS
# =====================================================================

ALLOWED_ORIGINS = _csv(
    "ALLOWED_ORIGINS",
    (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"
    ),
)

# =====================================================================
# SECURITY
# =====================================================================

ACCESS_TOKEN_EXPIRE_MINUTES = _int("ACCESS_TOKEN_EXPIRE_MINUTES", 120)

INITIAL_ADMIN_EMAIL = _text("INITIAL_ADMIN_EMAIL", "admin@smartpredict.io")


def _secret(name: str) -> str:
    """Return a usable secret, refusing weak configuration in production."""
    value = _text(name)

    if IS_PRODUCTION:
        if len(value) < 32:
            raise RuntimeError(
                f"Production configuration error: {name} must be at least "
                "32 characters long and set in the environment."
            )
        return value

    if value:
        if len(value) < 16:
            logger.warning(
                "%s is shorter than 16 characters; generating an ephemeral "
                "development secret instead.",
                name,
            )
            return secrets.token_urlsafe(48)
        return value

    logger.warning(
        "%s is not set. Generated an ephemeral development secret; "
        "sessions will end when the server restarts.",
        name,
    )
    return secrets.token_urlsafe(48)


JWT_SECRET_KEY = _secret("JWT_SECRET_KEY")
CSRF_SECRET_KEY = _secret("CSRF_SECRET_KEY")

if JWT_SECRET_KEY == CSRF_SECRET_KEY:
    raise RuntimeError(
        "Configuration error: CSRF_SECRET_KEY must differ from JWT_SECRET_KEY."
    )

# =====================================================================
# RATE LIMITS (requests per window, per client)
# =====================================================================

RATE_LIMIT_WINDOW_SECONDS = _int("RATE_LIMIT_WINDOW_SECONDS", 60)
RATE_LIMIT_LOGIN = _int("RATE_LIMIT_LOGIN", 10)
RATE_LIMIT_REGISTER = _int("RATE_LIMIT_REGISTER", 5)
RATE_LIMIT_PREDICT = _int("RATE_LIMIT_PREDICT", 60)
