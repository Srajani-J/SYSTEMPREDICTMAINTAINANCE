"""
Administrator API.

Covers user management (list/filter, role, activation), machine assignment and
the audit trail. Every privileged action is written to ``audit_log`` so the
Admin dashboard can show real history rather than fabricated activity.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.assignments_service import (
    ASSIGNABLE_ROLES,
    assign_machine,
    delete_assignment,
    list_assignments,
)
from backend.audit import list_audit, record_action
from backend.auth_service import (
    VALID_ROLES,
    count_active_admins,
    get_user_by_id,
    list_users,
    set_user_active_status,
    set_user_role,
)
from backend.dataset import dataset_or_error, machine_exists, machine_id_for, parse_machine_id
from backend.deps import require_roles

logger = logging.getLogger("smartpredict.admin")

admin_only = require_roles("Admin")

router = APIRouter(
    prefix="/api/auth/users",
    tags=["admin"],
    dependencies=[Depends(admin_only)],
)

admin_router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(admin_only)],
)

RoleName = Literal["Admin", "Supervisor", "Maintenance", "Operator"]


class RoleUpdate(BaseModel):
    role: RoleName


class ActiveUpdate(BaseModel):
    is_active: bool


class AssignmentRequest(BaseModel):
    machine_id: str = Field(min_length=1, max_length=32)
    user_id: int = Field(ge=1)


# =====================================================================
# USERS
# =====================================================================

def _serialize_user(user: dict) -> dict:
    return user


@router.get("")
def get_users(
    q: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, max_length=20),
    is_active: int | None = Query(default=None, ge=0, le=1),
    _admin: dict = Depends(admin_only),
):
    """
    List accounts, optionally filtered.

    Returns an array to stay compatible with the existing Account Management
    panel; the user table is small, so filtering happens in memory.
    """
    if role is not None and role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of {sorted(VALID_ROLES)}",
        )

    users = list_users()

    if q and q.strip():
        needle = q.strip().lower()
        users = [
            user
            for user in users
            if needle in user["name"].lower() or needle in user["email"].lower()
        ]

    if role:
        users = [user for user in users if user["role"] == role]

    if is_active is not None:
        users = [user for user in users if int(user["is_active"]) == int(is_active)]

    return [_serialize_user(user) for user in users]


def _get_user_or_404(user_id: int) -> dict:
    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


def _guard_last_admin(target: dict, removing_admin_rights: bool) -> None:
    """Block actions that would leave the platform without an active Admin."""
    if target["role"] != "Admin" or target["is_active"] != 1:
        return

    if not removing_admin_rights:
        return

    if count_active_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This is the last active Administrator account. Promote "
                "another account before changing it."
            ),
        )


@router.patch("/{user_id}/role")
def update_role(
    user_id: int,
    payload: RoleUpdate,
    admin: dict = Depends(admin_only),
):
    """Change an account's role; the target's sessions are revoked."""
    target = _get_user_or_404(user_id)

    if target["id"] == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role.",
        )

    _guard_last_admin(target, removing_admin_rights=payload.role != "Admin")

    updated = set_user_role(user_id, payload.role)

    record_action(
        admin,
        "user.role_changed",
        "user",
        updated["id"],
        {
            "email": updated["email"],
            "previous_role": target["role"],
            "new_role": payload.role,
        },
    )

    logger.info(
        "Role changed: %s %s -> %s by %s",
        updated["email"],
        target["role"],
        payload.role,
        admin["email"],
    )

    return updated


@router.patch("/{user_id}/active")
def update_active(
    user_id: int,
    payload: ActiveUpdate,
    admin: dict = Depends(admin_only),
):
    """Activate or deactivate an account (deactivation revokes sessions)."""
    target = _get_user_or_404(user_id)

    if target["id"] == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    _guard_last_admin(target, removing_admin_rights=not payload.is_active)

    updated = set_user_active_status(user_id, payload.is_active)

    record_action(
        admin,
        "user.activated" if payload.is_active else "user.deactivated",
        "user",
        updated["id"],
        {"email": updated["email"]},
    )

    logger.info(
        "Account %s %s by %s",
        updated["email"],
        "activated" if payload.is_active else "deactivated",
        admin["email"],
    )

    return updated


# =====================================================================
# MACHINE ASSIGNMENTS
# =====================================================================

@admin_router.get("/assignments")
def get_assignments(
    machine_id: str | None = Query(default=None, max_length=32),
    user_id: int | None = Query(default=None, ge=1),
    _admin: dict = Depends(admin_only),
):
    """List machine assignments, optionally for one machine or one user."""
    normalised = None

    if machine_id:
        record_id = parse_machine_id(machine_id)

        if record_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="machine_id must look like UDI-00001.",
            )

        normalised = machine_id_for(record_id)

    return list_assignments(machine_id=normalised, user_id=user_id)


@admin_router.post("/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: AssignmentRequest,
    admin: dict = Depends(admin_only),
):
    """
    Assign a machine to a Maintenance Engineer or an Operator.

    Admins and Supervisors already see every machine, so they cannot be
    assignment targets.
    """
    record_id = parse_machine_id(payload.machine_id)

    if record_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="machine_id must look like UDI-00001.",
        )

    dataset_or_error()

    if not machine_exists(record_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Machine not found.",
        )

    target = _get_user_or_404(payload.user_id)

    if target["role"] not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only Maintenance Engineer and Operator accounts can be "
                "assigned machines."
            ),
        )

    if target["is_active"] != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That account is deactivated.",
        )

    assignment = assign_machine(
        machine_id=machine_id_for(record_id),
        user_id=payload.user_id,
        assigned_by=admin["id"],
    )

    record_action(
        admin,
        "machine.assigned",
        "machine",
        assignment["machine_id"],
        {
            "user_id": assignment["user_id"],
            "user_email": assignment["user_email"],
            "user_role": assignment["user_role"],
        },
    )

    return assignment


@admin_router.delete("/assignments/{assignment_id}")
def remove_assignment(
    assignment_id: int,
    admin: dict = Depends(admin_only),
):
    """Remove an assignment; the user immediately loses access to the machine."""
    assignment = delete_assignment(assignment_id)

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )

    record_action(
        admin,
        "machine.unassigned",
        "machine",
        assignment["machine_id"],
        {
            "user_id": assignment["user_id"],
            "user_email": assignment["user_email"],
        },
    )

    return {"detail": "Assignment removed.", "assignment": assignment}


# =====================================================================
# AUDIT LOG
# =====================================================================

@admin_router.get("/audit")
def get_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None, max_length=60),
    _admin: dict = Depends(admin_only),
):
    """Real administrative activity, newest first."""
    entries, total = list_audit(limit=limit, offset=offset, action=action)

    return {
        "total_count": total,
        "count": len(entries),
        "limit": limit,
        "offset": offset,
        "entries": entries,
    }
