"""
Authentication Service for SmartPredict.

Handles user CRUD operations, safe Admin bootstrap, password updates,
session token denylist tracking, and role-based management.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.database import DB_PATH, get_connection
from backend.security import (
    ENVIRONMENT,
    hash_password,
    verify_password,
)

VALID_ROLES = {"Admin", "Supervisor", "Maintenance", "Operator"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sanitize_user(user_row: Any) -> Optional[Dict[str, Any]]:
    """Convert SQLite Row to dictionary and omit sensitive fields like hashed_password."""
    if user_row is None:
        return None
    data = dict(user_row)
    data.pop("hashed_password", None)
    return data


# =====================================================================
# SAFE ADMIN BOOTSTRAP
# =====================================================================

def bootstrap_admin(database_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """
    Safely bootstrap the initial platform Administrator if no users exist.

    Requires INITIAL_ADMIN_PASSWORD from the environment.
    In production: strictly enforces strong password configuration.
    Sets must_change_password = 1 to enforce an immediate password reset on first login.
    """
    with get_connection(database_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count > 0:
            return None  # Users already exist; bootstrap is skipped

        admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@smartpredict.io").strip().lower()
        admin_password = os.getenv("INITIAL_ADMIN_PASSWORD")

        if not admin_password or not admin_password.strip():
            if ENVIRONMENT == "production":
                raise RuntimeError(
                    "Production configuration error: INITIAL_ADMIN_PASSWORD must be "
                    "configured in environment variables with at least 12 characters."
                )
            raise ValueError(
                "INITIAL_ADMIN_PASSWORD environment variable is required to bootstrap "
                "the initial Administrator account."
            )

        admin_password = admin_password.strip()

        if len(admin_password) < 12:
            raise ValueError(
                "Initial Administrator password must be at least 12 characters long."
            )

        hashed = hash_password(admin_password, is_admin=True)
        now = _now_iso()

        cursor = conn.execute(
            """
            INSERT INTO users (
                name, email, hashed_password, role, is_active,
                must_change_password, token_version, created_at, password_changed_at
            )
            VALUES (?, ?, ?, 'Admin', 1, 1, 1, ?, ?)
            """,
            ("System Administrator", admin_email, hashed, now, now),
        )
        user_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(row)


# =====================================================================
# USER CREATION & REGISTRATION
# =====================================================================

def create_user(
    name: str,
    email: str,
    password: str,
    role: str = "Operator",
    database_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Register a new user account.
    Public registration is strictly constrained: role is forced to 'Operator'.
    Admin and Maintenance roles cannot be created via public registration.
    """
    clean_name = name.strip()
    clean_email = email.strip().lower()

    if not clean_name:
        raise ValueError("Name cannot be empty.")
    if "@" not in clean_email or "." not in clean_email:
        raise ValueError("Please provide a valid email address.")

    # Security rule: Public registration must never allow self-selecting Admin or Maintenance
    assigned_role = "Operator"

    hashed = hash_password(password, is_admin=False)
    now = _now_iso()

    with get_connection(database_path) as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (clean_email,)
        ).fetchone()
        if existing:
            raise ValueError(f"An account with email '{clean_email}' already exists.")

        cursor = conn.execute(
            """
            INSERT INTO users (
                name, email, hashed_password, role, is_active,
                must_change_password, token_version, created_at, password_changed_at
            )
            VALUES (?, ?, ?, ?, 1, 0, 1, ?, ?)
            """,
            (clean_name, clean_email, hashed, assigned_role, now, now),
        )
        user_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(row)


# =====================================================================
# AUTHENTICATION & LOOKUP
# =====================================================================

def authenticate_user(
    email: str,
    password: str,
    database_path: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Authenticate user credentials. Returns sanitized user dictionary on success."""
    clean_email = email.strip().lower()

    with get_connection(database_path) as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (clean_email,)
        ).fetchone()

        if not row:
            return None

        # Check account activation status
        if row["is_active"] != 1:
            return None

        if not verify_password(password, row["hashed_password"]):
            return None

        now = _now_iso()
        conn.execute(
            "UPDATE users SET last_login = ? WHERE id = ?", (now, row["id"])
        )
        updated = conn.execute(
            "SELECT * FROM users WHERE id = ?", (row["id"],)
        ).fetchone()
        return sanitize_user(updated)


def get_user_by_id(
    user_id: int, database_path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve sanitized user by primary key ID."""
    with get_connection(database_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(row)


def get_user_by_email(
    email: str, database_path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve sanitized user by email."""
    clean_email = email.strip().lower()
    with get_connection(database_path) as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (clean_email,)
        ).fetchone()
        return sanitize_user(row)


# =====================================================================
# PASSWORD MANAGEMENT & SESSION REVOCATION
# =====================================================================

def change_password(
    user_id: int,
    current_password: str,
    new_password: str,
    database_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Change user password.
    Increments token_version to immediately revoke all outstanding tokens on all devices.
    Resets must_change_password to 0.
    """
    with get_connection(database_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("User not found.")

        if not verify_password(current_password, row["hashed_password"]):
            raise ValueError("Current password is incorrect.")

        is_admin = row["role"] == "Admin"
        new_hashed = hash_password(new_password, is_admin=is_admin)
        now = _now_iso()

        conn.execute(
            """
            UPDATE users
            SET hashed_password = ?,
                must_change_password = 0,
                token_version = token_version + 1,
                password_changed_at = ?
            WHERE id = ?
            """,
            (new_hashed, now, user_id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(updated)


# =====================================================================
# TOKEN DENYLIST MANAGEMENT
# =====================================================================

def revoke_token(
    jti: str,
    user_id: int,
    expires_at_iso: str,
    database_path: Optional[Path] = None,
) -> bool:
    """Add a JWT ID to the server-side revocation table."""
    now = _now_iso()
    with get_connection(database_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO revoked_tokens (jti, user_id, revoked_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (jti, user_id, now, expires_at_iso),
        )
    return True


def is_token_revoked(jti: str, database_path: Optional[Path] = None) -> bool:
    """Check if a token ID has been revoked."""
    with get_connection(database_path) as conn:
        row = conn.execute(
            "SELECT 1 FROM revoked_tokens WHERE jti = ?", (jti,)
        ).fetchone()
        return row is not None


# =====================================================================
# ADMIN OPERATIONS
# =====================================================================

def set_user_role(
    user_id: int,
    new_role: str,
    database_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Promote or update a user's role. Increments token_version."""
    if new_role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{new_role}'. Must be one of {VALID_ROLES}")

    with get_connection(database_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("User not found.")

        conn.execute(
            """
            UPDATE users
            SET role = ?,
                token_version = token_version + 1
            WHERE id = ?
            """,
            (new_role, user_id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(updated)


def set_user_active_status(
    user_id: int,
    is_active: bool,
    database_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Activate or deactivate a user account. Deactivation increments token_version."""
    active_val = 1 if is_active else 0
    with get_connection(database_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("User not found.")

        conn.execute(
            """
            UPDATE users
            SET is_active = ?,
                token_version = token_version + 1
            WHERE id = ?
            """,
            (active_val, user_id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return sanitize_user(updated)


def list_users(database_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Return every account (without password hashes) for the admin panel."""
    with get_connection(database_path) as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
    return [sanitize_user(row) for row in rows]


def count_active_admins(database_path: Optional[Path] = None) -> int:
    """Count active Administrators, used to prevent locking everyone out."""
    with get_connection(database_path) as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'Admin' AND is_active = 1"
        ).fetchone()
    return int(row[0])
