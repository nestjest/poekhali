"""Crews for the team «Конец смены» and the crew race (pure functions: no database, no network).

A crew of 2–3 students assembles one program from parts (input → calculation → report). Crews compete in the
«Гонка экипажей»: the average stars of the members for the lesson's missions + the crew program + a start bonus
for the first launched crews + the museum quiz (questions about exhibits of «Музей бюро», one answer per crew).
Only crews are ranked, never individual students.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

CREW_NAMES = ["Кедр", "Чайка", "Беркут", "Сокол", "Ястреб", "Алмаз", "Рубин", "Восток", "Заря", "Вега", "Орион",
              "Сириус", "Альтаир", "Полярная", "Комета", "Метеор"]
TEAM_POINTS_PER_STAR = 5
START_BONUS = (10, 6, 3)
QUIZ_POINTS = 2          # per correct answer of the crew's museum quiz
CHAT_KEEP = 40
CHAT_MAX = 140


@dataclass
class Crew:
    id: int
    session_id: int
    name: str
    members: list[int]
    parts: dict[str, dict[str, Any]] = field(default_factory=dict)   # part id → {source, by, at}
    result: dict[str, Any] | None = None                             # best: {stars, score, passed, total, at, verified}
    launched: float | None = None
    chat: list[dict[str, Any]] = field(default_factory=list)
    accepted: bool = False                                           # the teacher accepted the crew program (= 3★)
    checks: int = 0
    quiz: dict[str, dict[str, Any]] = field(default_factory=dict)    # exhibit id → {answer, correct, by, at}


def split(student_ids: list[int], size: int = 3) -> list[list[int]]:
    """Round robin into ceil(n / size) crews: sizes differ by at most one (n=4 → 2+2, n=7 → 3+2+2)."""
    if not student_ids:
        return []
    k = math.ceil(len(student_ids) / max(2, size))
    crews: list[list[int]] = [[] for _ in range(k)]
    for i, sid in enumerate(student_ids):
        crews[i % k].append(sid)
    return crews


def free_names(taken: set[str], n: int) -> list[str]:
    names = [x for x in CREW_NAMES if x not in taken]
    i = 2
    while len(names) < n:   # more crews than call signs: «Кедр-2», …
        names += [f"{x}-{i}" for x in CREW_NAMES if f"{x}-{i}" not in taken]
        i += 1
    return names[:n]


def assignment(members: list[int], part_ids: list[str]) -> dict[str, int]:
    """Who writes which part: part i → member i mod n (a crew of 2 gives its first member two parts)."""
    if not members:
        return {}
    return {pid: members[i % len(members)] for i, pid in enumerate(part_ids)}


def crew_stars(crew: Crew) -> int:
    best = int((crew.result or {}).get("stars", 0))
    return max(best, 3) if crew.accepted else best


def start_places(crews: list[Crew]) -> dict[int, int]:
    """1-based order in which crews launched."""
    done = sorted((c for c in crews if c.launched is not None), key=lambda c: (c.launched, c.id))
    return {c.id: i + 1 for i, c in enumerate(done)}


def effective_stars(progress: dict[str, Any], grants: dict[str, Any], order_file: str) -> int:
    """The same rule as frontend/src/lib/gate.ts effectiveStars: browser, server check, teacher acceptance = 3★."""
    own = int(((progress.get("orders") or {}).get(order_file) or {}).get("stars", 0))
    checked = int((grants.get("checked") or {}).get(order_file, 0))
    return max(own, checked, 3 if order_file in (grants.get("accepted") or []) else 0)


def race(crews: list[Crew], students: dict[int, dict[str, Any]], order_files: list[str]) -> list[dict[str, Any]]:
    """Standings of the «Гонка экипажей». `students`: id → {progress, grants}. Ties share a place."""
    places = start_places(crews)
    rows = []
    for c in crews:
        members = [students[m] for m in c.members if m in students]
        per_member = [sum(effective_stars(s.get("progress") or {}, s.get("grants") or {}, f) for f in order_files)
                      for s in members]
        avg = sum(per_member) / len(per_member) if per_member else 0.0
        team = crew_stars(c)
        place = places.get(c.id)
        bonus = START_BONUS[place - 1] if place and place <= len(START_BONUS) else 0
        missions = math.floor(avg + 0.5)       # 3.5 → 4 (not banker's rounding)
        quiz = quiz_points(c)
        rows.append({"id": c.id, "name": c.name, "size": len(members), "stars_avg": round(avg, 1), "team_stars": team,
                     "start_place": place, "points": missions + team * TEAM_POINTS_PER_STAR + bonus + quiz,
                     "parts": {"missions": missions, "team": team * TEAM_POINTS_PER_STAR, "start": bonus,
                               "quiz": quiz}})
    rows.sort(key=lambda r: (-r["points"], r["start_place"] or 999, r["name"]))
    rank = 0
    for i, r in enumerate(rows):
        if i == 0 or r["points"] != rows[i - 1]["points"]:
            rank = i + 1
        r["rank"] = rank
    return rows


def quiz_points(crew: Crew) -> int:
    return QUIZ_POINTS * sum(1 for a in crew.quiz.values() if a.get("correct"))


def quiz_question(mission: dict[str, Any], museum: dict[str, dict[str, Any]], exhibit: str) -> dict[str, Any] | None:
    """The quiz question of the crew mission about `exhibit` (from content/museum.json), or None."""
    item = next((x for x in mission.get("quiz", []) if x.get("exhibit") == exhibit), None)
    quiz = (museum.get(exhibit) or {}).get("quiz", [])
    if item is None or not 0 <= int(item.get("question", 0)) < len(quiz):
        return None
    return quiz[int(item.get("question", 0))]


def clean_chat(text: str) -> str:
    return " ".join(text.split())[:CHAT_MAX]
