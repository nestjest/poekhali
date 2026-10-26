"""Crew missions (team «Конец смены»): one program assembled from the parts written by the crew members.

Each member writes their own part (input → calculation → report); the parts are joined in the mission's order
and the joined program is judged like an ordinary mission. Line numbers of errors are mapped back to the part.
"""
from __future__ import annotations

from typing import Any

from .order import code_text, run_order


def crew_parts(mission: dict[str, Any], sources: dict[str, str] | None = None) -> list[tuple[str, str]]:
    """(part id, source) in the mission's order; a part nobody has written yet is its template."""
    sources = sources or {}
    out = []
    for part in mission.get("parts", []):
        src = sources.get(part["id"])
        if src is None:
            src = code_text(part.get("template", ""))
        src = src.rstrip("\n")
        out.append((part["id"], src + "\n" if src.strip() else ""))
    return out


def crew_source(mission: dict[str, Any], sources: dict[str, str] | None = None) -> str:
    return "".join(src for _, src in crew_parts(mission, sources))


def crew_ranges(mission: dict[str, Any], sources: dict[str, str] | None = None) -> list[dict[str, Any]]:
    """Line ranges of every part in the joined program: {id, first, last} (1-based, empty part → last < first)."""
    ranges, line = [], 1
    for pid, src in crew_parts(mission, sources):
        n = src.count("\n")
        ranges.append({"id": pid, "first": line, "last": line + n - 1})
        line += n
    return ranges


def crew_order(mission: dict[str, Any]) -> dict[str, Any]:
    """The mission as an ordinary order for run_order (no clarification step: accuracy is full)."""
    return {"id": mission.get("id"), "lesson": mission.get("lesson"), "mode": "io",
            "requirements": mission.get("requirements", []), "cases": mission.get("cases", []),
            "ast_rules": mission.get("ast_rules")}


def part_of_line(ranges: list[dict[str, Any]], line: int | None) -> str | None:
    if line is None:
        return None
    return next((r["id"] for r in ranges if r["first"] <= line <= r["last"]), None)


def run_crew(mission: dict[str, Any], sources: dict[str, str] | None = None, include_hidden: bool = True,
             hints_used: int = 0) -> dict[str, Any]:
    """Judge the crew's joined program; adds `parts` (line ranges) and `error_part` (whose part failed)."""
    source = crew_source(mission, sources)
    result = run_order(source, crew_order(mission), include_hidden, hints_used, None)
    ranges = crew_ranges(mission, sources)
    lines = [c["error"]["line"] for c in result["cases"] if c.get("error")]
    first_error = result["error"]["line"] if result.get("error") else (lines[0] if lines else None)
    result["parts"] = ranges
    result["error_part"] = part_of_line(ranges, first_error)
    return result
