"""Beget entry: the lesson server (FastAPI) behind Passenger, which speaks WSGI only.

install.sh copies this file next to public_html and fills in @REPO@ and @DATA@. No WebSockets here: the game and
the teacher console fall back to polling /api/state. Static files of the game are served from public_html.
Settings: @DATA@/env (KEY=value lines, not in the repository) — DATABASE_URL for PostgreSQL, otherwise SQLite
in @DATA@/bureau.db; BUREAU_PUBLIC_URL — the address shown to students.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path("@REPO@")
DATA = Path("@DATA@")
sys.path.insert(0, str(REPO / ".pydeps"))       # packages: install.sh (pip --target, no venv on the hosting)
sys.path.insert(0, str(REPO / "server"))
sys.path.insert(0, str(REPO / "packages" / "judge"))

env = DATA / "env"
if env.exists():
    for line in env.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not line.lstrip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip('"'))

from a2wsgi import ASGIMiddleware  # noqa: E402

from bureau_server.app import create_app  # noqa: E402

asgi = create_app(os.environ.get("DATABASE_URL") or str(DATA / "bureau.db"), content=REPO / "content")
password = os.environ.get("BUREAU_TEACHER_PASSWORD")
if password:
    asgi.state.store.ensure_password(password)
application = ASGIMiddleware(asgi)
