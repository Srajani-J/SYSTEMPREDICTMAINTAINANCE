"""
Phase 1 (Admin dashboard) API tests.

Covers the admin overview statistics, user search/filtering, machine
assignment, prediction history, audit logging and the role/scope rules that
back the four dashboards.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import ratelimit
from backend.database import get_connection, init_db

ADMIN_EMAIL = "admin@smartpredict.io"
ADMIN_PASSWORD = "BootstrapAdmin!2026"
PASSWORD = "OperatorPass!2026"

HIGH_RISK_READING = {
    "air_temperature": 302.0,
    "process_temperature": 312.0,
    "rotational_speed": 1200,
    "torque": 76,
    "tool_wear": 250,
    "profile_id": "UDI-00001",
}

SAFE_READING = {
    "air_temperature": 298.0,
    "process_temperature": 308.0,
    "rotational_speed": 1500,
    "torque": 40,
    "tool_wear": 10,
    "profile_id": "UDI-00002",
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("SMARTPREDICT_DB_PATH", str(tmp_path / "phase1.db"))
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", ADMIN_PASSWORD)
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", ADMIN_EMAIL)
    ratelimit.reset_rate_limits()

    from backend.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client

    ratelimit.reset_rate_limits()


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def admin_token(client: TestClient) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def register(client: TestClient, email: str, name: str = "Phase One User") -> dict:
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_role(client: TestClient, user_id: int, role: str) -> None:
    response = client.patch(
        f"/api/auth/users/{user_id}/role",
        headers=headers(admin_token(client)),
        json={"role": role},
    )
    assert response.status_code == 200, response.text


def login(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


# =====================================================================
# 1. ROLES
# =====================================================================

def test_supervisor_role_can_be_assigned_and_used(client: TestClient):
    user = register(client, "supervisor@smartpredict.io")
    make_role(client, user["user"]["id"], "Supervisor")

    token = login(client, "supervisor@smartpredict.io")

    profile = client.get("/api/auth/me", headers=headers(token))
    assert profile.status_code == 200
    assert profile.json()["role"] == "Supervisor"

    # Supervisors see every machine without needing an assignment.
    detail = client.get("/api/machines/UDI-00007", headers=headers(token))
    assert detail.status_code == 200


# =====================================================================
# 2. OVERVIEW
# =====================================================================

def test_admin_overview_returns_real_counts(client: TestClient):
    token = admin_token(client)

    response = client.get("/api/admin/overview", headers=headers(token))

    assert response.status_code == 200
    body = response.json()

    machines = body["machines"]
    assert machines["total"] == 10000
    assert machines["historical_failures"] > 0
    assert (
        machines["historical_failures"] + machines["no_failure_recorded"]
        == machines["total"]
    )
    assert machines["assigned"] == 0

    assert body["users"]["total"] == 1  # only the bootstrapped admin
    assert body["users"]["by_role"]["Admin"] == 1
    assert body["predictions"]["total"] == 0
    assert body["notifications"]["total"] == 0
    assert set(body["predictions"]["risk_distribution"]) == {
        "low",
        "medium",
        "high",
        "critical",
    }
    assert len(body["risk_bands"]) == 4
    assert body["recent_activity"] == []


def test_overview_is_admin_only(client: TestClient):
    user = register(client, "operator@smartpredict.io")
    token = user["access_token"]

    assert client.get("/api/admin/overview", headers=headers(token)).status_code == 403

    supervisor = register(client, "supervisor2@smartpredict.io")
    make_role(client, supervisor["user"]["id"], "Supervisor")
    supervisor_token = login(client, "supervisor2@smartpredict.io")

    assert (
        client.get("/api/admin/overview", headers=headers(supervisor_token)).status_code
        == 403
    )


# =====================================================================
# 3. USER MANAGEMENT
# =====================================================================

def test_user_list_supports_search_role_and_status_filters(client: TestClient):
    register(client, "asha.rao@smartpredict.io", name="Asha Rao")
    register(client, "vikram@smartpredict.io", name="Vikram Singh")
    token = admin_token(client)

    everyone = client.get("/api/auth/users", headers=headers(token)).json()
    assert len(everyone) == 3

    by_name = client.get(
        "/api/auth/users?q=asha", headers=headers(token)
    ).json()
    assert [user["email"] for user in by_name] == ["asha.rao@smartpredict.io"]

    by_role = client.get(
        "/api/auth/users?role=Admin", headers=headers(token)
    ).json()
    assert [user["email"] for user in by_role] == [ADMIN_EMAIL]

    active = client.get(
        "/api/auth/users?is_active=1", headers=headers(token)
    ).json()
    assert len(active) == 3

    bad_role = client.get("/api/auth/users?role=Wizard", headers=headers(token))
    assert bad_role.status_code == 422


def test_user_filters_are_admin_only(client: TestClient):
    user = register(client, "operator3@smartpredict.io")

    response = client.get(
        "/api/auth/users?role=Admin", headers=headers(user["access_token"])
    )

    assert response.status_code == 403


# =====================================================================
# 4. MACHINE ASSIGNMENTS
# =====================================================================

def test_admin_can_assign_a_machine_to_an_operator(client: TestClient):
    operator = register(client, "operator.assign@smartpredict.io")
    token = admin_token(client)

    created = client.post(
        "/api/admin/assignments",
        headers=headers(token),
        json={"machine_id": "UDI-00001", "user_id": operator["user"]["id"]},
    )

    assert created.status_code == 201, created.text
    assignment = created.json()
    assert assignment["machine_id"] == "UDI-00001"
    assert assignment["user_email"] == "operator.assign@smartpredict.io"
    assert assignment["user_role"] == "Operator"

    listed = client.get(
        "/api/admin/assignments?machine_id=UDI-00001", headers=headers(token)
    ).json()
    assert len(listed) == 1

    # Idempotent: assigning again does not duplicate the row.
    again = client.post(
        "/api/admin/assignments",
        headers=headers(token),
        json={"machine_id": "UDI-1", "user_id": operator["user"]["id"]},
    )
    assert again.status_code == 201
    assert again.json()["id"] == assignment["id"]


def test_assignment_validation(client: TestClient):
    operator = register(client, "operator.invalid@smartpredict.io")
    token = admin_token(client)

    assert (
        client.post(
            "/api/admin/assignments",
            headers=headers(token),
            json={"machine_id": "UDI-99999", "user_id": operator["user"]["id"]},
        ).status_code
        == 404
    )

    assert (
        client.post(
            "/api/admin/assignments",
            headers=headers(token),
            json={"machine_id": "not-a-machine", "user_id": operator["user"]["id"]},
        ).status_code
        == 422
    )

    # Admins are not assignment targets.
    admin_id = client.get("/api/auth/me", headers=headers(token)).json()["id"]
    assert (
        client.post(
            "/api/admin/assignments",
            headers=headers(token),
            json={"machine_id": "UDI-00002", "user_id": admin_id},
        ).status_code
        == 400
    )


def test_assignment_controls_machine_visibility(client: TestClient):
    operator = register(client, "operator.scope@smartpredict.io")
    operator_token = operator["access_token"]
    admin = admin_token(client)

    assert (
        client.get("/api/machines/UDI-00003", headers=headers(operator_token)).status_code
        == 403
    )

    assignment = client.post(
        "/api/admin/assignments",
        headers=headers(admin),
        json={"machine_id": "UDI-00003", "user_id": operator["user"]["id"]},
    ).json()

    allowed = client.get("/api/machines/UDI-00003", headers=headers(operator_token))
    assert allowed.status_code == 200
    assert allowed.json()["machine"]["machine_id"] == "UDI-00003"

    removed = client.delete(
        f"/api/admin/assignments/{assignment['id']}", headers=headers(admin)
    )
    assert removed.status_code == 200

    assert (
        client.get("/api/machines/UDI-00003", headers=headers(operator_token)).status_code
        == 403
    )


def test_assignment_endpoints_are_admin_only(client: TestClient):
    operator = register(client, "operator.noassign@smartpredict.io")

    assert (
        client.get(
            "/api/admin/assignments", headers=headers(operator["access_token"])
        ).status_code
        == 403
    )

    assert (
        client.post(
            "/api/admin/assignments",
            headers=headers(operator["access_token"]),
            json={"machine_id": "UDI-00001", "user_id": operator["user"]["id"]},
        ).status_code
        == 403
    )


# =====================================================================
# 5. PREDICTIONS
# =====================================================================

def test_predictions_are_recorded_with_metadata(client: TestClient):
    token = admin_token(client)

    result = client.post(
        "/api/predict", headers=headers(token), json=HIGH_RISK_READING
    )
    assert result.status_code == 200, result.text
    body = result.json()

    assert body["prediction_id"] > 0
    assert body["machine_id"] == "UDI-00001"
    assert body["risk_level"] == "critical"

    history = client.get("/api/predictions", headers=headers(token))
    assert history.status_code == 200

    payload = history.json()
    assert payload["total_count"] == 1

    stored = payload["predictions"][0]
    assert stored["machine_id"] == "UDI-00001"
    assert stored["risk_level"] == "critical"
    assert stored["model_version"].startswith("randomforest-")
    assert stored["decision_threshold"] == 0.5
    assert isinstance(stored["explanations"], list)
    assert len(stored["explanations"]) == 5


def test_safe_prediction_is_low_risk(client: TestClient):
    token = admin_token(client)

    body = client.post(
        "/api/predict", headers=headers(token), json=SAFE_READING
    ).json()

    assert body["risk_level"] in {"low", "medium"}
    assert body["risk_level"] != "critical"


def test_prediction_history_is_scoped_for_operators(client: TestClient):
    operator = register(client, "operator.history@smartpredict.io")
    operator_token = operator["access_token"]
    admin = admin_token(client)

    # Prediction the operator is not allowed to see.
    client.post("/api/predict", headers=headers(admin), json=HIGH_RISK_READING)

    empty = client.get("/api/predictions", headers=headers(operator_token)).json()
    assert empty["total_count"] == 0

    client.post(
        "/api/admin/assignments",
        headers=headers(admin),
        json={"machine_id": "UDI-00001", "user_id": operator["user"]["id"]},
    )

    scoped = client.get("/api/predictions", headers=headers(operator_token)).json()
    assert scoped["total_count"] == 1
    assert scoped["predictions"][0]["machine_id"] == "UDI-00001"

    # A different machine stays invisible.
    other = client.get(
        "/api/predictions?machine_id=UDI-00002", headers=headers(operator_token)
    ).json()
    assert other["total_count"] == 0


def test_prediction_risk_filter_validation(client: TestClient):
    token = admin_token(client)

    assert (
        client.get("/api/predictions?risk=catastrophic", headers=headers(token)).status_code
        == 422
    )

    response = client.get("/api/predictions?risk=critical", headers=headers(token))
    assert response.status_code == 200


def test_machine_detail_includes_latest_prediction(client: TestClient):
    token = admin_token(client)

    client.post("/api/predict", headers=headers(token), json=HIGH_RISK_READING)

    detail = client.get("/api/machines/UDI-00001", headers=headers(token)).json()

    assert detail["machine"]["machine_id"] == "UDI-00001"
    assert detail["latest_prediction"]["risk_level"] == "critical"
    assert detail["prediction_total"] == 1
    assert detail["work_orders"]["by_status"] == {
        "Pending": 0,
        "In Progress": 0,
        "Completed": 0,
    }
    assert detail["record_type"] == "historical_dataset_record"


# =====================================================================
# 6. AUDIT LOG
# =====================================================================

def test_privileged_actions_are_audited(client: TestClient):
    operator = register(client, "operator.audit@smartpredict.io")
    promoted = register(client, "promoted.audit@smartpredict.io")
    admin = admin_token(client)

    make_role(client, promoted["user"]["id"], "Supervisor")

    client.post(
        "/api/admin/assignments",
        headers=headers(admin),
        json={"machine_id": "UDI-00005", "user_id": operator["user"]["id"]},
    )

    response = client.get("/api/admin/audit", headers=headers(admin))
    assert response.status_code == 200

    body = response.json()
    actions = [entry["action"] for entry in body["entries"]]

    assert "user.role_changed" in actions
    assert "machine.assigned" in actions
    assert body["total_count"] >= 2

    entry = next(e for e in body["entries"] if e["action"] == "user.role_changed")
    assert entry["actor_email"] == ADMIN_EMAIL
    assert entry["details"]["new_role"] == "Supervisor"

    assignment_entry = next(
        e for e in body["entries"] if e["action"] == "machine.assigned"
    )
    assert assignment_entry["target_id"] == "UDI-00005"
    assert assignment_entry["details"]["user_email"] == "operator.audit@smartpredict.io"


def test_audit_log_is_admin_only(client: TestClient):
    operator = register(client, "operator.noaudit@smartpredict.io")

    assert (
        client.get("/api/admin/audit", headers=headers(operator["access_token"])).status_code
        == 403
    )


# =====================================================================
# 7. MIGRATION SAFETY
# =====================================================================

def test_schema_migration_is_idempotent(tmp_path: Path):
    database = tmp_path / "repeat.db"

    init_db(database)
    init_db(database)
    init_db(database)

    with get_connection(database) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        version = connection.execute(
            "SELECT version FROM schema_version"
        ).fetchone()[0]

    assert {
        "users",
        "notifications",
        "predictions",
        "machine_assignments",
        "work_orders",
        "issue_reports",
        "audit_log",
    }.issubset(tables)
    assert version == 3
