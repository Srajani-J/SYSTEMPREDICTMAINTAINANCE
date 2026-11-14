"""
Machine assignment persistence.

A machine (an AI4I record, identified as ``UDI-00001``) can be assigned to a
Maintenance Engineer or an Operator. Assignments are the basis for every
"assigned machines" scope: Admins and Supervisors see everything, engineers and
operators see only what is assigned to them.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.database import get_connection
from backend.timeutil import now_iso

ASSIGNABLE_ROLES = ("Maintenance", "Operator")

_SELECT = """
    SELECT
        a.id,
        a.machine_id,
        a.user_id,
        a.assigned_by,
        a.assigned_at,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        u.is_active AS user_is_active
    FROM machine_assignments a
    JOIN users u ON u.id = a.user_id
"""


def assign_machine(
    machine_id: str,
    user_id: int,
    assigned_by: Optional[int] = None,
) -> dict:
    """Create an assignment, returning the existing one if it already exists."""
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM machine_assignments WHERE machine_id = ? AND user_id = ?",
            (machine_id, user_id),
        ).fetchone()

        if existing is not None:
            assignment_id = existing["id"]
        else:
            cursor = connection.execute(
                """
                INSERT INTO machine_assignments (
                    machine_id, user_id, assigned_by, assigned_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (machine_id, user_id, assigned_by, now_iso()),
            )
            assignment_id = cursor.lastrowid

    assignment = get_assignment(assignment_id)

    if assignment is None:  # pragma: no cover - defensive
        raise RuntimeError("Assignment could not be read back.")

    return assignment


def get_assignment(assignment_id: int) -> Optional[dict]:
    with get_connection() as connection:
        row = connection.execute(
            _SELECT + " WHERE a.id = ?", (assignment_id,)
        ).fetchone()

    return dict(row) if row is not None else None


def list_assignments(
    machine_id: str | None = None,
    user_id: int | None = None,
) -> list[dict]:
    where: list[str] = []
    parameters: list[Any] = []

    if machine_id:
        where.append("a.machine_id = ?")
        parameters.append(machine_id)

    if user_id is not None:
        where.append("a.user_id = ?")
        parameters.append(user_id)

    clause = (" WHERE " + " AND ".join(where)) if where else ""

    with get_connection() as connection:
        rows = connection.execute(
            _SELECT + clause + " ORDER BY a.id DESC", parameters
        ).fetchall()

    return [dict(row) for row in rows]


def delete_assignment(assignment_id: int) -> Optional[dict]:
    """Remove an assignment, returning the deleted row for audit purposes."""
    assignment = get_assignment(assignment_id)

    if assignment is None:
        return None

    with get_connection() as connection:
        connection.execute(
            "DELETE FROM machine_assignments WHERE id = ?", (assignment_id,)
        )

    return assignment


def assigned_machine_ids(user_id: int) -> set[str]:
    """Machine ids currently assigned to one user."""
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT machine_id FROM machine_assignments WHERE user_id = ?",
            (user_id,),
        ).fetchall()

    return {row["machine_id"] for row in rows}


def count_assignments() -> int:
    with get_connection() as connection:
        return int(
            connection.execute(
                "SELECT COUNT(*) FROM machine_assignments"
            ).fetchone()[0]
        )
