"""Bug detectors (AST heuristics). Each returns {tag, line, text}; text never contains a fix."""
from __future__ import annotations

import ast
from typing import Any


def _input_vars(tree: ast.AST) -> dict[str, int]:
    """Variables assigned directly from input() (not wrapped in int/float)."""
    found: dict[str, int] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            fn = node.value.func
            raw = isinstance(fn, ast.Name) and fn.id == "input"
            if raw:
                for t in node.targets:
                    if isinstance(t, ast.Name):
                        found[t.id] = node.lineno
    return found


def input_without_int(tree: ast.AST) -> list[dict[str, Any]]:
    raw = _input_vars(tree)
    hits = []
    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Sub, ast.Mult, ast.Div, ast.Add)):
            names = [n for n in (node.left, node.right) if isinstance(n, ast.Name) and n.id in raw]
            nums = [n for n in (node.left, node.right)
                    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float))]
            if names and (nums or not isinstance(node.op, ast.Add)):
                hits.append({"tag": "input_without_int", "line": node.lineno,
                             "text": f"«{names[0].id}» пришло из input() — это текст, а здесь с ним считают."})
    return hits


def hardcoded_output(tree: ast.AST, expected: list[str]) -> list[dict[str, Any]]:
    hits = []
    want = {e.strip() for e in expected if e.strip()}
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
            if node.args and all(isinstance(a, ast.Constant) for a in node.args):
                text = " ".join(str(a.value) for a in node.args)  # type: ignore[attr-defined]
                if text.strip() in want:
                    hits.append({"tag": "hardcoded_output", "line": node.lineno,
                                 "text": "Ответ напечатан готовым текстом. Программа должна считать его сама."})
    return hits


def off_by_one_range(tree: ast.AST) -> list[dict[str, Any]]:
    hits = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "range":
            if len(node.args) == 2 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 1 \
                    and isinstance(node.args[1], ast.Name):
                hits.append({"tag": "off_by_one_range", "line": node.lineno,
                             "text": "range(1, n) останавливается на n−1. Дойдёт ли цикл до последнего?"})
    return hits


def detect(source: str, expected_outputs: list[str] | None = None) -> list[dict[str, Any]]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    return (input_without_int(tree) + hardcoded_output(tree, expected_outputs or [])
            + off_by_one_range(tree))
