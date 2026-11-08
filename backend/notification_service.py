
import json
import sqlite3
from pathlib import Path
from datetime import datetime


# Store the database in the SmartPredict project root.
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "notification_data.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_notification_db():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT,
                product_id TEXT,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                prediction INTEGER,
                failure_probability REAL,
                assigned_to TEXT DEFAULT 'Unassigned',
                status TEXT DEFAULT 'NEW',
                input_data TEXT,
                explanations TEXT,
                created_at TEXT NOT NULL,
                acknowledged_at TEXT,
                resolved_at TEXT
            )
        """)
        connection.commit()


def serialize_notification(row):
    if row is None:
        return None

    notification = dict(row)

    for field in ("input_data", "explanations"):
        try:
            notification[field] = (
                json.loads(notification[field])
                if notification[field]
                else {}
            )
        except (TypeError, json.JSONDecodeError):
            notification[field] = {}

    return notification


def get_notification(notification_id):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM notifications WHERE id = ?",
            (notification_id,)
        ).fetchone()

    return serialize_notification(row)


def create_notification(
    prediction_result,
    sensor_readings,
    profile_id=None,
    product_id=None
):
    prediction = int(prediction_result.get("prediction", 0))
    probability = float(
        prediction_result.get("failure_probability", 0)
    )

    # Create an alert for a predicted failure or elevated model probability.
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

    created_at = datetime.now().astimezone().isoformat(
        timespec="seconds"
    )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO notifications (
                profile_id,
                product_id,
                severity,
                title,
                message,
                prediction,
                failure_probability,
                assigned_to,
                status,
                input_data,
                explanations,
                created_at
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
                created_at
            )
        )

        notification_id = cursor.lastrowid
        connection.commit()

    return get_notification(notification_id)


def list_notifications(limit=100, offset=0, status=None):
    query = "SELECT * FROM notifications"
    parameters = []

    if status and status.upper() != "ALL":
        query += " WHERE status = ?"
        parameters.append(status.upper())

    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    parameters.extend([limit, offset])

    with get_connection() as connection:
        rows = connection.execute(
            query,
            parameters
        ).fetchall()

    return [serialize_notification(row) for row in rows]


def assign_notification(notification_id, assigned_to):
    if not assigned_to or not assigned_to.strip():
        return None

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET assigned_to = ?
            WHERE id = ?
            """,
            (assigned_to.strip(), notification_id)
        )
        connection.commit()

    if cursor.rowcount == 0:
        return None

    return get_notification(notification_id)


def acknowledge_notification(notification_id):
    acknowledged_at = datetime.now().astimezone().isoformat(
        timespec="seconds"
    )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET status = 'ACKNOWLEDGED',
                acknowledged_at = ?
            WHERE id = ?
              AND status = 'NEW'
            """,
            (acknowledged_at, notification_id)
        )
        connection.commit()

    if cursor.rowcount == 0:
        return None

    return get_notification(notification_id)


def resolve_notification(notification_id):
    resolved_at = datetime.now().astimezone().isoformat(
        timespec="seconds"
    )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET status = 'RESOLVED',
                resolved_at = ?
            WHERE id = ?
              AND status IN ('NEW', 'ACKNOWLEDGED')
            """,
            (resolved_at, notification_id)
        )
        connection.commit()

    if cursor.rowcount == 0:
        return None

    return get_notification(notification_id)


# Initialize the database when this module is loaded.
initialize_notification_db()
