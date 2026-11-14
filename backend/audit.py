"""
Audit trail for privileged actions.

Only real, executed actions are recorded here; the Admin dashboard reads this
table directly, so nothing is ever fabricated. A failure to write an audit row
is logged but never breaks the action itself.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from backend.database import get_connection
from backend.timeutil import now_iso

logger = logging.getLogger("smartpredict.audit")


def record_action(
    actor: Optional[dict],
    action: str,
    target_type: str,
    target_id: str | int | None = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    """Store one audit entry. Never raises."""
    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO audit_log (
                    actor_id, actor_email, action, target_type, target_id,
                    details, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    (actor or {}).get("id"),
                    (actor or {}).get("email", "system"),
                    action,
                    target_type,
                    None if target_id is None else str(target_id),
                    json.dumps(details or {}),
                    now_iso(),
                ),
            )
    except Exception:
        logger.exception("Could not write audit entry for action %s", action)


def serialize_audit(row: Any) -> dict:
    entry = dict(row)

    try:
        entry["details"] = json.loads(entry["details"]) if entry["details"] else {}
    except (TypeError, json.JSONDecodeError):
        entry["details"] = {}

    return entry


def list_audit(
    limit: int = 50,
    offset: int = 0,
    action: str | None = None,
) -> tuple[list[dict], int]:
    """Return audit entries, newest first, plus the total count."""
    where = ""
    parameters: list[Any] = []

    if action:
        where = " WHERE action = ?"
        parameters.append(action)

    with get_connection() as connection:
        total = connection.execute(
            f"SELECT COUNT(*) FROM audit_log{where}", parameters
        ).fetchone()[0]

        rows = connection.execute(
            f"SELECT * FROM audit_log{where} ORDER BY id DESC LIMIT ? OFFSET ?",
            [*parameters, limit, offset],
        ).fetchall()

    return [serialize_audit(row) for row in rows], int(total)
