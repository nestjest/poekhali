"""Order score (0–100), stars (1–5), tips and acceptance."""
from __future__ import annotations

from typing import Any

WEIGHTS = {"visible": 40, "hidden": 30, "style": 10, "independence": 10, "accuracy": 10}
STAR_THRESHOLDS = [(95, 5), (80, 4), (60, 3), (40, 2)]
TIPS = {3: 10, 4: 15, 5: 25}
ACCEPT_STARS = 3
HINT_POINTS = [10, 7, 4, 0]


def stars_for(score: float) -> int:
    for threshold, stars in STAR_THRESHOLDS:
        if score >= threshold:
            return stars
    return 1


def clarify_accuracy(clarify: dict[str, Any] | None, chosen: list[int] | None) -> int:
    """10 points if every relevant question was asked and no irrelevant ones."""
    if not clarify:
        return WEIGHTS["accuracy"]
    options = clarify.get("options", [])
    picked = set(chosen or [])
    relevant = {i for i, o in enumerate(options) if o.get("relevant")}
    if picked - relevant:
        return 0
    if not relevant:
        return WEIGHTS["accuracy"]
    return round(WEIGHTS["accuracy"] * len(picked & relevant) / len(relevant))


def tips_due(old_stars: int, new_stars: int) -> int:
    """Tips are paid once per star level; a better resubmission pays the difference."""
    return sum(TIPS.get(s, 0) for s in range(old_stars + 1, new_stars + 1))


def score(cases: list[dict[str, Any]], style_points: int, hints_used: int,
          accuracy: int) -> dict[str, Any]:
    def share(items: list[dict[str, Any]]) -> float:
        total = sum(c["weight"] for c in items)
        return sum(c["weight"] for c in items if c["passed"]) / total if total else 1.0

    visible = [c for c in cases if not c["hidden"]]
    hidden = [c for c in cases if c["hidden"]]
    parts = {
        "visible": round(WEIGHTS["visible"] * share(visible), 1),
        "hidden": round(WEIGHTS["hidden"] * (share(hidden) if hidden else share(visible)), 1),
        "style": style_points,
        "independence": HINT_POINTS[min(hints_used, 3)],
        "accuracy": accuracy,
    }
    # Style/independence/accuracy only count once the program does something right.
    if not any(c["passed"] for c in cases):
        parts["style"] = parts["independence"] = parts["accuracy"] = 0
    total = round(sum(parts.values()), 1)
    stars = stars_for(total)
    return {"parts": parts, "score": total, "stars": stars, "accepted": stars >= ACCEPT_STARS}
