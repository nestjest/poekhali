from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bureau_server.app import create_app
from conftest import fresh_db
from bureau_server.codes import make_code, normalize_code
from bureau_server.store import hash_password, verify_password

PASSWORD = "kedr-1961-vostok"


@pytest.fixture()
def content(tmp_path: Path) -> Path:
    (tmp_path / "lessons").mkdir()
    (tmp_path / "orders").mkdir()
    lesson = {"number": 0, "title": "Первый день в бюро", "stages": [
        {"id": "intro", "title": "Первый день"}, {"id": "konspekt", "title": "Инструктаж"},
        {"id": "orders", "title": "Задания", "orders": ["o0-1", "o0-boss"]},
        {"id": "closing", "title": "Конец смены"}]}
    (tmp_path / "lessons" / "lesson0.json").write_text(json.dumps(lesson, ensure_ascii=False), encoding="utf-8")
    cases = [{"id": "c1", "stdin": [], "expected_stdout": ["Искорка"], "requirement_id": "r1"},
             {"id": "h1", "stdin": [], "expected_stdout": ["Искорка"], "hidden": True, "requirement_id": "r1",
              "complaint": "Позывной не прозвучал."}]
    for oid, title in (("o0-1", "Позывной"), ("o0-boss", "Паспорт аппарата")):
        (tmp_path / "orders" / f"{oid}.json").write_text(
            json.dumps({"id": oid, "title": title, "kind": "regular", "cases": cases,
                        "requirements": [{"id": "r1", "text": "Вывести позывной"}]}, ensure_ascii=False),
            encoding="utf-8")
    return tmp_path


@pytest.fixture()
def client(tmp_path: Path, content: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.delenv("BUREAU_CHECKER_URL", raising=False)
    monkeypatch.setenv("BUREAU_LOCAL_CHECK", "1")       # isolated local checker for the tests
    app = create_app(fresh_db(tmp_path / "t.db"), content=content, static_dir=tmp_path / "no-dist")
    app.state.store.set_password(PASSWORD)
    return TestClient(app)


def teacher_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/api/teacher/login", json={"password": PASSWORD}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def new_session(client: TestClient, h: dict[str, str], mode: str = "sync") -> dict:
    r = client.post("/api/teacher/sessions", json={"lesson": 0, "mode": mode, "group": "ИСП-21"}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["session"]


# ------------------------------------------------------------------ codes
@pytest.mark.parametrize("typed", ["КЕДР-42", "кедр 42", " Кедр–42 ", "KEDR-42", "kedr42", "rtlh 42", "КEДР-42"])
def test_dirty_code_input_normalizes(typed: str) -> None:
    assert normalize_code(typed) == "КЕДР42"


def test_yo_and_lookalikes() -> None:
    assert normalize_code("звёзда-10") == normalize_code("ЗВЕЗДА 10") == "ЗВЕЗДА10"
    assert normalize_code("COЮЗ-15") == "СОЮЗ15"   # Latin C and O


def test_make_code_avoids_taken() -> None:
    taken = {normalize_code(make_code(set())) for _ in range(50)}
    assert normalize_code(make_code(taken)) not in taken


def test_password_hash_roundtrip() -> None:
    stored = hash_password("секрет-123")
    assert verify_password("секрет-123", stored) and not verify_password("секрет-124", stored)


# ------------------------------------------------------------------ teacher
def test_teacher_endpoints_need_login(client: TestClient) -> None:
    assert client.get("/api/teacher/sessions").status_code == 401
    assert client.post("/api/teacher/login", json={"password": "wrong"}).status_code == 401
    assert client.get("/api/teacher/sessions", headers=teacher_headers(client)).status_code == 200


def test_login_rate_limit(client: TestClient) -> None:
    for _ in range(10):
        client.post("/api/teacher/login", json={"password": "wrong"})
    assert client.post("/api/teacher/login", json={"password": PASSWORD}).status_code == 429


def test_lessons_catalog(client: TestClient) -> None:
    lessons = client.get("/api/teacher/lessons", headers=teacher_headers(client)).json()
    assert [s["id"] for s in lessons[0]["stages"]] == ["intro", "konspekt", "orders", "closing"]
    assert [o["title"] for o in lessons[0]["orders"]] == ["Позывной", "Паспорт аппарата"]


def test_session_starts_closed_and_opening_is_cumulative(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    assert s["open_stages"] == [] and s["mode"] == "sync"
    r = client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "orders", "open": True}, headers=h)
    assert r.json()["session"]["open_stages"] == ["intro", "konspekt", "orders"]
    r = client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "konspekt", "open": False}, headers=h)
    assert r.json()["session"]["open_stages"] == ["intro"]
    bad = client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "nope", "open": True}, headers=h)
    assert bad.status_code == 400


# ------------------------------------------------------------------ students
def test_join_with_dirty_code_and_same_nick_continues(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    typed = s["code"].lower().replace("-", " ")
    a = client.post("/api/join", json={"code": typed, "nick": "  Звёздный   Лис ", "avatar": "a2"})
    assert a.status_code == 200, a.text
    b = client.post("/api/join", json={"code": s["code"], "nick": "звездный лис", "avatar": "a3"})
    assert a.json()["me"]["id"] == b.json()["me"]["id"]
    assert a.json()["me"]["nick"] == "Звёздный Лис"
    # the old token is replaced
    assert client.get("/api/state", headers={"Authorization": f"Bearer {a.json()['token']}"}).status_code == 401
    assert client.post("/api/join", json={"code": "ЛУНА-00", "nick": "x"}).status_code == 404


def test_student_cannot_use_teacher_api(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    tok = client.post("/api/join", json={"code": s["code"], "nick": "Лис"}).json()["token"]
    sh = {"Authorization": f"Bearer {tok}"}
    assert client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "intro", "open": True},
                       headers=sh).status_code == 401
    assert client.get("/api/state", headers=h).status_code == 401  # teacher token is not a student


def test_progress_help_accept_and_class_view(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    j = client.post("/api/join", json={"code": s["code"], "nick": "Лис"}).json()
    sh = {"Authorization": f"Bearer {j['token']}"}
    prog = {"stage": "orders", "where": "order", "order": "o0-1", "waiting": False,
            "done_stages": ["intro", "konspekt"], "orders": {"o0-1": {"stars": 2, "attempts": 4, "hints": 1}},
            "checks": {"correct": 7, "total": 9}, "errors": {"input_without_int": 2}}
    assert client.post("/api/progress", json=prog, headers=sh).status_code == 200
    assert client.post("/api/help", json={"on": True}, headers=sh).json()["me"]["help"] is True
    view = client.get(f"/api/teacher/sessions/{s['id']}", headers=h).json()
    st = view["students"][0]
    assert st["progress"]["orders"]["o0-1"]["attempts"] == 4 and st["help"] is not None and st["online"]
    r = client.post(f"/api/teacher/sessions/{s['id']}/students/{st['id']}/accept", json={"order": "o0-1"}, headers=h)
    assert r.json()["students"][0]["grants"]["accepted"] == ["o0-1"]
    client.post(f"/api/teacher/sessions/{s['id']}/students/{st['id']}/help", headers=h)
    assert client.get("/api/state", headers=sh).json()["me"]["help"] is False
    log = client.get(f"/api/teacher/sessions/{s['id']}/log", headers=h).json()
    assert [e["action"] for e in log][:3] == ["create", "join", "help"]


def test_progress_validation(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    tok = client.post("/api/join", json={"code": s["code"], "nick": "Лис"}).json()["token"]
    bad = {"orders": {"o0-1": {"stars": 9}}}
    assert client.post("/api/progress", json=bad, headers={"Authorization": f"Bearer {tok}"}).status_code == 422


def test_websocket_pushes_stage_and_attention(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    tok = client.post("/api/join", json={"code": s["code"], "nick": "Лис"}).json()["token"]
    with client.websocket_connect(f"/ws?token={tok}") as ws:
        first = ws.receive_json()
        assert first["type"] == "session" and first["session"]["open_stages"] == []
        client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "intro", "open": True}, headers=h)
        assert ws.receive_json()["session"]["open_stages"] == ["intro"]
        client.post(f"/api/teacher/sessions/{s['id']}/attention", json={"on": True, "text": ""}, headers=h)
        msg = ws.receive_json()
        assert msg["session"]["attention"] == {"on": True, "text": "Все смотрим на преподавателя"}
        client.post(f"/api/teacher/sessions/{s['id']}/end", headers=h)
        assert ws.receive_json()["session"]["ended"] is True


def test_teacher_websocket_sees_join(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    token = h["Authorization"][7:]
    with client.websocket_connect(f"/ws?role=teacher&token={token}&session={s['id']}") as ws:
        assert ws.receive_json()["students"] == []
        client.post("/api/join", json={"code": s["code"], "nick": "Лис"})
        assert [x["nick"] for x in ws.receive_json()["students"]] == ["Лис"]


def test_bad_websocket_token_rejected(client: TestClient) -> None:
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?token=nope") as ws:
            ws.receive_json()


def test_closed_orders_and_free_mode(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    r = client.post(f"/api/teacher/sessions/{s['id']}/order", json={"order": "o0-boss", "open": False}, headers=h)
    assert r.json()["session"]["closed_orders"] == ["o0-boss"]
    r = client.post(f"/api/teacher/sessions/{s['id']}/mode", json={"mode": "free"}, headers=h)
    assert r.json()["session"]["mode"] == "free"

def test_lesson_report_csv(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    j = client.post("/api/join", json={"code": s["code"], "nick": "Лис"}).json()
    sh = {"Authorization": f"Bearer {j['token']}"}
    client.post("/api/progress", headers=sh, json={"stage": "orders", "done_stages": ["intro", "konspekt"],
                "orders": {"o0-1": {"stars": 4, "attempts": 2, "hints": 1}}, "checks": {"correct": 5, "total": 6}})
    client.post("/api/help", headers=sh, json={"on": True})
    client.post(f"/api/teacher/sessions/{s['id']}/students/{j['me']['id']}/accept", json={"order": "o0-boss"}, headers=h)
    r = client.get(f"/api/teacher/sessions/{s['id']}/report.csv", headers=h)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.content.decode("utf-8-sig")
    rows = [line.split(";") for line in text.strip().splitlines()]
    assert rows[1][0] == "Псевдоним" and "o0-1 ★" in rows[1]
    lis = rows[2]
    assert lis[0] == "Лис" and lis[1] == "Задания" and lis[3] == "5/6" and lis[4] == "1"
    assert lis[rows[1].index("o0-1 ★")] == "4" and lis[-6] == "2/2" and lis[-5] == "o0-boss" and lis[-4] == ""
    assert client.get(f"/api/teacher/sessions/{s['id']}/report.csv").status_code == 401


def join(client: TestClient, s: dict, nick: str = "Лис") -> dict[str, str]:
    tok = client.post("/api/join", json={"code": s["code"], "nick": nick}).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


# ------------------------------------------------------------------ server check, code, comments, polls
def test_server_check_records_best_stars(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h, "free")
    me = join(client, s)
    bad = client.post("/api/check", json={"order": "o0-1", "source": "print('Луна')"}, headers=me)
    assert bad.status_code == 200, bad.text
    assert bad.json()["summary"]["passed"] == 0
    good = client.post("/api/check", json={"order": "o0-1", "source": "print('Искорка')\n"}, headers=me).json()
    assert good["summary"]["passed"] == 2 and good["summary"]["stars"] >= 4
    hidden = [c for c in good["cases"] if c["hidden"]][0]
    assert "expected" not in hidden and "stdin" not in hidden          # hidden cases stay hidden
    # A worse attempt later does not lower the recorded best.
    client.post("/api/check", json={"order": "o0-1", "source": "print(1)"}, headers=me)
    st = client.get("/api/state", headers=me).json()["me"]
    assert st["grants"]["checked"]["o0-1"] == good["summary"]["stars"]
    report = client.get(f"/api/teacher/sessions/{s['id']}/report.csv", headers=h).content.decode("utf-8-sig")
    assert "Проверено сервером" in report and f"o0-1 {good['summary']['stars']}★" in report


def test_server_check_respects_lesson_and_closed_orders(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    me = join(client, s)
    assert client.post("/api/check", json={"order": "o9-9", "source": "x"}, headers=me).status_code == 400
    # Sync lesson: the missions stage is not open yet → no checks (the gate holds on the server too).
    assert client.post("/api/check", json={"order": "o0-1", "source": "x"}, headers=me).status_code == 403
    client.post(f"/api/teacher/sessions/{s['id']}/stage", json={"stage": "orders", "open": True}, headers=h)
    assert client.post("/api/check", json={"order": "o0-1", "source": "x"}, headers=me).status_code == 200
    client.post(f"/api/teacher/sessions/{s['id']}/order", json={"order": "o0-1", "open": False}, headers=h)
    assert client.post("/api/check", json={"order": "o0-1", "source": "x"}, headers=me).status_code == 403
    assert client.post("/api/check", json={"order": "o0-1", "source": "x"}).status_code == 401
    too_long = "#" * 20_001
    assert client.post("/api/check", json={"order": "o0-boss", "source": too_long}, headers=me).status_code == 422


def test_server_check_survives_endless_loop(client: TestClient) -> None:
    h = teacher_headers(client)
    me = join(client, new_session(client, h, "free"))
    r = client.post("/api/check", json={"order": "o0-1", "source": "while True:\n    pass\n"}, headers=me)
    assert r.status_code == 200 and r.json()["summary"]["passed"] == 0


def test_code_snapshot_and_comment(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h, "free")
    me = join(client, s)
    assert client.post("/api/code", json={"order": "o0-1", "source": "print('Иск')"}, headers=me).json() == {"ok": True}
    stid = client.get("/api/state", headers=me).json()["me"]["id"]
    code = client.get(f"/api/teacher/sessions/{s['id']}/students/{stid}/code", headers=h).json()["code"]
    assert code[0]["order"] == "o0-1" and code[0]["source"] == "print('Иск')"
    assert client.get(f"/api/teacher/sessions/{s['id']}/students/{stid}/code", headers=me).status_code == 401
    r = client.post(f"/api/teacher/sessions/{s['id']}/students/{stid}/comment",
                    json={"text": "Проверь кавычки", "order": "o0-1"}, headers=h)
    assert r.status_code == 200
    notes = client.get("/api/state", headers=me).json()["me"]["grants"]["comments"]
    assert notes[-1]["text"] == "Проверь кавычки" and notes[-1]["order"] == "o0-1"


def test_poll_flow_is_anonymous(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    a, b = join(client, s, "Лис"), join(client, s, "Сова")
    url = f"/api/teacher/sessions/{s['id']}/poll"
    assert client.post(url, json={"action": "start", "question": "Что выведет?", "options": ["1"]}, headers=h).status_code == 400
    poll = client.post(url, json={"action": "start", "question": "Что выведет print(2+2)?",
                                  "options": ["22", "4", "Ошибка"]}, headers=h).json()["session"]["poll"]
    assert poll["open"] and poll["counts"] == [0, 0, 0]
    client.post("/api/poll", json={"poll": poll["id"], "option": 1}, headers=a)
    client.post("/api/poll", json={"poll": poll["id"], "option": 0}, headers=b)
    view = client.post("/api/poll", json={"poll": poll["id"], "option": 1}, headers=b).json()   # changed the mind
    assert view["me"]["poll_answer"] == 1
    assert view["session"]["poll"]["counts"] == [0, 2, 0] and "answers" not in view["session"]["poll"]
    client.post(url, json={"action": "close"}, headers=h)
    assert client.post("/api/poll", json={"poll": poll["id"], "option": 2}, headers=a).status_code == 409
    assert client.post(url, json={"action": "clear"}, headers=h).json()["session"]["poll"] is None


def test_report_has_diagnostic_gain(client: TestClient) -> None:
    h = teacher_headers(client)
    s = new_session(client, h)
    me = join(client, s)
    client.post("/api/progress", headers=me, json={"stage": "closing", "diag": {"a": 4, "a_total": 10, "b": 8, "b_total": 10}})
    me2 = join(client, s, "Сова")
    client.post("/api/progress", headers=me2, json={"stage": "orders", "diag": {"a": 6, "a_total": 10}})
    rows = [r.split(";") for r in client.get(f"/api/teacher/sessions/{s['id']}/report.csv", headers=h)
            .content.decode("utf-8-sig").strip().splitlines()]
    assert rows[1][-3:] == ["Диагностика A", "Диагностика B", "Прирост B−A, п. п."]
    by_nick = {r[0]: r for r in rows[2:]}
    assert by_nick["Лис"][-3:] == ["4/10", "8/10", "+40"]
    assert by_nick["Сова"][-3:] == ["6/10", "", ""]


def test_server_check_is_off_without_checker(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """The lesson server never runs code itself: without a checker service the browser checks."""
    monkeypatch.delenv("BUREAU_LOCAL_CHECK")
    h = teacher_headers(client)
    me = join(client, new_session(client, h, "free"))
    r = client.post("/api/check", json={"order": "o0-1", "source": "print('Искорка')"}, headers=me)
    assert r.status_code == 503 and "браузере" in r.json()["detail"]
    assert client.get("/api/health").json()["server_check"] is False
