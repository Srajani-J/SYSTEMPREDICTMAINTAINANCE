"""
Prediction history.

Every call to ``/api/predict`` stores the result here (probability, risk band,
model version, decision threshold, inputs and SHAP explanations). This is what
the Admin, Engineer and Supervisor history views read, so a prediction can be
traced back to the exact model that produced it.

``notifications`` remains the alerting channel and is untouched.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from backend.database import get_connection
from backend.risk import risk_level
from backend.timeutil import now_iso


def _serialize(row: Any) -> Optional[dict]:
    if row is None:
        return None

    entry = dict(row)

    for field in ("input_data", "explanations"):
        try:
            entry[field] = json.loads(entry[field]) if entry[field] else (
                [] if field == "explanations" else {}
            )
        except (TypeError, json.JSONDecodeError):
            entry[field] = [] if field == "explanations" else {}

    return entry


def get_prediction(prediction_id: int) -> Optional[dict]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM predictions WHERE id = ?", (prediction_id,)
        ).fetchone()

    return _serialize(row)


def record_prediction(
    result: dict,
    sensor_readings: dict,
    machine_id: str | None,
    user_id: int | None,
) -> dict:
    """Persist one prediction result and return the stored row."""
    probability = float(result.get("failure_probability", 0) or 0)
    level = result.get("risk_level") or risk_level(probability)

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO predictions (
                machine_id, user_id, prediction, failure_probability,
                risk_level, model_version, decision_threshold,
                input_data, explanations, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                machine_id,
                user_id,
                int(result.get("prediction", 0)),
                probability,
                level,
                str(result.get("model_version") or "unknown"),
                float(result.get("decision_threshold", 0.5)),
                json.dumps(sensor_readings or {}),
                json.dumps(result.get("explanations") or []),
                now_iso(),
            ),
        )
        prediction_id = cursor.lastrowid

    stored = get_prediction(prediction_id)

    if stored is None:  # pragma: no cover - defensive
        raise RuntimeError("Prediction could not be read back.")

    return stored


def list_predictions(
    limit: int = 50,
    offset: int = 0,
    machine_id: str | None = None,
    level: str | None = None,
    machine_ids: set[str] | None = None,
) -> tuple[list[dict], int]:
    """
    Return predictions newest first.

    ``machine_ids`` scopes the result for roles that only see assigned machines;
    ``None`` means "no scoping".
    """
    where: list[str] = []
    parameters: list[Any] = []

    if machine_id:
        where.append("machine_id = ?")
        parameters.append(machine_id)

    if level:
        where.append("risk_level = ?")
        parameters.append(level.lower())

    if machine_ids is not None:
        if not machine_ids:
            return [], 0

        placeholders = ", ".join("?" for _ in machine_ids)
        where.append(f"machine_id IN ({placeholders})")
        parameters.extend(sorted(machine_ids))

    clause = (" WHERE " + " AND ".join(where)) if where else ""

    with get_connection() as connection:
        total = int(
            connection.execute(
                f"SELECT COUNT(*) FROM predictions{clause}", parameters
            ).fetchone()[0]
        )

        rows = connection.execute(
            f"SELECT * FROM predictions{clause} ORDER BY id DESC LIMIT ? OFFSET ?",
            [*parameters, limit, offset],
        ).fetchall()

    return [_serialize(row) for row in rows], total


def latest_for_machine(machine_id: str) -> Optional[dict]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT * FROM predictions
            WHERE machine_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (machine_id,),
        ).fetchone()

    return _serialize(row)


def risk_distribution() -> dict[str, int]:
    """Count predictions per risk band (never machine counts)."""
    distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}

    with get_connection() as connection:
        rows = connection.execute(
            "SELECT risk_level, COUNT(*) FROM predictions GROUP BY risk_level"
        ).fetchall()

    for level, count in rows:
        if level in distribution:
            distribution[level] = int(count)

    return distribution


def prediction_stats() -> dict:
    with get_connection() as connection:
        total = int(
            connection.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
        )
        machines = int(
            connection.execute(
                "SELECT COUNT(DISTINCT machine_id) FROM predictions "
                "WHERE machine_id IS NOT NULL"
            ).fetchone()[0]
        )

    return {
        "total": total,
        "machines_with_predictions": machines,
        "risk_distribution": risk_distribution(),
    }
