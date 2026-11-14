"""
Security and cryptography helpers for SmartPredict.

Provides salted bcrypt password hashing with strict UTF-8 72-byte boundary
validation, password complexity checks, JWT access tokens with unique IDs and
token versions, signed CSRF tokens (for cookie-based deployments), and origin
validation.

Secrets come from :mod:`backend.settings`, which loads ``.env`` and refuses
weak configuration in production instead of silently using a known default.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import re
import secrets
from typing import Any, Dict, List, Optional
import uuid

import bcrypt
import jwt

from backend import settings

# Re-exported for callers/tests that import these names from this module.
ENVIRONMENT = settings.ENVIRONMENT
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
CSRF_SECRET_KEY = settings.CSRF_SECRET_KEY

JWT_ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

_REQUIRED_CLAIMS = ["exp", "iat", "sub", "jti", "uid", "ver"]

# Standard complexity regexes.
_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"[0-9]")
_RE_SPECIAL = re.compile(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]")


# =====================================================================
# PASSWORD VALIDATION & HASHING (BCRYPT)
# =====================================================================

def validate_password_complexity(password: str, is_admin: bool = False) -> bytes:
    """
    Validate password complexity and UTF-8 byte boundary.

    Enforces minimum length (12 for Admin, 8 for others), maximum 72 UTF-8
    bytes, uppercase, lowercase, digit, and special character requirements.
    """
    if not isinstance(password, str):
        raise ValueError("Password must be a text string.")

    try:
        encoded = password.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ValueError("Password contains invalid UTF-8 encoding.") from exc

    min_length = 12 if is_admin else 8
    role_label = "Administrator" if is_admin else "User"

    if len(password) < min_length:
        raise ValueError(
            f"{role_label} password must be at least {min_length} characters long."
        )

    # Strict bcrypt 72-byte maximum limit.
    if len(encoded) > 72:
        raise ValueError(
            f"Password exceeds bcrypt 72-byte limit (encoded size: "
            f"{len(encoded)} bytes). Please use 72 UTF-8 bytes or fewer "
            "without truncation."
        )

    if not _RE_UPPER.search(password):
        raise ValueError("Password must contain at least one uppercase letter (A-Z).")

    if not _RE_LOWER.search(password):
        raise ValueError("Password must contain at least one lowercase letter (a-z).")

    if not _RE_DIGIT.search(password):
        raise ValueError("Password must contain at least one digit (0-9).")

    if not _RE_SPECIAL.search(password):
        raise ValueError(
            "Password must contain at least one special symbol (!@#$%^&*...)."
        )

    return encoded


def hash_password(password: str, is_admin: bool = False) -> str:
    """Validate complexity and compute a salted bcrypt hash."""
    encoded = validate_password_complexity(password, is_admin=is_admin)
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(encoded, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Safely verify a plaintext password against a stored bcrypt hash.

    Passwords longer than 72 bytes are rejected outright so that bcrypt's
    silent truncation cannot be used to bypass a check.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        encoded = plain_password.encode("utf-8")
    except UnicodeEncodeError:
        return False

    if len(encoded) > 72:
        return False

    try:
        return bcrypt.checkpw(encoded, hashed_password.encode("utf-8"))
    except ValueError:
        return False


# =====================================================================
# JWT ACCESS TOKEN MANAGEMENT
# =====================================================================

def create_access_token(
    user_id: int,
    email: str,
    role: str,
    token_version: int,
    expires_delta: Optional[timedelta] = None,
) -> Dict[str, Any]:
    """
    Create a signed JWT access token containing standard claims:
    sub (email), uid (user_id), role, ver (token_version), jti, iat, exp.
    """
    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(minutes=DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = now + delta
    token_id = uuid.uuid4().hex

    payload = {
        "sub": email,
        "uid": user_id,
        "role": role,
        "ver": token_version,
        "jti": token_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    return {
        "token": token,
        "jti": token_id,
        "expires_at": expire.isoformat(),
        "expires_in_seconds": int(delta.total_seconds()),
    }


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and cryptographically verify a JWT access token.

    The algorithm is pinned and all required claims must be present, so a
    token cannot be downgraded to ``alg=none`` or stripped of its identity.
    Raises ``jwt.PyJWTError`` subclasses on failure.
    """
    return jwt.decode(
        token,
        JWT_SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
        options={"require": _REQUIRED_CLAIMS},
    )


# =====================================================================
# SIGNED DOUBLE-SUBMIT CSRF TOKENS
# =====================================================================

def generate_signed_csrf_token() -> str:
    """
    Generate a cryptographically signed CSRF token.

    Format: ``nonce.timestamp.hmac_signature``.
    """
    nonce = secrets.token_hex(16)
    timestamp = int(datetime.now(timezone.utc).timestamp())
    raw_payload = f"{nonce}.{timestamp}".encode("utf-8")
    signature = hmac.new(
        CSRF_SECRET_KEY.encode("utf-8"),
        raw_payload,
        hashlib.sha256,
    ).hexdigest()
    return f"{nonce}.{timestamp}.{signature}"


def verify_signed_csrf_token(token: str, max_age_seconds: int = 86400) -> bool:
    """Verify a signed CSRF token using constant-time comparison."""
    if not token or not isinstance(token, str):
        return False

    parts = token.split(".")
    if len(parts) != 3:
        return False

    nonce, timestamp_str, received_sig = parts

    try:
        ts = int(timestamp_str)
    except ValueError:
        return False

    now = int(datetime.now(timezone.utc).timestamp())

    # 24-hour expiration with 5 minutes of clock-skew tolerance.
    if (now - ts >= max_age_seconds) or (ts > now + 300):
        return False

    raw_payload = f"{nonce}.{timestamp_str}".encode("utf-8")
    expected_sig = hmac.new(
        CSRF_SECRET_KEY.encode("utf-8"),
        raw_payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, received_sig)


# =====================================================================
# ORIGIN VALIDATION
# =====================================================================

def validate_origin(origin: Optional[str], allowed_origins: List[str]) -> bool:
    """Validate that an incoming Origin header matches a trusted origin."""
    if not origin:
        return False

    normalized = origin.strip().rstrip("/")
    allowed_normalized = [item.strip().rstrip("/") for item in allowed_origins]

    return normalized in allowed_normalized
