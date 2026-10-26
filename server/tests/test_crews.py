"""Crews (team «Конец смены») and the crew race."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bureau_server import crews as crewlib
from bureau_server.crews import Crew

from conftest import fresh_db
from test_server import PASSWORD, client, content, new_session, teacher_headers  # noqa: F401  (fixtures)

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture()
def crew_content(content: Path) -> Path:  # noqa: F811
    (content / "crews").mkdir()
    shutil.copy(REPO / "content" / "crews" / "crew0.json", content / "crews" / "crew0.json")
    return content


@pytest.fixture()
def cc(tmp_path: Path, crew_content: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    from bureau_server.app import create_app
    monkeypatch.delenv("BUREAU_CHECKER_URL", raising=False)
    monkeypatch.setenv("BUREAU_LOCAL_CHECK", "1")
    app = create_app(fresh_db(tmp_path / "c.db"), content=crew_content, static_dir=tmp_path / "no-dist")
    app.state.store.set_password(PASSWORD)
    return TestClient(app)


def join(c: TestClient, code: str, nick: str) -> dict[str, str]:
    r = c.post("/api/join", json={"code": code, "nick": nick, "avatar": "a1"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


REF = {p["id"]: "\n".join(p["reference"]) + "\n"
       for p in json.loads((REPO / "content" / "crews" / "crew0.json").read_text(encoding="utf-8"))["parts"]}


# ------------------------------------------------------------------ pure functions
@pytest.mark.parametrize("n,sizes", [(1, [1]), (2, [2]), (3, [3]), (4, [2, 2]), (5, [3, 2]), (7, [3, 2, 2]), (9, [3, 3, 3])])
def test_split_sizes(n: int, sizes: list[int]) -> None:
    groups = crewlib.split(list(range(n)), 3)
    assert sorted(map(len, groups), reverse=True) == sizes
    assert sorted(x for g in groups for x in g) == list(range(n))


def test_assignment_gives_every_part_an_owner() -> None:
    parts = ["input", "calc", "report"]
    assert crewlib.assignment([7, 8], parts) == {"input": 7, "calc": 8, "report": 7}
    assert set(crewlib.assignment([1, 2, 3, 4], parts).values()) == {1, 2, 3}
    assert crewlib.assignment([], parts) == {}


def test_race_points_ties_and_start_bonus() -> None:
    students = {1: {"progress": {"orders": {"o1": {"stars": 5}}}, "grants": {}},
                2: {"progress": {"orders": {"o1": {"stars": 3}}}, "grants": {}},
                3: {"progress": {}, "grants": {"accepted": ["o1"]}},          # the teacher's acceptance counts as 3★
                4: {"progress": {"orders": {"o1": {"stars": 4}}}, "grants": {}}}
    a = Crew(1, 1, "Кедр", [1, 2], result={"stars": 5}, launched=200.0)
    b = Crew(2, 1, "Чайка", [3, 4], result={"stars": 4}, launched=100.0)
    c = Crew(3, 1, "Беркут", [], accepted=True)
    d = Crew(4, 1, "Сокол", [], result={"stars": 3})
    rows = {r["name"]: r for r in crewlib.race([a, b, c, d], students, ["o1"])}
    assert rows["Кедр"]["points"] == 4 + 25 + 6            # avg 4★ + 5★ × 5 + second start
    assert rows["Чайка"]["points"] == 4 + 20 + 10          # avg 3.5 → 4, first start
    assert rows["Беркут"]["team_stars"] == 3                # accepted by the teacher = 3★
    assert (rows["Кедр"]["rank"], rows["Чайка"]["rank"]) == (1, 2)
    assert rows["Беркут"]["rank"] == rows["Сокол"]["rank"] == 3     # a tie shares the place


# ------------------------------------------------------------------ API
def test_closing_stage_splits_class_into_crews(cc: TestClient) -> None:
    h = teacher_headers(cc)
    s = new_session(cc, h)
    students = [join(cc, s["code"], nick) for nick in ("Кедр", "Луна", "Орион", "Вега")]
    assert cc.get("/api/state", headers=students[0]).json()["crew"] is None
    r = cc.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "closing", "open": True}, headers=h).json()
    assert sorted(len(c["members"]) for c in r["crews"]) == [2, 2]
    me = cc.get("/api/state", headers=students[0]).json()
    assert me["crew"]["mission"] == "crew0" and len(me["race"]) == 2
    assert {p for m in me["crew"]["members"] for p in m["parts"]} == {"input", "calc", "report"}
    # a late student joins the smallest crew
    late = join(cc, s["code"], "Заря")
    assert len(cc.get("/api/state", headers=late).json()["crew"]["members"]) == 3


def test_crew_parts_chat_check_and_launch(cc: TestClient) -> None:
    h = teacher_headers(cc)
    s = new_session(cc, h)
    a, b = join(cc, s["code"], "Кедр"), join(cc, s["code"], "Чайка")
    assert cc.post("/api/crew/chat", json={"text": "привет"}, headers=a).status_code == 403   # stage closed
    cc.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "closing", "open": True}, headers=h)
    crew = cc.get("/api/state", headers=a).json()["crew"]
    owner = {p: m["id"] for m in crew["members"] for p in m["parts"]}
    me_a = cc.get("/api/state", headers=a).json()["me"]["id"]
    heads = {me_a: a, next(m["id"] for m in crew["members"] if m["id"] != me_a): b}
    other = next(x for x in heads if x != owner["calc"])
    assert cc.post("/api/crew/part", json={"part": "calc", "source": "x = 1\n"}, headers=heads[other]).status_code == 403
    for part, src in REF.items():
        assert cc.post("/api/crew/part", json={"part": part, "source": src}, headers=heads[owner[part]]).status_code == 200
    assert cc.post("/api/crew/chat", json={"text": "  назвал   turns  "}, headers=a).status_code == 200
    assert cc.post("/api/crew/chat", json={"text": "ещё"}, headers=a).status_code == 429     # flood guard
    res = cc.post("/api/crew/check", json={"hints": 0}, headers=b)
    assert res.status_code == 200, res.text
    assert res.json()["summary"]["stars"] == 5 and res.json()["error_part"] is None
    st = cc.get("/api/state", headers=a).json()
    assert st["crew"]["launched"] and st["crew"]["start_place"] == 1 and st["crew"]["chat"][0]["text"] == "назвал turns"
    assert st["race"][0]["parts"]["start"] == crewlib.START_BONUS[0] and st["race"][0]["team_stars"] == 5
    # the browser result endpoint is refused while the server checks
    assert cc.post("/api/crew/result", json={"stars": 5, "score": 100, "passed": 4, "total": 4}, headers=a).status_code == 409


def test_teacher_moves_and_accepts(cc: TestClient) -> None:
    h = teacher_headers(cc)
    s = new_session(cc, h)
    for nick in ("Кедр", "Луна", "Орион"):
        join(cc, s["code"], nick)
    view = cc.post(f"/api/teacher/sessions/{s['id']}/crews", json={"action": "auto", "size": 2}, headers=h).json()
    assert sorted(len(c["members"]) for c in view["crews"]) == [1, 2]
    lonely = next(c for c in view["crews"] if len(c["members"]) == 1)
    big = next(c for c in view["crews"] if len(c["members"]) == 2)
    view = cc.post(f"/api/teacher/sessions/{s['id']}/crews",
                   json={"action": "move", "student": lonely["members"][0]["id"], "crew": big["id"]}, headers=h).json()
    assert [len(c["members"]) for c in view["crews"]] == [3]      # the empty crew disappears
    view = cc.post(f"/api/teacher/sessions/{s['id']}/crews", json={"action": "accept", "crew": view["crews"][0]["id"]},
                   headers=h).json()
    assert view["crews"][0]["stars"] == 3 and view["crews"][0]["launched"]
    assert cc.post(f"/api/teacher/sessions/{s['id']}/crews", json={"action": "clear"}, headers=h).json()["crews"] == []


def test_student_cannot_manage_crews(cc: TestClient) -> None:
    h = teacher_headers(cc)
    s = new_session(cc, h)
    a = join(cc, s["code"], "Кедр")
    assert cc.post(f"/api/teacher/sessions/{s['id']}/crews", json={"action": "auto"}, headers=a).status_code == 401


def test_browser_result_without_checker(cc: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BUREAU_LOCAL_CHECK", raising=False)
    h = teacher_headers(cc)
    s = new_session(cc, h, mode="free")
    a = join(cc, s["code"], "Кедр")
    cc.post(f"/api/teacher/sessions/{s['id']}/crews", json={"action": "auto"}, headers=h)
    assert cc.post("/api/crew/check", json={}, headers=a).status_code == 503
    assert cc.post("/api/crew/result", json={"stars": 4, "score": 85, "passed": 4, "total": 4}, headers=a).status_code == 200
    crew = cc.get("/api/state", headers=a).json()["crew"]
    assert crew["stars"] == 4 and crew["launched"] and crew["result"]["verified"] is False


# ------------------------------------------------------------------ museum quiz of the crew
def test_race_counts_quiz_points() -> None:
    a = Crew(1, 1, "Кедр", [], quiz={"ps1": {"correct": True}, "korolev": {"correct": True}, "baikonur": {"correct": False}})
    row = crewlib.race([a], {}, [])[0]
    assert row["parts"]["quiz"] == 2 * crewlib.QUIZ_POINTS and row["points"] == 2 * crewlib.QUIZ_POINTS


def test_crew_museum_quiz_once_per_question(cc: TestClient, crew_content: Path) -> None:
    shutil.copy(REPO / "content" / "museum.json", crew_content / "museum.json")
    from bureau_server.app import create_app
    app = create_app(fresh_db(crew_content.parent / "q.db"), content=crew_content, static_dir=crew_content / "no-dist")
    app.state.store.set_password(PASSWORD)
    c = TestClient(app)
    h = teacher_headers(c)
    s = new_session(c, h)
    a, b = join(c, s["code"], "Кедр"), join(c, s["code"], "Чайка")
    item = json.loads((REPO / "content" / "crews" / "crew0.json").read_text(encoding="utf-8"))["quiz"][0]
    exhibit = next(ex for ex in json.loads((REPO / "content" / "museum.json").read_text(encoding="utf-8"))
                   if ex["id"] == item["exhibit"])
    right = exhibit["quiz"][item["question"]]["answer"]
    body = {"exhibit": item["exhibit"], "answer": right}
    assert c.post("/api/crew/quiz", json=body, headers=a).status_code == 403          # the closing is not open yet
    c.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "closing", "open": True}, headers=h)
    assert c.post("/api/crew/quiz", json={"exhibit": "mir", "answer": 0}, headers=a).status_code == 400  # not in this quiz
    r = c.post("/api/crew/quiz", json=body, headers=a)
    assert r.status_code == 200 and r.json() == {"correct": True, "answer": right}
    assert c.post("/api/crew/quiz", json={**body, "answer": (right + 1) % 3}, headers=b).status_code == 409  # one per crew
    st = c.get("/api/state", headers=b).json()
    assert st["crew"]["quiz"][item["exhibit"]]["correct"] is True
    assert st["race"][0]["parts"]["quiz"] == crewlib.QUIZ_POINTS
