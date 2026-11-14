"""
Maintenance notification storage.

All persistence goes through :mod:`backend.database` so there is exactly one
schema definition, one connection policy and one place to configure the file
path.  Timestamps are stored in UTC (ISO 8601) and rendered in the browser's
local time zone.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from typing import Any, Optional

from backend.database import get_connection

logger = logging.getLogger("smartpredict.notifications")

VALID_STATUSES = ("NEW", "ACKNOWLEDGED", "RESOLVED")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def serialize_notification(row: Any) -> Optional[dict]:
    """Convert a SQLite row into an API-safe dictionary."""
    if row is None:
        return None

    notification = dict(row)

    for field in ("input_data", "explanations"):
        try:
            notification[field] = (
                json.loads(notification[field]) if notification[field] else {}
            )
        except (TypeError, json.JSONDecodeError):
            notification[field] = {}

    if notification.get("prediction") is not None:
        try:
            notification["prediction"] = int(notification["prediction"])
        except (TypeError, ValueError):
            pass

    return notification


def list_notifications(limit: int = 100, offset: int = 0, status: str | None = None) -> list[dict]:
    query = "SELECT * FROM notifications"
    parameters: list[Any] = []

    if status and status.upper() != "ALL":
        query += " WHERE status = ?"
        parameters.append(status.upper())

    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    parameters.extend([limit, offset])

    with get_connection() as connection:
        rows = connection.execute(query, parameters).fetchall()

    return [serialize_notification(row) for row in rows]


def get_notification(notification_id: int) -> Optional[dict]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM notifications WHERE id = ?",
            (notification_id,),
        ).fetchone()

    return serialize_notification(row)


def create_notification(
    prediction_result: dict,
    sensor_readings: dict,
    profile_id: str | None = None,
    product_id: str | None = None,
) -> Optional[dict]:
    """
    Store a maintenance alert when the model reports meaningful risk.

    ``profile_id`` and ``product_id`` are optional: an ad-hoc prediction is a
    valid request and must not fail just because no machine profile was
    supplied.
    """
    prediction = int(prediction_result.get("prediction", 0))
    probability = float(prediction_result.get("failure_probability", 0) or 0)

    # Only alert on a predicted failure or elevated model probability.
    if prediction != 1 and probability < 0.50:
        return None

    probability_percent = probability * 100

    if probability >= 0.80:
        severity = "CRITICAL"
        title = "Critical Failure Risk Detected"
        message = (
            "The predictive maintenance model indicates a high "
            "probability of equipment failure for this operating profile. "
            f"The estimated model probability is {probability_percent:.2f}%. "
            "An urgent inspection is recommended to assess the operating "
            "condition and reduce the risk of unplanned equipment downtime."
        )
    else:
        severity = "WARNING"
        title = "Elevated Failure Risk Detected"
        message = (
            "The predictive maintenance model has identified an elevated "
            "failure probability for this operating profile. "
            f"The estimated model probability is {probability_percent:.2f}%. "
            "Review the operating parameters and consider scheduling "
            "preventive maintenance."
        )

    explanations = prediction_result.get("explanations", {})
    created_at = _now_iso()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO notifications (
                profile_id, product_id, severity, title, message,
                prediction, failure_probability, assigned_to, status,
                input_data, explanations, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                product_id,
                severity,
                title,
                message,
                prediction,
                probability,
                "Unassigned",
                "NEW",
                json.dumps(sensor_readings or {}),
                json.dumps(explanations or {}),
                created_at,
            ),
        )
        notification_id = cursor.lastrowid

    return get_notification(notification_id)


def assign_notification(notification_id: int, assigned_to: str) -> Optional[dict]:
    if not assigned_to or not assigned_to.strip():
        return None

    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE notifications SET assigned_to = ? WHERE id = ?",
            (assigned_to.strip(), notification_id),
        )
        updated = cursor.rowcount

    if updated == 0:
        return None

    return get_notification(notification_id)


def acknowledge_notification(notification_id: int) -> Optional[dict]:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET status = 'ACKNOWLEDGED',
                acknowledged_at = ?
            WHERE id = ?
              AND status = 'NEW'
            """,
            (_now_iso(), notification_id),
        )
        updated = cursor.rowcount

    if updated == 0:
        return None

    return get_notification(notification_id)


def resolve_notification(notification_id: int) -> Optional[dict]:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET status = 'RESOLVED',
                resolved_at = ?
            WHERE id = ?
              AND status IN ('NEW', 'ACKNOWLEDGED')
            """,
            (_now_iso(), notification_id),
        )
        updated = cursor.rowcount

    if updated == 0:
        return None

    return get_notification(notification_id)


def count_notifications(status: str | None = None) -> int:
    """Total number of stored notifications, optionally for one status."""
    query = "SELECT COUNT(*) FROM notifications"
    parameters: list[Any] = []

    if status and status.upper() != "ALL":
        query += " WHERE status = ?"
        parameters.append(status.upper())

    with get_connection() as connection:
        return int(connection.execute(query, parameters).fetchone()[0])
