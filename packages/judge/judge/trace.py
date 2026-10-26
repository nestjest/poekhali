"""Step-by-step tracer: line, variables (name/type/value, changed), stdout so far."""
from __future__ import annotations

import types
from typing import Any

from .sandbox import STUDENT_FILE, execute

MAX_TRACE_STEPS = 500
REPR_LIMIT = 80


def _short(value: Any) -> str:
    text = repr(value)
    return text if len(text) <= REPR_LIMIT else text[:REPR_LIMIT - 1] + "…"


def _vars(frame: Any) -> dict[str, tuple[str, str]]:
    out = {}
    for name, value in frame.f_locals.items():
        if name.startswith("__") or isinstance(value, (types.ModuleType, types.FunctionType,
                                                       types.BuiltinFunctionType, type)):
            continue
        out[name] = (type(value).__name__, _short(value))
    return out


def trace_code(source: str, stdin: list[str] | None = None) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    prev: dict[str, tuple[str, str]] = {}
    truncated = False

    def tracer(frame: Any, event: str, rt: Any) -> None:
        nonlocal prev, truncated
        if event != "line" or frame.f_code.co_filename != STUDENT_FILE:
            return
        if len(steps) >= MAX_TRACE_STEPS:
            truncated = True
            return
        # State *before* executing this line; the step shows what the line sees.
        now = _vars(frame)
        steps.append({
            "line": frame.f_lineno,
            "vars": [{"name": k, "type": t, "value": v, "changed": prev.get(k) != (t, v)}
                     for k, (t, v) in now.items()],
            "stdout": "".join(rt.out)[-2000:],
        })
        prev = now

    result = execute(source, stdin, tracer=tracer)
    final = {"line": None, "vars": [], "stdout": result.stdout}
    return {"steps": steps + [final], "error": result.error, "truncated": truncated}
