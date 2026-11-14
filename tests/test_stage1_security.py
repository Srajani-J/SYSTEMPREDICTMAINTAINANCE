"""
Unit and Integration Tests for Phase 2 Stage 1 Security & Database Infrastructure.

Uses isolated temporary databases to ensure real operational data is NEVER modified.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
import pytest

from backend.database import backup_database, get_connection, init_db
from backend.security import (
    create_access_token,
    decode_access_token,
    generate_signed_csrf_token,
    hash_password,
    validate_origin,
    validate_password_complexity,
    verify_password,
    verify_signed_csrf_token,
)
from backend.auth_service import (
    authenticate_user,
    bootstrap_admin,
    change_password,
    create_user,
    is_token_revoked,
    revoke_token,
    set_user_active_status,
    set_user_role,
)


@pytest.fixture
def temp_db(tmp_path: Path) -> Path:
    """Fixture providing an isolated temporary SQLite database."""
    db_file = tmp_path / "test_auth_data.db"
    init_db(db_file)
    return db_file


# =====================================================================
# 1. PASSWORD COMPLEXITY & BCRYPT 72-BYTE BOUNDARY TESTS
# =====================================================================

def test_password_valid_complexity():
    """Verify standard strong password passes complexity validation."""
    pwd = "SecurePassword@123"
    encoded = validate_password_complexity(pwd, is_admin=False)
    assert isinstance(encoded, bytes)
    hashed = hash_password(pwd, is_admin=False)
    assert hashed.startswith("$2b$")
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword@123", hashed) is False


def test_password_length_and_admin_requirement():
    """Verify min 8 chars for users and min 12 chars for admin."""
    # Under 8 chars
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_complexity("Ab1!xyz", is_admin=False)

    # 8 chars is fine for regular user
    assert validate_password_complexity("Abcdef1!", is_admin=False)

    # 8 chars fails for admin (needs 12)
    with pytest.raises(ValueError, match="at least 12 characters"):
        validate_password_complexity("Abcdef1!", is_admin=True)

    # 12 chars passes for admin
    assert validate_password_complexity("AdminSecret!123", is_admin=True)


def test_password_missing_complexity_elements():
    """Verify rejection when any required complexity element is missing."""
    with pytest.raises(ValueError, match="uppercase"):
        validate_password_complexity("lowercase123!", is_admin=False)

    with pytest.raises(ValueError, match="lowercase"):
        validate_password_complexity("UPPERCASE123!", is_admin=False)

    with pytest.raises(ValueError, match="digit"):
        validate_password_complexity("NoDigitsHere!@", is_admin=False)

    with pytest.raises(ValueError, match="special symbol"):
        validate_password_complexity("NoSpecialChar123", is_admin=False)


def test_bcrypt_72_byte_limit_enforced():
    """Verify that passwords exceeding 72 UTF-8 bytes are rejected without silent truncation."""
    # 73 ASCII characters = 73 bytes
    too_long = "A" * 70 + "1!a"
    assert len(too_long.encode("utf-8")) == 73
    with pytest.raises(ValueError, match="72-byte limit"):
        validate_password_complexity(too_long, is_admin=False)

    # Multi-byte UTF-8 test: 20 four-byte emojis = 80 bytes (even though only 20 chars!)
    emoji_pwd = "A1!a" + ("🔒" * 18)
    assert len(emoji_pwd.encode("utf-8")) > 72
    with pytest.raises(ValueError, match="72-byte limit"):
        validate_password_complexity(emoji_pwd, is_admin=False)

    # Verify that verify_password rejects > 72 bytes without crashing
    hashed = hash_password("ValidPassword123!", is_admin=False)
    assert verify_password("A" * 80, hashed) is False


# =====================================================================
# 2. SIGNED DOUBLE-SUBMIT CSRF & ORIGIN TESTS
# =====================================================================

def test_signed_csrf_generation_and_verification():
    """Verify HMAC signed CSRF tokens validate correctly and reject tampering."""
    token = generate_signed_csrf_token()
    assert token.count(".") == 2
    assert verify_signed_csrf_token(token) is True

    # Tampering with nonce
    parts = token.split(".")
    tampered_nonce = f"tampered_{parts[0]}.{parts[1]}.{parts[2]}"
    assert verify_signed_csrf_token(tampered_nonce) is False

    # Tampering with signature
    tampered_sig = f"{parts[0]}.{parts[1]}.bad_signature_12345"
    assert verify_signed_csrf_token(tampered_sig) is False


def test_signed_csrf_expiration():
    """Verify that expired CSRF tokens (> 24 hours) are rejected."""
    token = generate_signed_csrf_token()
    # Expired when max_age is 0 or negative
    assert verify_signed_csrf_token(token, max_age_seconds=0) is False

    # Also test an explicitly expired token timestamp from 25 hours ago
    nonce = "testnonce12345678"
    ts_25h_ago = int(datetime.now(timezone.utc).timestamp()) - 90000
    raw = f"{nonce}.{ts_25h_ago}".encode("utf-8")
    import hmac
    import hashlib
    from backend.security import CSRF_SECRET_KEY
    sig = hmac.new(CSRF_SECRET_KEY.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    expired_token = f"{nonce}.{ts_25h_ago}.{sig}"
    assert verify_signed_csrf_token(expired_token) is False


def test_origin_validation():
    """Verify trusted origins pass and untrusted origins fail."""
    allowed = ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert validate_origin("http://localhost:5173", allowed) is True
    assert validate_origin("http://localhost:5173/", allowed) is True
    assert validate_origin("http://127.0.0.1:5173", allowed) is True
    assert validate_origin("http://malicious-site.com", allowed) is False
    assert validate_origin(None, allowed) is False


# =====================================================================
# 3. JWT TOKEN CREATION, DECODING & CLAIMS TESTS
# =====================================================================

def test_jwt_token_claims_and_roundtrip():
    """Verify JWT access token contains all required claims and decodes cleanly."""
    res = create_access_token(
        user_id=42,
        email="operator@smartpredict.io",
        role="Operator",
        token_version=2,
        expires_delta=timedelta(minutes=30),
    )
    assert "token" in res
    assert "jti" in res
    payload = decode_access_token(res["token"])
    assert payload["sub"] == "operator@smartpredict.io"
    assert payload["uid"] == 42
    assert payload["role"] == "Operator"
    assert payload["ver"] == 2
    assert payload["jti"] == res["jti"]
    assert payload["exp"] > payload["iat"]


def test_jwt_expired_token():
    """Verify expired JWT throws ExpiredSignatureError."""
    import jwt
    res = create_access_token(
        user_id=1,
        email="test@test.com",
        role="Operator",
        token_version=1,
        expires_delta=timedelta(seconds=-10),  # In the past
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(res["token"])


# =====================================================================
# 4. ISOLATED AUTH SERVICE & ADMIN BOOTSTRAP TESTS
# =====================================================================

def test_admin_bootstrap_lifecycle(temp_db: Path, monkeypatch):
    """Verify safe Admin bootstrap enforces password rules and must_change_password=1."""
    # 1. Missing password
    monkeypatch.delenv("INITIAL_ADMIN_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="INITIAL_ADMIN_PASSWORD"):
        bootstrap_admin(temp_db)

    # 2. Too short password (< 12 chars)
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "Short1!")
    with pytest.raises(ValueError, match="at least 12 characters"):
        bootstrap_admin(temp_db)

    # 3. Valid strong admin password
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "SuperAdminPass@2026")
    admin = bootstrap_admin(temp_db)
    assert admin is not None
    assert admin["role"] == "Admin"
    assert admin["must_change_password"] == 1
    assert admin["token_version"] == 1
    assert "hashed_password" not in admin

    # 4. Idempotency: second bootstrap does nothing because user already exists
    assert bootstrap_admin(temp_db) is None


def test_public_registration_forces_operator_role(temp_db: Path):
    """Verify public registration strictly forces role to 'Operator'."""
    # Attempting to request 'Admin'
    user = create_user(
        name="John Doe",
        email="john@smartpredict.io",
        password="ValidPassword123!",
        role="Admin",
        database_path=temp_db,
    )
    assert user["role"] == "Operator"
    assert user["must_change_password"] == 0

    # Duplicate email rejected
    with pytest.raises(ValueError, match="already exists"):
        create_user(
            name="Imposter",
            email="john@smartpredict.io",
            password="ValidPassword123!",
            database_path=temp_db,
        )


def test_authenticate_and_password_change(temp_db: Path):
    """Verify authentication and password change token_version increment."""
    user = create_user(
        name="Jane Operator",
        email="jane@smartpredict.io",
        password="InitialPassword123!",
        database_path=temp_db,
    )
    auth = authenticate_user(
        "jane@smartpredict.io", "InitialPassword123!", database_path=temp_db
    )
    assert auth is not None
    assert auth["id"] == user["id"]

    # Wrong password fails
    assert (
        authenticate_user(
            "jane@smartpredict.io", "WrongPassword123!", database_path=temp_db
        )
        is None
    )

    # Change password
    updated = change_password(
        user["id"],
        "InitialPassword123!",
        "BrandNewPassword456!",
        database_path=temp_db,
    )
    assert updated["token_version"] == user["token_version"] + 1

    # Old password no longer works
    assert (
        authenticate_user(
            "jane@smartpredict.io", "InitialPassword123!", database_path=temp_db
        )
        is None
    )
    # New password works
    assert (
        authenticate_user(
            "jane@smartpredict.io", "BrandNewPassword456!", database_path=temp_db
        )
        is not None
    )


def test_token_denylist_revocation(temp_db: Path):
    """Verify token revocation table records and checks JTI."""
    jti = "test_unique_jti_123"
    assert is_token_revoked(jti, database_path=temp_db) is False

    revoke_token(jti, user_id=1, expires_at_iso="2026-11-14T00:00:00Z", database_path=temp_db)
    assert is_token_revoked(jti, database_path=temp_db) is True


def test_account_deactivation(temp_db: Path):
    """Verify deactivating an account prevents authentication and increments token_version."""
    user = create_user(
        name="Deactivate Me",
        email="deact@smartpredict.io",
        password="ValidPassword123!",
        database_path=temp_db,
    )
    deactivated = set_user_active_status(user["id"], False, database_path=temp_db)
    assert deactivated["is_active"] == 0
    assert deactivated["token_version"] == user["token_version"] + 1

    # Authentication is refused
    assert (
        authenticate_user(
            "deact@smartpredict.io", "ValidPassword123!", database_path=temp_db
        )
        is None
    )


# =====================================================================
# 5. WAL-SAFE BACKUP DYNAMIC COUNT TEST
# =====================================================================

def test_wal_safe_backup_dynamic_count(tmp_path: Path):
    """Verify backup_database dynamically counts source notifications and matches destination."""
    src = tmp_path / "mock_source.db"
    dst = tmp_path / "mock_backup.db"

    with sqlite3.connect(src) as conn:
        conn.execute("CREATE TABLE notifications (id INT, title TEXT)")
        conn.execute("INSERT INTO notifications VALUES (1, 'Alert A')")
        conn.execute("INSERT INTO notifications VALUES (2, 'Alert B')")
        conn.execute("INSERT INTO notifications VALUES (3, 'Alert C')")
        conn.execute("INSERT INTO notifications VALUES (4, 'Alert D')")
        conn.commit()

    result = backup_database(source_path=src, backup_path=dst)
    assert result["verified"] is True
    assert result["source_notification_count"] == 4
    assert result["backup_notification_count"] == 4
    assert dst.exists()
