"""
Shared FastAPI dependencies for authentication and authorisation.

Every data or mutation endpoint depends on :func:`get_current_user`, which
validates the bearer token's signature, expiry, required claims, revocation
status, account activation and token version.  That combination means a
password change, role change or deactivation invalidates existing sessions
immediately.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.auth_service import get_user_by_id, is_token_revoked
from backend.security import decode_access_token

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="JWT access token issued by POST /api/auth/login",
)

_UNAUTHORISED_HEADERS = {"WWW-Authenticate": "Bearer"}


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers=_UNAUTHORISED_HEADERS,
    )


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Decode and validate the bearer token, returning its claims."""
    if credentials is None or not credentials.credentials:
        raise _unauthorised("Authentication required.")

    try:
        return decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorised("Session expired. Please sign in again.") from exc
    except jwt.PyJWTError as exc:
        raise _unauthorised("Invalid authentication token.") from exc


def get_current_user(payload: dict = Depends(get_token_payload)) -> dict:
    """Return the authenticated, active user for the current request."""
    jti = payload.get("jti")
    user_id = payload.get("uid")

    if not isinstance(jti, str) or not isinstance(user_id, int):
        raise _unauthorised("Invalid authentication token.")

    if is_token_revoked(jti):
        raise _unauthorised("Session has been signed out. Please sign in again.")

    user = get_user_by_id(user_id)

    if user is None:
        raise _unauthorised("Account not found.")

    if user["is_active"] != 1:
        raise _unauthorised("This account is disabled.")

    if int(payload.get("ver", -1)) != int(user["token_version"]):
        raise _unauthorised(
            "Session is no longer valid. Please sign in again."
        )

    return user


def require_roles(*roles: str):
    """Dependency factory: allow only the listed roles."""
    allowed = set(roles)

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your role does not permit this action. Required role: "
                    + ", ".join(sorted(allowed))
                ),
            )
        return user

    return dependency
