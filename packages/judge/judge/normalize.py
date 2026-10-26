"""Output normalization and comparison."""
from __future__ import annotations

from typing import Any


def lines(text: str) -> list[str]:
    """Trailing spaces of each line and trailing empty lines are ignored."""
    out = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    while out and out[-1] == "":
        out.pop()
    return out


def _num(token: str) -> float | None:
    try:
        return float(token.replace(",", "."))
    except ValueError:
        return None


def same_line(expected: str, actual: str, tolerance: float | None) -> bool:
    if expected == actual:
        return True
    if tolerance is None:
        return False
    exp, act = expected.split(), actual.split()
    if len(exp) != len(act):
        return False
    for e, a in zip(exp, act):
        if e == a:
            continue
        ne, na = _num(e), _num(a)
        if ne is None or na is None or abs(ne - na) > tolerance:
            return False
    return True


def compare(expected: str, actual: str, tolerance: float | None = None) -> tuple[bool, dict[str, Any] | None]:
    exp, act = lines(expected), lines(actual)
    for i in range(max(len(exp), len(act))):
        e = exp[i] if i < len(exp) else None
        a = act[i] if i < len(act) else None
        if e is None or a is None or not same_line(e, a, tolerance):
            return False, {"line": i + 1, "expected": e, "actual": a}
    return True, None
