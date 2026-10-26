"""Crew missions: parts joined in order, templates for unwritten parts, errors mapped to the part."""
from __future__ import annotations

from judge import crew_ranges, crew_source, run_crew, to_json

MISSION = {
    "id": "crew-t", "lesson": 0,
    "parts": [
        {"id": "input", "template": ["name = ___"], "reference": ["name = input()"]},
        {"id": "calc", "template": ["size = ___"], "reference": ["size = len(name)"]},
        {"id": "report", "template": ["print(___)"], "reference": ["print(name, size)"]},
    ],
    "requirements": [{"id": "r1", "text": "Имя и длина"}],
    "cases": [
        {"id": "1", "stdin": ["Кедр"], "expected_stdout": ["Кедр 4"], "requirement_id": "r1"},
        {"id": "h1", "hidden": True, "stdin": ["Чайка"], "expected_stdout": ["Чайка 5"], "requirement_id": "r1",
         "complaint": "Длина не та."},
    ],
}
REF = {"input": "name = input()\n", "calc": "size = len(name)\n", "report": "print(name, size)\n"}


def test_parts_are_joined_in_mission_order() -> None:
    assert crew_source(MISSION, {"report": REF["report"], "input": REF["input"], "calc": REF["calc"]}) == \
        "name = input()\nsize = len(name)\nprint(name, size)\n"


def test_unwritten_part_is_its_template() -> None:
    assert "size = ___" in crew_source(MISSION, {"input": REF["input"]})


def test_reference_passes_and_hidden_cases_stay_hidden() -> None:
    res = run_crew(MISSION, REF)
    assert res["summary"]["stars"] == 5 and res["error_part"] is None
    hidden = next(c for c in res["cases"] if c["hidden"])
    assert "stdin" not in hidden and "expected" not in hidden


def test_error_is_mapped_to_the_part() -> None:
    res = run_crew(MISSION, {**REF, "calc": "size = len(nam)\n"})
    assert res["error_part"] == "calc"
    assert [r["id"] for r in res["parts"]] == ["input", "calc", "report"]


def test_empty_part_takes_no_lines() -> None:
    ranges = crew_ranges(MISSION, {**REF, "calc": "   \n"})
    assert ranges[1]["last"] < ranges[1]["first"] and ranges[2]["first"] == 2


def test_deterministic() -> None:
    assert to_json(run_crew(MISSION, REF)) == to_json(run_crew(MISSION, REF))
