"""Check modes beyond «io» (topics 5.4.2–5.4.5). Interfaces only in the MVP."""
from __future__ import annotations

from typing import Any, Protocol


class CheckMode(Protocol):
    name: str

    def run(self, source: str, order: dict[str, Any]) -> dict[str, Any]: ...


class _Planned:
    def __init__(self, name: str, topic: str):
        self.name = name
        self.topic = topic

    def run(self, source: str, order: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError(f"Режим проверки «{self.name}» появится в теме {self.topic}")


MODES: dict[str, CheckMode] = {
    "func": _Planned("func", "5.4.3"),    # call student functions with arguments
    "class": _Planned("class", "5.4.5"),  # instantiate and probe classes
    "data": _Planned("data", "5.4.2"),    # inspect files / data structures
}
