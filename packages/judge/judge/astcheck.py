"""AST rules (require / forbid) and allowed-construct checks."""
from __future__ import annotations

import ast
from typing import Any

NODE_RU = {
    "For": "цикл for", "While": "цикл while", "If": "условие if", "Assign": "присваивание",
    "JoinedStr": "f-строка", "Import": "импорт", "ImportFrom": "импорт", "Break": "break",
    "Continue": "continue", "Compare": "сравнение", "BoolOp": "and / or",
}

# Nodes that are pure syntax glue and always allowed.
ALWAYS_ALLOWED = {
    "Module", "Expr", "Call", "Load", "Store", "Del", "keyword", "arguments", "FormattedValue",
    "Add", "Sub", "Mult", "Div", "FloorDiv", "Mod", "Pow", "USub", "UAdd",
    "Eq", "NotEq", "Lt", "LtE", "Gt", "GtE", "And", "Or", "Not", "comprehension",
}


def _called(node: ast.Call) -> str | None:
    fn = node.func
    if isinstance(fn, ast.Name):
        return fn.id
    if isinstance(fn, ast.Attribute):
        return "." + fn.attr
    return None


def count(tree: ast.AST, rule: str) -> int:
    """rule: 'For' | 'Call:int' | 'Call:.strip' | 'Name:x' | 'Str:text'."""
    kind, _, name = rule.partition(":")
    total = 0
    for node in ast.walk(tree):
        if kind == "Call" and isinstance(node, ast.Call):
            called = _called(node)
            total += called == name or (called is not None and called == "." + name)
        elif kind == "Name" and isinstance(node, ast.Name):
            total += node.id == name
        elif kind == "Str" and isinstance(node, ast.Constant) and isinstance(node.value, str):
            total += node.value.strip() == name.strip()
        elif not name and type(node).__name__ == kind:
            total += 1
    return total


def rule_name(rule: str) -> str:
    kind, _, name = rule.partition(":")
    if kind == "Call":
        return f"вызов {name.lstrip('.')}()"
    if kind == "Name":
        return f"имя {name}"
    if kind == "Str":
        return f"готовый текст «{name}»"
    return NODE_RU.get(kind, kind)


def check_rules(source: str, rules: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not rules:
        return []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return [{"rule": "parse", "ok": False, "text": "Код не разобран: есть синтаксическая ошибка."}]
    report = []
    for item in rules.get("require", []):
        rule, n = (item, 1) if isinstance(item, str) else (item["rule"], item.get("min", 1))
        got = count(tree, rule)
        ok = got >= n
        report.append({"rule": rule, "ok": ok,
                       "text": f"Нужен {rule_name(rule)}" + ("." if ok else " — пока не найден.")})
    for item in rules.get("forbid", []):
        rule, n = (item, 0) if isinstance(item, str) else (item["rule"], item.get("max", 0))
        got = count(tree, rule)
        ok = got <= n
        text = f"{rule_name(rule).capitalize()}: не больше {n}" + ("." if ok else f", а найдено {got}.")
        report.append({"rule": rule, "ok": ok, "text": text})
    return report


def constructs_used(source: str) -> set[str]:
    """Node type names + 'Call:<name>' for every call (methods as 'Call:.name')."""
    used: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        name = type(node).__name__
        if name in ALWAYS_ALLOWED or isinstance(node, (ast.operator, ast.cmpop, ast.boolop,
                                                       ast.unaryop, ast.expr_context)):
            continue
        used.add(name)
        if isinstance(node, ast.Call):
            called = _called(node)
            if called:
                used.add(f"Call:{called}")
    return used


def disallowed(source: str, allowed: set[str]) -> set[str]:
    return {c for c in constructs_used(source) if c not in allowed}
