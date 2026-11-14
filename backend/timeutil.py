"""Time helpers shared by the services."""

from datetime import datetime, timezone


def now_iso() -> str:
    """Current UTC time as an ISO 8601 string with second precision."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
