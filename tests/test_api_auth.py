"""
End-to-end API tests for authentication, authorisation, input validation and
notification storage.

Every test runs against a temporary SQLite database, so the real operational
data is never touched.
"""

from pathlib import Path
import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend import ratelimit
from backend.database import get_connection, init_db

ADMIN_EMAIL = "admin@smartpredict.io"
ADMIN_PASSWORD = "BootstrapAdmin!2026"
OPERATOR_PASSWORD = "OperatorPass!2026"

# Model probability ~0.97 for this reading, so an alert is always created.
HIGH_RISK_READING = {
    "air_temperature": 302.0,
    "process_temperature": 312.0,
    "rotational_speed": 1200,
    "torque": 76,
    "tool_wear": 250,
}

SAFE_READING = {
    "air_temperature": 298.0,
    "process_temperature": 308.0,
    "rotational_speed": 1500,
    "torque": 40,
    "tool_wear": 10,
}


# =====================================================================
# FIXTURES
# =====================================================================

@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    """A TestClient bound to a throw-away database with a bootstrapped Admin."""
    monkeypatch.setenv("SMARTPREDICT_DB_PATH", str(tmp_path / "api_test.db"))
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", ADMIN_PASSWORD)
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN_EMAIL)
    ratelimit.reset_rate_limits()

    from backend.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client

    ratelimit.reset_rate_limits()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def register_operator(client: TestClient, email: str = "operator@smartpredict.io"):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test Operator",
            "email": email,
            "password": OPERATOR_PASSWORD,
        },
    )
    assert response.status_code == 201, response.text

    body = response.json()
    return body["access_token"], body["user"]


def login(client: TestClient, email: str, password: str):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


# =====================================================================
# 1. AUTHENTICATION IS ENFORCED
# =====================================================================

@pytest.mark.parametrize("path", ["/api/health", "/api/sensors", "/api/notifications"])
def test_data_endpoints_require_authentication(client: TestClient, path: str):
    assert client.get(path).status_code == 401


def test_prediction_requires_authentication(client: TestClient):
    response = client.post("/api/predict", json=SAFE_READING)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_mutations_require_authentication(client: TestClient):
    assert client.patch("/api/notifications/1/assign", json={"assigned_to": "Tech"}).status_code == 401
    assert client.post("/api/notifications/1/acknowledge").status_code == 401
    assert client.post("/api/notifications/1/resolve").status_code == 401


def test_status_endpoint_stays_public(client: TestClient):
    assert client.get("/api/status").status_code == 200


def test_openapi_documents_bearer_auth(client: TestClient):
    schemes = client.get("/openapi.json").json()["components"]["securitySchemes"]

    assert "HTTPBearer" in schemes


# =====================================================================
# 2. REGISTRATION, LOGIN, SESSION LIFECYCLE
# =====================================================================

def test_registration_creates_operator_session(client: TestClient):
    token, user = register_operator(client)

    assert user["role"] == "Operator"
    assert "hashed_password" not in user

    me = client.get("/api/auth/me", headers=auth_headers(token))

    assert me.status_code == 200
    assert me.json()["email"] == user["email"]


def test_registration_rejects_weak_password_and_bad_email(client: TestClient):
    weak = client.post(
        "/api/auth/register",
        json={
            "name": "Weak User",
            "email": "weak@smartpredict.io",
            "password": "weakpasswordonly",
        },
    )
    assert weak.status_code == 400
    assert "uppercase" in weak.json()["detail"].lower()

    bad_email = client.post(
        "/api/auth/register",
        json={
            "name": "Bad Email",
            "email": "not-an-email",
            "password": OPERATOR_PASSWORD,
        },
    )
    assert bad_email.status_code == 422


def test_registration_rejects_duplicate_email(client: TestClient):
    register_operator(client)

    duplicate = client.post(
        "/api/auth/register",
        json={
            "name": "Imposter",
            "email": "operator@smartpredict.io",
            "password": OPERATOR_PASSWORD,
        },
    )

    assert duplicate.status_code == 400
    assert "already exists" in duplicate.json()["detail"].lower()


def test_login_rejects_wrong_password_without_leaking_details(client: TestClient):
    register_operator(client)

    response = login(client, "operator@smartpredict.io", "WrongPassword!1")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_logout_revokes_the_token(client: TestClient):
    token, _ = register_operator(client)

    signed_out = client.post("/api/auth/logout", headers=auth_headers(token))
    assert signed_out.status_code == 200

    reuse = client.get("/api/auth/me", headers=auth_headers(token))
    assert reuse.status_code == 401


def test_password_change_invalidates_other_sessions(client: TestClient):
    token, _ = register_operator(client)

    changed = client.post(
        "/api/auth/change-password",
        headers=auth_headers(token),
        json={
            "current_password": OPERATOR_PASSWORD,
            "new_password": "BrandNewPass!2026",
        },
    )
    assert changed.status_code == 200

    # The old token was issued with the previous token_version.
    assert client.get("/api/auth/me", headers=auth_headers(token)).status_code == 401

    # The freshly issued token still works.
    new_token = changed.json()["access_token"]
    assert client.get("/api/auth/me", headers=auth_headers(new_token)).status_code == 200


def test_inactive_account_loses_access(client: TestClient):
    token, _ = register_operator(client)
    register_operator(client, email="second@smartpredict.io")

    # Deactivate directly through the service layer (no admin UI in this scope).
    from backend.auth_service import set_user_active_status
    from backend import settings

    with get_connection() as conn:
        user_id = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            ("operator@smartpredict.io",),
        ).fetchone()["id"]

    set_user_active_status(user_id, False, database_path=settings.database_path())

    assert client.get("/api/auth/me", headers=auth_headers(token)).status_code == 401


# =====================================================================
# 3. ROLE-BASED AUTHORISATION
# =====================================================================

def test_assign_requires_admin_or_maintenance_role(client: TestClient):
    operator_token, _ = register_operator(client)

    admin_login = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    predicted = client.post(
        "/api/predict",
        headers=auth_headers(admin_token),
        json={**HIGH_RISK_READING, "profile_id": "UDI-00001"},
    )
    assert predicted.status_code == 200
    notification_id = predicted.json()["notification"]["id"]

    denied = client.patch(
        f"/api/notifications/{notification_id}/assign",
        headers=auth_headers(operator_token),
        json={"assigned_to": "Tech One"},
    )
    assert denied.status_code == 403

    allowed = client.patch(
        f"/api/notifications/{notification_id}/assign",
        headers=auth_headers(admin_token),
        json={"assigned_to": "Tech One"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["assigned_to"] == "Tech One"


# =====================================================================
# 4. INPUT VALIDATION
# =====================================================================

def test_prediction_rejects_impossible_telemetry(client: TestClient):
    token, _ = register_operator(client)

    invalid_payloads = [
        {**SAFE_READING, "air_temperature": 1e12},
        {**SAFE_READING, "air_temperature": 0},
        {**SAFE_READING, "process_temperature": -9999},
        {**SAFE_READING, "torque": -50},
        {**SAFE_READING, "rotational_speed": 1e9},
        {**SAFE_READING, "tool_wear": 1e8},
    ]

    for payload in invalid_payloads:
        response = client.post(
            "/api/predict",
            headers=auth_headers(token),
            json=payload,
        )
        assert response.status_code == 422, payload


def test_prediction_rejects_oversized_profile_id(client: TestClient):
    token, _ = register_operator(client)

    response = client.post(
        "/api/predict",
        headers=auth_headers(token),
        json={**SAFE_READING, "profile_id": "X" * 65},
    )

    assert response.status_code == 422


# =====================================================================
# 5. NOTIFICATION REGRESSION (legacy NOT NULL profile_id)
# =====================================================================

def test_high_risk_prediction_without_profile_creates_alert(client: TestClient):
    token, _ = register_operator(client)

    response = client.post(
        "/api/predict",
        headers=auth_headers(token),
        json=HIGH_RISK_READING,
    )

    assert response.status_code == 200, response.text

    body = response.json()
    assert body["prediction"] == 1
    assert body["notification"] is not None
    assert body["notification"]["profile_id"] is None
    assert body["notification"]["severity"] == "CRITICAL"
    assert body["notification"]["status"] == "NEW"

    listed = client.get("/api/notifications", headers=auth_headers(token))
    assert listed.status_code == 200
    assert listed.json()["total_count"] == 1
    assert len(listed.json()["notifications"]) == 1


def test_safe_prediction_does_not_create_alert(client: TestClient):
    token, _ = register_operator(client)

    response = client.post(
        "/api/predict",
        headers=auth_headers(token),
        json=SAFE_READING,
    )

    assert response.status_code == 200
    assert response.json()["notification"] is None


# =====================================================================
# 6. RATE LIMITING
# =====================================================================

def test_login_is_rate_limited(client: TestClient):
    register_operator(client, email="bruteforce@smartpredict.io")
    ratelimit.reset_rate_limits()

    statuses = [
        login(client, "bruteforce@smartpredict.io", "WrongPassword!1").status_code
        for _ in range(11)
    ]

    assert statuses[:10] == [401] * 10
    assert statuses[-1] == 429


# =====================================================================
# 7. SCHEMA MIGRATION
# =====================================================================

def test_legacy_notifications_schema_is_migrated(tmp_path: Path):
    legacy_db = tmp_path / "legacy.db"

    with sqlite3.connect(legacy_db) as conn:
        conn.execute(
            """
            CREATE TABLE notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                product_id TEXT,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                prediction TEXT NOT NULL,
                failure_probability REAL NOT NULL,
                assigned_to TEXT DEFAULT 'Unassigned',
                status TEXT DEFAULT 'NEW',
                input_data TEXT,
                explanations TEXT,
                created_at TEXT NOT NULL,
                acknowledged_at TEXT,
                resolved_at TEXT
            )
            """
        )
        conn.execute(
            """
            INSERT INTO notifications (
                profile_id, severity, title, message, prediction,
                failure_probability, created_at
            )
            VALUES ('UDI-00001', 'CRITICAL', 'Legacy title', 'Legacy message',
                    '1', 0.91, '2026-01-01T00:00:00+00:00')
            """
        )
        conn.commit()

    init_db(legacy_db)

    with get_connection(legacy_db) as conn:
        columns = {
            row["name"]: row for row in conn.execute("PRAGMA table_info(notifications)")
        }
        migrated = conn.execute(
            "SELECT prediction, profile_id, severity, status FROM notifications"
        ).fetchone()

    assert columns["profile_id"]["notnull"] == 0
    assert columns["prediction"]["type"].upper() == "INTEGER"

    # Row preserved, and the TEXT prediction coerced to an integer.
    assert migrated["prediction"] == 1
    assert isinstance(migrated["prediction"], int)
    assert migrated["profile_id"] == "UDI-00001"
    assert migrated["severity"] == "CRITICAL"
    assert migrated["status"] == "NEW"

    # A profile-less alert is now accepted by the schema.
    with get_connection(legacy_db) as conn:
        conn.execute(
            """
            INSERT INTO notifications (
                profile_id, severity, title, message, prediction,
                failure_probability, created_at
            )
            VALUES (NULL, 'WARNING', 'No profile', 'Ad-hoc prediction',
                    0, 0.1, '2026-01-01T00:00:00+00:00')
            """
        )
