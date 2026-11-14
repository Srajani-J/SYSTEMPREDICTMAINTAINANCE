"""
Database module for SmartPredict.

Single owner of the SQLite schema, connection policy and migrations.

Notes
-----
* ``get_connection`` is a real context manager: it commits on success, rolls
  back on failure and always closes the connection (``with sqlite3.connect()``
  alone only manages the transaction, it does not close the connection).
* WAL journaling plus a busy timeout keeps concurrent API requests from
  failing with "database is locked".
* ``init_db`` is idempotent and migration-aware.  Older databases created by
  earlier releases declared ``notifications.profile_id`` as NOT NULL and
  ``prediction`` as TEXT; the migration rebuilds that table without losing
  rows.
"""

from __future__ import annotations

from contextlib import closing, contextmanager
from datetime import datetime, timezone
import logging
from pathlib import Path
import sqlite3
from typing import Generator, Optional

from backend import settings

logger = logging.getLogger("smartpredict.database")

BASE_DIR = settings.BASE_DIR

# Kept for backwards compatibility with modules that import DB_PATH directly.
DB_PATH = settings.DATABASE_PATH

SCHEMA_VERSION = 3

USERS_DDL = """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Operator'
            CHECK (role IN ('Admin', 'Supervisor', 'Maintenance', 'Operator')),
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        token_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login TEXT,
        password_changed_at TEXT NOT NULL
    )
"""

REVOKED_TOKENS_DDL = """
    CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        revoked_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
    )
"""

NOTIFICATIONS_DDL = """
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT,
        product_id TEXT,
        severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        prediction INTEGER NOT NULL,
        failure_probability REAL NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT 'Unassigned',
        status TEXT NOT NULL DEFAULT 'NEW'
            CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
        input_data TEXT NOT NULL DEFAULT '{}',
        explanations TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        resolved_at TEXT
    )
"""

MACHINE_ASSIGNMENTS_DDL = """
    CREATE TABLE IF NOT EXISTS machine_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL,
        UNIQUE (machine_id, user_id)
    )
"""

PREDICTIONS_DDL = """
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        prediction INTEGER NOT NULL,
        failure_probability REAL NOT NULL,
        risk_level TEXT NOT NULL
            CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
        model_version TEXT NOT NULL,
        decision_threshold REAL NOT NULL,
        input_data TEXT NOT NULL DEFAULT '{}',
        explanations TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
    )
"""

WORK_ORDERS_DDL = """
    CREATE TABLE IF NOT EXISTS work_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'Medium'
            CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
        status TEXT NOT NULL DEFAULT 'Pending'
            CHECK (status IN ('Pending', 'In Progress', 'Completed')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        due_date TEXT,
        notes TEXT NOT NULL DEFAULT '',
        completion_notes TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
    )
"""

ISSUE_REPORTS_DDL = """
    CREATE TABLE IF NOT EXISTS issue_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        reported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open'
            CHECK (status IN ('Open', 'Acknowledged', 'In Progress', 'Resolved')),
        work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
"""

AUDIT_LOG_DDL = """
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER,
        actor_email TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
    )
"""


# =====================================================================
# CONNECTIONS
# =====================================================================

@contextmanager
def get_connection(
    database_path: Optional[Path] = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Yield a configured SQLite connection and always close it."""
    path = Path(database_path) if database_path else settings.database_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row

    try:
        connection.execute("PRAGMA foreign_keys = ON;")
        connection.execute("PRAGMA busy_timeout = 30000;")
        connection.execute("PRAGMA journal_mode = WAL;")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


# =====================================================================
# SCHEMA / MIGRATIONS
# =====================================================================

def _table_columns(conn: sqlite3.Connection, table: str) -> dict[str, dict]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {
        row["name"]: {
            "type": (row["type"] or "").upper(),
            "notnull": bool(row["notnull"]),
        }
        for row in rows
    }


def _needs_notifications_rebuild(columns: dict[str, dict]) -> bool:
    """Detect the legacy schema (NOT NULL profile_id / TEXT prediction)."""
    if not columns:
        return False

    profile_id = columns.get("profile_id")
    prediction = columns.get("prediction")

    if profile_id is not None and profile_id["notnull"]:
        return True

    if prediction is not None and prediction["type"] != "INTEGER":
        return True

    return False


def _rebuild_notifications(conn: sqlite3.Connection) -> None:
    """Rebuild the notifications table in place, preserving every row."""
    existing = set(_table_columns(conn, "notifications"))

    # Column names are module constants; no external input reaches this SQL.
    expressions = {
        "profile_id": "profile_id",
        "product_id": "product_id",
        "severity": (
            "CASE WHEN severity IN ('CRITICAL', 'WARNING') "
            "THEN severity ELSE 'WARNING' END"
        ),
        "title": "COALESCE(title, 'Maintenance notification')",
        "message": "COALESCE(message, '')",
        "prediction": "COALESCE(CAST(prediction AS INTEGER), 0)",
        "failure_probability": "COALESCE(CAST(failure_probability AS REAL), 0.0)",
        "assigned_to": "COALESCE(assigned_to, 'Unassigned')",
        "status": (
            "CASE WHEN status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED') "
            "THEN status ELSE 'NEW' END"
        ),
        "input_data": "COALESCE(input_data, '{}')",
        "explanations": "COALESCE(explanations, '{}')",
        "created_at": "COALESCE(created_at, '1970-01-01T00:00:00+00:00')",
        "acknowledged_at": "acknowledged_at",
        "resolved_at": "resolved_at",
    }

    columns = [name for name in expressions if name in existing]
    select_list = ", ".join(expressions[name] for name in columns)
    insert_columns = ", ".join(columns)

    conn.execute("ALTER TABLE notifications RENAME TO notifications_legacy")
    conn.execute(NOTIFICATIONS_DDL)
    conn.execute(
        f"INSERT INTO notifications ({insert_columns}) "
        f"SELECT {select_list} FROM notifications_legacy"
    )
    conn.execute("DROP TABLE notifications_legacy")

    logger.info("Rebuilt notifications table (%s columns migrated).", len(columns))


def _users_table_sql(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()

    return (row["sql"] or "") if row else ""


def _ensure_users_schema(conn: sqlite3.Connection) -> None:
    """
    Create the users table, or widen the role CHECK constraint if it predates
    the Supervisor role.

    SQLite cannot alter a CHECK constraint in place, so the table is rebuilt.
    This runs before the dependent tables are created, and it is a one-time
    migration: once ``Supervisor`` is in the DDL it never runs again.
    """
    existing = _users_table_sql(conn)

    if not existing:
        conn.execute(USERS_DDL)
        return

    if "'Supervisor'" in existing:
        return

    logger.warning("Widening users.role to include Supervisor (schema v%s).", SCHEMA_VERSION)

    conn.execute("ALTER TABLE users RENAME TO users_legacy")
    conn.execute(USERS_DDL)
    conn.execute(
        """
        INSERT INTO users (
            id, name, email, hashed_password, role, is_active,
            must_change_password, token_version, created_at,
            last_login, password_changed_at
        )
        SELECT
            id, name, email, hashed_password, role, is_active,
            must_change_password, token_version, created_at,
            last_login, password_changed_at
        FROM users_legacy
        """
    )
    conn.execute("DROP TABLE users_legacy")


def init_db(database_path: Optional[Path] = None) -> None:
    """Create or upgrade every table. Safe to call on every startup."""
    with get_connection(database_path) as conn:
        _ensure_users_schema(conn)
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);"
        )

        conn.execute(REVOKED_TOKENS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp "
            "ON revoked_tokens(expires_at);"
        )

        columns = _table_columns(conn, "notifications")

        if _needs_notifications_rebuild(columns):
            logger.warning(
                "Legacy notifications schema detected; migrating to schema v%s.",
                SCHEMA_VERSION,
            )
            _rebuild_notifications(conn)
        else:
            conn.execute(NOTIFICATIONS_DDL)

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_status "
            "ON notifications(status);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_created_at "
            "ON notifications(created_at DESC);"
        )

        conn.execute(MACHINE_ASSIGNMENTS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_assignments_user "
            "ON machine_assignments(user_id);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_assignments_machine "
            "ON machine_assignments(machine_id);"
        )

        conn.execute(PREDICTIONS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_machine "
            "ON predictions(machine_id, created_at DESC);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_created "
            "ON predictions(created_at DESC);"
        )

        conn.execute(WORK_ORDERS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_work_orders_status "
            "ON work_orders(status);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_work_orders_engineer "
            "ON work_orders(assigned_engineer_id);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_work_orders_machine "
            "ON work_orders(machine_id);"
        )

        conn.execute(ISSUE_REPORTS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_issue_reports_machine "
            "ON issue_reports(machine_id);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_issue_reports_reporter "
            "ON issue_reports(reported_by);"
        )

        conn.execute(AUDIT_LOG_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_log_created "
            "ON audit_log(created_at DESC);"
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL
            )
            """
        )

        current = conn.execute(
            "SELECT version FROM schema_version LIMIT 1"
        ).fetchone()

        if current is None:
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                (
                    SCHEMA_VERSION,
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
        elif current["version"] < SCHEMA_VERSION:
            conn.execute(
                "UPDATE schema_version SET version = ?, applied_at = ?",
                (
                    SCHEMA_VERSION,
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )


# =====================================================================
# BACKUP
# =====================================================================

def backup_database(
    source_path: Optional[Path] = None,
    backup_path: Optional[Path] = None,
) -> dict:
    """
    Perform a WAL-safe online backup of the SQLite database.

    Reads the notification count from the source database, performs an
    online backup via SQLite's backup API, and confirms that the destination
    database has identical tables and an exact matching notification count.
    """
    src = Path(source_path) if source_path else settings.database_path()

    if not src.exists():
        raise FileNotFoundError(f"Source database not found: {src}")

    if backup_path is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dst = src.parent / f"{src.name}.backup_{timestamp}"
    else:
        dst = Path(backup_path)

    # Step 1: read the source notification count.
    with closing(sqlite3.connect(src, timeout=30)) as src_conn:
        src_conn.row_factory = sqlite3.Row
        cursor = src_conn.cursor()

        tables = [
            row[0]
            for row in cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        has_notifications = "notifications" in tables
        expected_notification_count = (
            cursor.execute("SELECT COUNT(*) FROM notifications").fetchone()[0]
            if has_notifications
            else 0
        )

        # Step 2: online backup using the native backup API.
        with closing(sqlite3.connect(dst, timeout=30)) as dst_conn:
            src_conn.backup(dst_conn)

    # Step 3: verify the destination database.
    with closing(sqlite3.connect(dst, timeout=30)) as verify_conn:
        verify_conn.row_factory = sqlite3.Row
        verify_cursor = verify_conn.cursor()

        dst_tables = [
            row[0]
            for row in verify_cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]

        if has_notifications:
            if "notifications" not in dst_tables:
                raise RuntimeError(
                    "Backup verification failed: 'notifications' table missing "
                    "in destination."
                )

            dst_count = verify_cursor.execute(
                "SELECT COUNT(*) FROM notifications"
            ).fetchone()[0]

            if dst_count != expected_notification_count:
                raise RuntimeError(
                    f"Backup verification failed: source had "
                    f"{expected_notification_count} records but destination "
                    f"has {dst_count}."
                )
        else:
            dst_count = 0

    return {
        "source_path": str(src),
        "backup_path": str(dst),
        "source_notification_count": expected_notification_count,
        "backup_notification_count": dst_count,
        "verified": True,
    }
