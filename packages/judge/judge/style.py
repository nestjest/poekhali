"""Lightweight PEP 8 checks (subset of pycodestyle codes), messages in Russian.

Decision: pure-stdlib subset instead of the pycodestyle wheel for the MVP;
warnings never block acceptance, they only cost style points.
"""
from __future__ import annotations

import io
import tokenize
from typing import Any

MAX_LINE = 79
SPACED_OPS = {"=", "==", "!=", "<", ">", "<=", ">=", "+=", "-=", "*=", "/="}


def check_style(source: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def add(code: str, line: int, text: str) -> None:
        out.append({"code": code, "line": line, "text": text})

    for i, raw in enumerate(source.split("\n"), start=1):
        if len(raw) > MAX_LINE:
            add("E501", i, f"Строка длиннее {MAX_LINE} символов.")
        if raw.rstrip() != raw and raw.strip():
            add("W291", i, "Лишние пробелы в конце строки.")
        indent = len(raw) - len(raw.lstrip(" "))
        if raw.strip() and indent % 4:
            add("E111", i, "Отступ должен быть кратен 4 пробелам.")
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return out
    depth = 0
    for k, tok in enumerate(tokens):
        if tok.type != tokenize.OP:
            continue
        if tok.string in "([{":
            depth += 1
        elif tok.string in ")]}":
            depth -= 1
        prev = tokens[k - 1] if k else None
        nxt = tokens[k + 1] if k + 1 < len(tokens) else None
        if tok.string == ",":
            if nxt and nxt.start == tok.end and nxt.string not in ")]}" and nxt.type != tokenize.NEWLINE:
                add("E231", tok.start[0], "После запятой нужен пробел.")
        elif tok.string in SPACED_OPS and not (tok.string == "=" and depth > 0):
            if (prev and prev.end == tok.start) or (nxt and nxt.start == tok.end):
                add("E225", tok.start[0], f"Вокруг «{tok.string}» нужны пробелы.")
    return out


def style_points(warnings: list[dict[str, Any]]) -> int:
    return max(0, 10 - 2 * len(warnings))
