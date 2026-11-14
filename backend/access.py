"""
Machine visibility rules.

Admins and Supervisors see every machine. Maintenance Engineers and Operators
see only machines assigned to them. These helpers are used by the API so the
rule is enforced on the server, never only by hiding UI.
"""

from __future__ import annotations

from fastapi import HTTPException, status

from backend.assignments_service import assigned_machine_ids

# Roles that are not limited to assigned machines.
ALL_MACHINE_ROLES = frozenset({"Admin", "Supervisor"})


def sees_all_machines(user: dict) -> bool:
    return user.get("role") in ALL_MACHINE_ROLES


def machine_scope(user: dict) -> set[str] | None:
    """
    Machine ids visible to this user.

    ``None`` means unrestricted; a set (possibly empty) means restricted.
    """
    if sees_all_machines(user):
        return None

    return assigned_machine_ids(int(user["id"]))


def can_access_machine(user: dict, machine_id: str) -> bool:
    scope = machine_scope(user)

    return scope is None or machine_id in scope


def ensure_machine_access(user: dict, machine_id: str) -> None:
    if not can_access_machine(user, machine_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This machine is not assigned to you.",
        )
