"""
Dashboard statistics.

Every number here is a live count from the database — no sample or placeholder
values. Dataset-derived figures (machine totals, historical failures) are added
by the endpoint, because they depend on the CSV.
"""

from __future__ import annotations

from typing import Any

from backend.assignments_service import count_assignments
from backend.audit import list_audit
from backend.database import get_connection
from backend.predictions_service import prediction_stats

WORK_ORDER_STATUSES = ("Pending", "In Progress", "Completed")
ISSUE_STATUSES = ("Open", "Acknowledged", "In Progress", "Resolved")
NOTIFICATION_STATUSES = ("NEW", "ACKNOWLEDGED", "RESOLVED")


def _count(connection, sql: str, parameters: list[Any] | None = None) -> int:
    return int(connection.execute(sql, parameters or []).fetchone()[0])


def _grouped(connection, sql: str, parameters: list[Any] | None = None) -> dict[str, int]:
    rows = connection.execute(sql, parameters or []).fetchall()
    return {str(key): int(value) for key, value in rows}


def work_order_stats(machine_id: str | None = None) -> dict:
    where = ""
    parameters: list[Any] = []

    if machine_id:
        where = " WHERE machine_id = ?"
        parameters.append(machine_id)

    with get_connection() as connection:
        total = _count(connection, f"SELECT COUNT(*) FROM work_orders{where}", parameters)
        by_status = _grouped(
            connection,
            f"SELECT status, COUNT(*) FROM work_orders{where} GROUP BY status",
            parameters,
        )
        open_count = _count(
            connection,
            "SELECT COUNT(*) FROM work_orders" + where + (" AND " if where else " WHERE ")
            + "status != 'Completed'",
            parameters,
        )

    statuses = {status: 0 for status in WORK_ORDER_STATUSES}
    statuses.update(by_status)

    return {"total": total, "open": open_count, "by_status": statuses}


def issue_stats() -> dict:
    with get_connection() as connection:
        total = _count(connection, "SELECT COUNT(*) FROM issue_reports")
        by_status = _grouped(
            connection, "SELECT status, COUNT(*) FROM issue_reports GROUP BY status"
        )

    statuses = {status: 0 for status in ISSUE_STATUSES}
    statuses.update(by_status)

    return {"total": total, "by_status": statuses}


def notification_stats() -> dict:
    with get_connection() as connection:
        total = _count(connection, "SELECT COUNT(*) FROM notifications")
        by_status = _grouped(
            connection, "SELECT status, COUNT(*) FROM notifications GROUP BY status"
        )
        by_severity = _grouped(
            connection, "SELECT severity, COUNT(*) FROM notifications GROUP BY severity"
        )

    statuses = {status: 0 for status in NOTIFICATION_STATUSES}
    statuses.update(by_status)

    return {"total": total, "by_status": statuses, "by_severity": by_severity}


def user_stats() -> dict:
    with get_connection() as connection:
        total = _count(connection, "SELECT COUNT(*) FROM users")
        active = _count(connection, "SELECT COUNT(*) FROM users WHERE is_active = 1")
        must_change = _count(
            connection, "SELECT COUNT(*) FROM users WHERE must_change_password = 1"
        )
        by_role = _grouped(connection, "SELECT role, COUNT(*) FROM users GROUP BY role")

    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "must_change_password": must_change,
        "by_role": by_role,
    }


def database_overview() -> dict:
    """Every dashboard statistic that can be computed without the dataset."""
    return {
        "users": user_stats(),
        "assignments_total": count_assignments(),
        "notifications": notification_stats(),
        "predictions": prediction_stats(),
        "work_orders": work_order_stats(),
        "issues": issue_stats(),
        "recent_activity": list_audit(limit=10)[0],
    }
