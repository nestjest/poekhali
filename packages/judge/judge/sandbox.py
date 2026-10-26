"""Deterministic execution of student code with scripted stdin.

Infinite loops are stopped by a line budget (sys.settrace), so the result is the
same in CPython and Pyodide regardless of machine speed. Wall-clock timeouts are
an extra safety net of the host (Web Worker terminate / checker process limit).
"""
from __future__ import annotations

import builtins
import sys
import traceback
from dataclasses import dataclass, field
from typing import Any

STUDENT_FILE = "<student>"
MAX_STEPS = 200_000
MAX_OUTPUT_CHARS = 20_000
ALLOWED_IMPORTS = {"math"}
REMOVED_BUILTINS = ("open", "exit", "quit", "help", "breakpoint", "input", "print",
                    "exec", "eval", "compile", "globals", "locals", "vars", "memoryview",
                    "__import__")


class StepLimit(BaseException):
    """Line budget exhausted: most likely an infinite loop."""


class OutputLimit(BaseException):
    """Too much output."""


@dataclass
class Execution:
    stdout: str = ""
    error: dict[str, Any] | None = None
    steps: int = 0
    inputs_used: int = 0
    prompts: list[str] = field(default_factory=list)


def _safe_import(name: str, globals_: Any = None, locals_: Any = None,
                 fromlist: Any = (), level: int = 0) -> Any:
    if name not in ALLOWED_IMPORTS:
        raise ImportError(f"Модуль {name!r} здесь недоступен")
    return __import__(name, globals_, locals_, fromlist, level)


def _error_line(exc: BaseException) -> int | None:
    line = None
    for frame, lineno in traceback.walk_tb(exc.__traceback__):
        if frame.f_code.co_filename == STUDENT_FILE:
            line = lineno
    return line


def describe_error(exc: BaseException) -> dict[str, Any]:
    if isinstance(exc, StepLimit):
        return {"type": "Timeout", "message": "Программа выполняется слишком долго",
                "line": _error_line(exc), "col": None}
    if isinstance(exc, OutputLimit):
        return {"type": "OutputLimit", "message": "Слишком много вывода",
                "line": _error_line(exc), "col": None}
    if isinstance(exc, SyntaxError):
        return {"type": type(exc).__name__, "message": exc.msg, "line": exc.lineno,
                "col": exc.offset, "text": (exc.text or "").rstrip()}
    return {"type": type(exc).__name__, "message": str(exc), "line": _error_line(exc),
            "col": None}


class Runtime:
    """print/input replacements bound to one execution."""

    def __init__(self, stdin: list[str]):
        self.queue = list(stdin)
        self.out: list[str] = []
        self.size = 0
        self.result = Execution()

    def print(self, *args: Any, sep: str | None = " ", end: str | None = "\n",
              **_: Any) -> None:
        text = (" " if sep is None else sep).join(str(a) for a in args) + \
            ("\n" if end is None else end)
        self.size += len(text)
        if self.size > MAX_OUTPUT_CHARS:
            raise OutputLimit()
        self.out.append(text)

    def input(self, prompt: Any = "") -> str:
        self.result.prompts.append(str(prompt))
        if not self.queue:
            raise EOFError("Ввод закончился")
        self.result.inputs_used += 1
        return self.queue.pop(0)


def build_namespace(rt: Runtime) -> dict[str, Any]:
    safe = {k: v for k, v in vars(builtins).items() if k not in REMOVED_BUILTINS}
    safe["print"] = rt.print
    safe["input"] = rt.input
    safe["__import__"] = _safe_import
    return {"__builtins__": safe, "__name__": "__main__"}


def execute(source: str, stdin: list[str] | None = None, max_steps: int = MAX_STEPS,
            tracer: Any = None) -> Execution:
    """Runs source; prompts of input() are not part of stdout (decision #4)."""
    rt = Runtime(stdin or [])
    steps = 0

    def budget(frame: Any, event: str, arg: Any) -> Any:
        nonlocal steps
        if frame.f_code.co_filename != STUDENT_FILE:
            return None
        if event == "line":
            steps += 1
            if steps > max_steps:
                raise StepLimit()
        if tracer is not None:
            tracer(frame, event, rt)
        return budget

    old = sys.gettrace()
    try:
        code = compile(source, STUDENT_FILE, "exec", dont_inherit=True)
        sys.settrace(budget)
        try:
            exec(code, build_namespace(rt))
        finally:
            sys.settrace(old)
    except (Exception, StepLimit, OutputLimit) as exc:  # noqa: BLE001 - errors are data
        rt.result.error = describe_error(exc)
    rt.result.stdout = "".join(rt.out)
    rt.result.steps = steps
    return rt.result
