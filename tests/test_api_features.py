"""
Tests for the features added after the security pass: the paged machine
browser, the consistent notification response, the Admin account API and the
model metadata returned with predictions.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import ratelimit

ADMIN_EMAIL = "admin@smartpredict.io"
ADMIN_PASSWORD = "BootstrapAdmin!2026"
OPERATOR_PASSWORD = "OperatorPass!2026"

HIGH_RISK_READING = {
    "air_temperature": 302.0,
    "process_temperature": 312.0,
    "rotational_speed": 1200,
    "torque": 76,
    "tool_wear": 250,
}


# =====================================================================
# FIXTURES
# =====================================================================

@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("SMARTPREDICT_DB_PATH", str(tmp_path / "features.db"))
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", ADMIN_PASSWORD)
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN_EMAIL)
    ratelimit.reset_rate_limits()

    from backend.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client

    ratelimit.reset_rate_limits()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, email: str = "feature@smartpredict.io") -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Feature User",
            "email": email,
            "password": OPERATOR_PASSWORD,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def admin_token(client: TestClient) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


# =====================================================================
# 1. MACHINE BROWSER
# =====================================================================

def test_machines_requires_authentication(client: TestClient):
    assert client.get("/api/machines").status_code == 401


def test_machines_returns_one_page(client: TestClient):
    token = register(client)["access_token"]

    response = client.get(
        "/api/machines?limit=5&offset=0",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()

    assert body["total_count"] == 10000
    assert body["count"] == 5
    assert len(body["machines"]) == 5
    assert body["machines"][0]["machine_id"] == "UDI-00001"
    assert body["machines"][0]["product_type"] in {"L", "M", "H"}


def test_machines_pages_do_not_overlap(client: TestClient):
    token = register(client)["access_token"]

    first = client.get(
        "/api/machines?limit=5&offset=0", headers=auth_headers(token)
    ).json()
    second = client.get(
        "/api/machines?limit=5&offset=5", headers=auth_headers(token)
    ).json()

    first_ids = {item["machine_id"] for item in first["machines"]}
    second_ids = {item["machine_id"] for item in second["machines"]}

    assert first_ids.isdisjoint(second_ids)
    assert second["machines"][0]["machine_id"] == "UDI-00006"


def test_machines_search_and_failure_filter(client: TestClient):
    token = register(client)["access_token"]

    search = client.get(
        "/api/machines?q=UDI-00001", headers=auth_headers(token)
    ).json()
    assert search["total_count"] == 1
    assert search["machines"][0]["record_id"] == 1

    empty = client.get(
        "/api/machines?q=no-such-profile-xyz", headers=auth_headers(token)
    ).json()
    assert empty["total_count"] == 0
    assert empty["machines"] == []

    failures = client.get(
        "/api/machines?failure=1&limit=10", headers=auth_headers(token)
    ).json()
    assert 0 < failures["total_count"] < 10000
    assert all(item["failure"] == 1 for item in failures["machines"])


def test_health_endpoint_still_returns_records(client: TestClient):
    token = register(client)["access_token"]

    response = client.get("/api/health?limit=2", headers=auth_headers(token))
    body = response.json()

    assert response.status_code == 200
    assert body["count"] == 2
    assert body["total_count"] == 10000
    assert body["machines"][0]["temperature_k"] > 0


# =====================================================================
# 2. NOTIFICATION RESPONSE SHAPE
# =====================================================================

def test_notifications_use_a_paginated_envelope(client: TestClient):
    token = register(client)["access_token"]

    empty = client.get("/api/notifications", headers=auth_headers(token)).json()
    assert empty["total_count"] == 0
    assert empty["notifications"] == []
    assert empty["limit"] == 100

    predicted = client.post(
        "/api/predict",
        headers=auth_headers(token),
        json=HIGH_RISK_READING,
    )
    assert predicted.status_code == 200

    body = client.get("/api/notifications", headers=auth_headers(token)).json()

    assert body["total_count"] == 1
    assert body["count"] == 1
    assert body["notifications"][0]["severity"] == "CRITICAL"


# =====================================================================
# 3. ADMIN ACCOUNT API
# =====================================================================

def test_admin_endpoints_reject_operators(client: TestClient):
    token = register(client)["access_token"]

    assert client.get("/api/auth/users", headers=auth_headers(token)).status_code == 403

    assert (
        client.patch(
            "/api/auth/users/1/role",
            headers=auth_headers(token),
            json={"role": "Admin"},
        ).status_code
        == 403
    )


def test_admin_can_list_accounts(client: TestClient):
    register(client)
    token = admin_token(client)

    response = client.get("/api/auth/users", headers=auth_headers(token))

    assert response.status_code == 200
    users = response.json()

    emails = {user["email"] for user in users}
    assert ADMIN_EMAIL in emails
    assert "feature@smartpredict.io" in emails

    admin = next(user for user in users if user["email"] == ADMIN_EMAIL)
    assert admin["role"] == "Admin"
    assert admin["must_change_password"] == 1
    assert "hashed_password" not in admin


def test_admin_role_change_revokes_the_targets_sessions(client: TestClient):
    operator = register(client)
    operator_token = operator["access_token"]

    token = admin_token(client)

    updated = client.patch(
        f"/api/auth/users/{operator['user']['id']}/role",
        headers=auth_headers(token),
        json={"role": "Maintenance"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "Maintenance"

    # Existing session was issued with the previous token version.
    assert client.get("/api/auth/me", headers=auth_headers(operator_token)).status_code == 401

    relogin = client.post(
        "/api/auth/login",
        json={"email": "feature@smartpredict.io", "password": OPERATOR_PASSWORD},
    )
    assert relogin.status_code == 200
    assert relogin.json()["user"]["role"] == "Maintenance"


def test_admin_cannot_change_their_own_role_or_status(client: TestClient):
    token = admin_token(client)
    me = client.get("/api/auth/me", headers=auth_headers(token)).json()

    assert (
        client.patch(
            f"/api/auth/users/{me['id']}/role",
            headers=auth_headers(token),
            json={"role": "Operator"},
        ).status_code
        == 400
    )

    assert (
        client.patch(
            f"/api/auth/users/{me['id']}/active",
            headers=auth_headers(token),
            json={"is_active": False},
        ).status_code
        == 400
    )


def test_admin_can_deactivate_another_account(client: TestClient):
    operator = register(client)
    token = admin_token(client)

    updated = client.patch(
        f"/api/auth/users/{operator['user']['id']}/active",
        headers=auth_headers(token),
        json={"is_active": False},
    )

    assert updated.status_code == 200
    assert updated.json()["is_active"] == 0

    # The deactivated account cannot sign in.
    denied = client.post(
        "/api/auth/login",
        json={"email": "feature@smartpredict.io", "password": OPERATOR_PASSWORD},
    )
    assert denied.status_code == 401


# =====================================================================
# 4. MODEL METADATA
# =====================================================================

def test_prediction_reports_model_version_and_threshold(client: TestClient):
    token = register(client)["access_token"]

    response = client.post(
        "/api/predict",
        headers=auth_headers(token),
        json=HIGH_RISK_READING,
    )

    assert response.status_code == 200
    body = response.json()

    assert body["model_version"].startswith("randomforest-")
    assert body["decision_threshold"] == 0.5
    assert body["prediction"] == 1
    assert body["failure_probability"] > 0.9
