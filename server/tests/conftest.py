import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os  # noqa: E402

TABLES = ("settings", "teacher_tokens", "sessions", "students", "audit", "crews", "code")


def fresh_db(path: Path) -> str | Path:
    """The test database: a fresh SQLite file, or PostgreSQL when BUREAU_TEST_DATABASE_URL is set (emptied first)."""
    url = os.environ.get("BUREAU_TEST_DATABASE_URL")
    if not url:
        return path
    import psycopg
    with psycopg.connect(url, autocommit=True) as conn:
        for t in TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
    return url
