"""Lesson server for the course «Поехали!» (teacher console, stage gating, live class panel)."""
from __future__ import annotations

from typing import Any

__all__ = ["create_app"]


def __getattr__(name: str) -> Any:
    # Lazy: `python -m bureau_server.checker` must not import the app (and the checker) before running it.
    if name == "create_app":
        from .app import create_app
        return create_app
    raise AttributeError(name)
