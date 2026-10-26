"""Vercel entry: the lesson server (FastAPI) as a serverless function; vercel.json routes /api/* here.

Vercel has no persistent disk and no WebSockets: the database is PostgreSQL from DATABASE_URL (Neon / Vercel
Postgres), the game and the teacher console fall back to polling. The game itself is served by Vercel as static
files (frontend/dist). Code of students is checked in their browsers (no `checker` service here).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
sys.path.insert(0, str(ROOT / "packages" / "judge"))

from bureau_server.app import create_app  # noqa: E402

DB = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or ""
if not DB:
    raise RuntimeError("Нет DATABASE_URL: подключите базу PostgreSQL (Vercel → Storage → Neon) к проекту.")
host = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")
if host:
    os.environ.setdefault("BUREAU_PUBLIC_URL", f"https://{host}")

app = create_app(DB, content=ROOT / "content", static_dir=ROOT / "no-static")
password = os.environ.get("BUREAU_TEACHER_PASSWORD")
if password:
    app.state.store.ensure_password(password)
