"""
Create an administrator (or maintenance) account from the command line.

The automatic bootstrap only runs while the users table is empty. Once anyone
has registered, this is the supported way to add a privileged account:

    python -m backend.create_admin --email admin@example.com --name "Asha Rao"

The password is prompted for (and hidden) unless --password is supplied.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
import sys

from backend.auth_service import VALID_ROLES
from backend.database import get_connection, init_db
from backend.security import hash_password, validate_password_complexity


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a privileged SmartPredict account.",
    )
    parser.add_argument("--email", required=True, help="Account email address.")
    parser.add_argument(
        "--name",
        default="System Administrator",
        help="Display name (default: System Administrator).",
    )
    parser.add_argument(
        "--role",
        default="Admin",
        choices=sorted(VALID_ROLES),
        help="Role for the new account (default: Admin).",
    )
    parser.add_argument(
        "--password",
        help=(
            "Password. Omit to be prompted securely. Passing it on the command "
            "line leaves it in your shell history."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    email = args.email.strip().lower()
    name = args.name.strip()

    if "@" not in email or "." not in email:
        print("error: please provide a valid email address", file=sys.stderr)
        return 2

    password = args.password or getpass.getpass("Password: ")

    try:
        validate_password_complexity(password, is_admin=(args.role == "Admin"))
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    init_db()

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()

        if existing is not None:
            print(f"error: an account with {email} already exists", file=sys.stderr)
            return 1

        conn.execute(
            """
            INSERT INTO users (
                name, email, hashed_password, role, is_active,
                must_change_password, token_version, created_at,
                password_changed_at
            )
            VALUES (?, ?, ?, ?, 1, 1, 1, ?, ?)
            """,
            (name, email, hash_password(password, is_admin=(args.role == "Admin")), args.role, now, now),
        )

    print(f"Created {args.role} account {email}.")
    print("The account must change its password after the first sign-in.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
