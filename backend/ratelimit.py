"""
Small in-process rate limiter.

Good enough for a single-process deployment (which is what this project runs):
a fixed-window counter per (bucket, client) pair.  If the API is ever scaled to
multiple workers this should move to Redis, but the interface would not change.
"""

from __future__ import annotations

import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status

_MAX_TRACKED_KEYS = 5000

_lock = threading.Lock()
_events: dict[tuple[str, str], deque[float]] = {}


def reset_rate_limits() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _events.clear()


def _client_key(request: Request) -> str:
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def _prune(now: float, window_seconds: int) -> None:
    cutoff = now - window_seconds
    for key in list(_events):
        bucket = _events[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if not bucket:
            del _events[key]


def enforce(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
    subject: str | None = None,
) -> None:
    """
    Count one attempt and raise HTTP 429 when the limit is exceeded.

    ``subject`` narrows the counter (for example to a specific login email) so
    one noisy account cannot exhaust a shared IP budget by itself.
    """
    if limit <= 0:
        return

    key = (bucket, subject or _client_key(request))
    now = time.monotonic()

    with _lock:
        if len(_events) > _MAX_TRACKED_KEYS:
            _prune(now, window_seconds)

        attempts = _events.setdefault(key, deque())
        cutoff = now - window_seconds

        while attempts and attempts[0] <= cutoff:
            attempts.popleft()

        if len(attempts) >= limit:
            retry_after = max(1, int(window_seconds - (now - attempts[0])) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )

        attempts.append(now)
