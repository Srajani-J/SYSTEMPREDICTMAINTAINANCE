"""
Authentication API.

Replaces the previous browser-only login with server-side credential checks,
JWT access tokens, a server-side token denylist and role-aware sessions.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from backend import settings
from backend.auth_service import (
    authenticate_user,
    change_password as change_user_password,
    create_user,
    revoke_token,
)
from backend.deps import bearer_scheme, get_current_user, get_token_payload
from backend.ratelimit import enforce
from backend.security import create_access_token

logger = logging.getLogger("smartpredict.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


# =====================================================================
# REQUEST MODELS
# =====================================================================

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120, examples=["Asha Rao"])
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=72)


# =====================================================================
# HELPERS
# =====================================================================

def _session_response(user: dict) -> dict:
    """Build a login/register response: new token plus the public user record."""
    token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        role=user["role"],
        token_version=user["token_version"],
    )

    return {
        "access_token": token["token"],
        "token_type": "bearer",
        "expires_at": token["expires_at"],
        "expires_in_seconds": token["expires_in_seconds"],
        "user": user,
    }


# =====================================================================
# REGISTRATION
# =====================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: Request, payload: RegisterRequest):
    """
    Create an Operator account and sign it in.

    Public registration can never choose a privileged role; the service forces
    ``Operator`` regardless of the request body.
    """
    enforce(
        request,
        "auth-register",
        settings.RATE_LIMIT_REGISTER,
        settings.RATE_LIMIT_WINDOW_SECONDS,
    )

    try:
        user = create_user(
            name=payload.name,
            email=str(payload.email),
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except sqlite3.IntegrityError as exc:
        # Lost a race against another registration for the same email.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        ) from exc

    logger.info("New Operator account registered: %s", user["email"])

    return _session_response(user)


# =====================================================================
# LOGIN
# =====================================================================

@router.post("/login")
def login(request: Request, payload: LoginRequest):
    """Verify credentials and issue a JWT access token."""
    email = str(payload.email).strip().lower()

    enforce(
        request,
        "auth-login",
        settings.RATE_LIMIT_LOGIN,
        settings.RATE_LIMIT_WINDOW_SECONDS,
        subject=f"{getattr(request.client, 'host', 'unknown')}:{email}",
    )

    user = authenticate_user(email, payload.password)

    if user is None:
        # Same message for unknown email and wrong password: no account
        # enumeration through the response body.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("User signed in: %s (%s)", user["email"], user["role"])

    return _session_response(user)


# =====================================================================
# CURRENT SESSION
# =====================================================================

@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    """Return the authenticated user's public profile."""
    return user


@router.post("/logout")
def logout(
    user: dict = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """Revoke the presented token server-side."""
    if credentials is None:  # defensive: get_current_user already required it
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    expires_at = datetime.fromtimestamp(
        int(payload["exp"]), tz=timezone.utc
    ).isoformat()

    revoke_token(payload["jti"], user["id"], expires_at)

    logger.info("User signed out: %s", user["email"])

    return {"detail": "Signed out successfully."}


@router.post("/change-password")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
):
    """
    Change the current user's password.

    Rotating ``token_version`` invalidates every other outstanding session, and
    the response issues a fresh token for this one.
    """
    enforce(
        request,
        "auth-change-password",
        10,
        settings.RATE_LIMIT_WINDOW_SECONDS,
        subject=str(user["id"]),
    )

    try:
        updated = change_user_password(
            user["id"],
            payload.current_password,
            payload.new_password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    logger.info("Password changed for user %s", updated["email"])

    return _session_response(updated)
