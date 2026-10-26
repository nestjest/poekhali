"""Lesson server for the course «Поехали!»: the teacher opens lesson stages, students wait until then.

REST for actions, WebSocket for instant pushes (students poll /api/state as a fallback).
Student code is judged in the browser (Pyodide). This process never runs it: when a checker service is configured
(checker.py, Docker), /api/check forwards the program there and the same judge runs against the server's copy of
the mission with hidden cases.
"""
from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import checker
from . import crews as crewlib
from .crews import Crew
from .store import Session, Store, Student

ROOT = Path(__file__).resolve().parents[2]
AVATARS = {"a1", "a2", "a3", "a4"}
LOGIN_WINDOW = 300
LOGIN_MAX_FAILS = 10
mimetypes.add_type("application/wasm", ".wasm")      # Windows registry often lacks these
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/javascript", ".js")


# ------------------------------------------------------------------ content catalog
def load_crews(content: Path) -> dict[int, dict[str, Any]]:
    """Crew missions (team «Конец смены») by lesson number, with hidden cases: they never leave the server as is."""
    out: dict[int, dict[str, Any]] = {}
    folder = content / "crews"
    for path in sorted(folder.glob("*.json")) if folder.exists() else []:
        m = json.loads(path.read_text(encoding="utf-8"))
        out[int(m["lesson"])] = m
    return out


def load_museum(content: Path) -> dict[str, dict[str, Any]]:
    """Exhibits of «Музей бюро» by id (the answers of the crew museum quiz are checked here, not in the browser)."""
    path = content / "museum.json"
    return {ex["id"]: ex for ex in json.loads(path.read_text(encoding="utf-8"))} if path.exists() else {}


def crew_brief(m: dict[str, Any] | None) -> dict[str, Any] | None:
    if not m:
        return None
    return {"id": m["id"], "title": m["title"], "craft": m.get("craft", ""),
            "parts": [{"id": p["id"], "role": p["role"], "title": p["title"]} for p in m.get("parts", [])]}


def load_catalog(content: Path) -> dict[int, dict[str, Any]]:
    """Lessons with stage ids and order titles: the server validates stage/order ids against it."""
    catalog: dict[int, dict[str, Any]] = {}
    missions = load_crews(content)
    for path in sorted((content / "lessons").glob("*.json")):
        lesson = json.loads(path.read_text(encoding="utf-8"))
        orders = []
        for st in lesson["stages"]:
            for oid in st.get("orders", []):
                op = content / "orders" / f"{oid}.json"
                o = json.loads(op.read_text(encoding="utf-8")) if op.exists() else {}
                orders.append({"file": oid, "id": o.get("id", oid), "title": o.get("title", oid),
                               "kind": o.get("kind", "regular")})
        catalog[lesson["number"]] = {
            "number": lesson["number"], "title": lesson["title"], "goal": lesson.get("goal", ""),
            "stages": [{"id": s["id"], "title": s["title"], "minutes": s.get("minutes"),
                        "teacher": s.get("teacher", {}), "orders": s.get("orders", [])}
                       for s in lesson["stages"]],
            "orders": orders,
            "crew": crew_brief(missions.get(lesson["number"])),
        }
    return catalog


# ------------------------------------------------------------------ websocket hub
@dataclass(eq=False)
class Conn:
    ws: WebSocket
    role: Literal["student", "teacher"]
    student_id: int | None = None


class Hub:
    def __init__(self, catalog: dict[int, dict[str, Any]] | None = None,
                 missions: dict[int, dict[str, Any]] | None = None) -> None:
        self.conns: dict[int, list[Conn]] = defaultdict(list)
        self.catalog = catalog or {}
        self.missions = missions or {}

    def online(self, session_id: int) -> set[int]:
        return {c.student_id for c in self.conns.get(session_id, []) if c.student_id is not None}

    async def _send(self, session_id: int, conn: Conn, payload: dict[str, Any]) -> None:
        try:
            await conn.ws.send_json(payload)
        except Exception:  # noqa: BLE001 — a dead socket must not break the broadcast
            if conn in self.conns.get(session_id, []):
                self.conns[session_id].remove(conn)

    async def push(self, store: Store, session_id: int, *, students: bool = True) -> None:
        session = store.session(session_id)
        if session is None:
            return
        ctx = crew_context(store, self, session)
        cls = class_view(store, self, session, ctx)
        for conn in list(self.conns.get(session_id, [])):
            if conn.role == "teacher":
                await self._send(session_id, conn, {"type": "class", **cls})
            elif students and conn.student_id is not None:
                st = ctx.students.get(conn.student_id)
                if st:
                    await self._send(session_id, conn, {"type": "session", **student_view(session, st, ctx)})


@dataclass
class CrewContext:
    """Everything about the crews of one session, computed once per push."""
    crews: list[Crew]
    mission: dict[str, Any] | None
    students: dict[int, Student]
    online: set[int]
    race: list[dict[str, Any]]


def crew_context(store: Store, hub: Hub, session: Session) -> CrewContext:
    students = {st.id: st for st in store.students(session.id)}
    crews = store.crews(session.id)
    now = time.time()
    connected = hub.online(session.id)
    online = {sid for sid, st in students.items() if sid in connected or now - st.last_seen < 45}
    files = [o["file"] for o in hub.catalog.get(session.lesson, {}).get("orders", [])]
    race = crewlib.race(crews, {sid: {"progress": st.progress, "grants": st.grants} for sid, st in students.items()},
                        files)
    return CrewContext(crews, hub.missions.get(session.lesson), students, online, race)


def crew_view(c: Crew, ctx: CrewContext) -> dict[str, Any]:
    part_ids = [p["id"] for p in (ctx.mission or {}).get("parts", [])]
    owners = crewlib.assignment(c.members, part_ids)
    places = crewlib.start_places(ctx.crews)
    members = []
    for sid in c.members:
        st = ctx.students.get(sid)
        if st is None:
            continue
        members.append({"id": sid, "nick": st.nick, "avatar": st.avatar, "online": sid in ctx.online,
                        "parts": [pid for pid, owner in owners.items() if owner == sid]})
    return {"id": c.id, "name": c.name, "mission": (ctx.mission or {}).get("id"), "members": members,
            "parts": c.parts, "result": c.result, "stars": crewlib.crew_stars(c), "accepted": c.accepted,
            "launched": c.launched is not None, "start_place": places.get(c.id), "checks": c.checks,
            "chat": c.chat[-crewlib.CHAT_KEEP:], "quiz": c.quiz}


def student_view(session: Session, st: Student, ctx: CrewContext | None = None) -> dict[str, Any]:
    poll = session.poll
    answer = poll.get("answers", {}).get(str(st.id)) if poll else None
    crew = next((c for c in ctx.crews if st.id in c.members), None) if ctx else None
    return {"session": session.public(), "me": {"id": st.id, "nick": st.nick, "grants": st.grants,
                                                "help": st.help is not None, "poll_answer": answer},
            "crew": crew_view(crew, ctx) if crew and ctx else None,
            "race": ctx.race if ctx and ctx.crews else []}


def class_view(store: Store, hub: Hub, session: Session, ctx: CrewContext | None = None) -> dict[str, Any]:
    ctx = ctx or crew_context(store, hub, session)
    students = []
    for st in sorted(ctx.students.values(), key=lambda x: x.nick.lower()):
        v = st.view()
        v["online"] = st.id in ctx.online
        students.append(v)
    return {"session": session.public(), "students": students, "now": time.time(),
            "crews": [crew_view(c, ctx) for c in ctx.crews], "race": ctx.race}


# ------------------------------------------------------------------ lesson report
def report_csv(session: Session, students: list[Student], log: list[dict[str, Any]], lesson: dict[str, Any]) -> bytes:
    """One row per student: stages, every mission (stars / checks / hints / accepted by teacher), answers, calls for help.
    Game rewards are not in the report: the grade is set by the rubric (PROMPT.md §9.9)."""
    orders = lesson.get("orders", [])
    stage_titles = {st["id"]: st["title"] for st in lesson.get("stages", [])}
    helps: dict[int, int] = defaultdict(int)
    for e in log:
        if e["action"] == "help" and e["data"].get("on") and e["actor"].startswith("student:"):
            helps[int(e["actor"].split(":")[1])] += 1
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow([f"Урок {session.code}", f"Занятие {session.lesson}. {lesson.get('title', '')}", session.group,
                time.strftime("%d.%m.%Y %H:%M", time.localtime(session.created))])
    head = ["Псевдоним", "Этап", "Пройдено этапов", "Ответы (верно/всего)", "Вызовов преподавателя"]
    for o in orders:
        head += [f"{o['id']} ★", f"{o['id']} проверок", f"{o['id']} подсказок"]
    head += ["Принято заданий", "Зачтено преподавателем", "Проверено сервером", "Диагностика A", "Диагностика B", "Прирост B−A, п. п."]
    w.writerow(head)
    for st in sorted(students, key=lambda x: x.nick.lower()):
        p = st.progress or {}
        accepted_by_teacher = set(st.grants.get("accepted", []))
        checks = p.get("checks") or {}
        row: list[Any] = [st.nick, stage_titles.get(p.get("stage") or "", p.get("stage") or "—"), len(p.get("done_stages") or []),
                          f"{checks.get('correct', 0)}/{checks.get('total', 0)}", helps[st.id]]
        done = 0
        checked = st.grants.get("checked", {})
        for o in orders:
            os_ = (p.get("orders") or {}).get(o["file"], {})
            stars = max(int(os_.get("stars", 0)), int(checked.get(o["file"], 0)))
            done += stars >= 3 or o["file"] in accepted_by_teacher
            row += [stars or "", os_.get("attempts", ""), os_.get("hints", "")]
        row += [f"{done}/{len(orders)}", ", ".join(sorted(accepted_by_teacher)),
                ", ".join(f"{k} {v}★" for k, v in sorted(checked.items()))]
        row += diag_columns(p.get("diag") or {})
        w.writerow(row)
    return ("﻿" + out.getvalue()).encode("utf-8")


def diag_columns(d: dict[str, int]) -> list[str]:
    """«4/10», «8/10», «+40»: the gain is in percentage points, so tests of different length compare fairly."""
    a = f"{d['a']}/{d['a_total']}" if d.get("a_total") else ""
    b = f"{d['b']}/{d['b_total']}" if d.get("b_total") else ""
    gain = ""
    if a and b:
        pts = round((d["b"] / d["b_total"] - d["a"] / d["a_total"]) * 100)
        gain = f"+{pts}" if pts > 0 else str(pts)
    return [a, b, gain]


# ------------------------------------------------------------------ request models
class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class PasswordIn(BaseModel):
    old: str = Field(min_length=1, max_length=200)
    new: str = Field(min_length=6, max_length=200)


class SessionIn(BaseModel):
    lesson: int = 0
    mode: Literal["sync", "free"] = "sync"
    group: str = Field(default="", max_length=40)


class StageIn(BaseModel):
    stage: str = Field(max_length=40)
    open: bool


class OrderIn(BaseModel):
    order: str = Field(max_length=40)
    open: bool


class ModeIn(BaseModel):
    mode: Literal["sync", "free"]


class AttentionIn(BaseModel):
    on: bool
    text: str = Field(default="", max_length=200)


class MessageIn(BaseModel):
    text: str = Field(default="", max_length=300)


class AcceptIn(BaseModel):
    order: str = Field(max_length=40)
    accept: bool = True


class JoinIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    nick: str = Field(min_length=1, max_length=24)
    avatar: str = "a1"


class OrderStat(BaseModel):
    stars: int = Field(default=0, ge=0, le=5)
    attempts: int = Field(default=0, ge=0, le=10_000)
    hints: int = Field(default=0, ge=0, le=100)
    revision: bool = False


class ProgressIn(BaseModel):
    stage: str | None = Field(default=None, max_length=40)        # the stage the student is on (or waits for)
    where: str = Field(default="hub", max_length=20)
    order: str | None = Field(default=None, max_length=40)
    waiting: bool = False
    done_stages: list[str] = Field(default_factory=list, max_length=40)
    orders: dict[str, OrderStat] = Field(default_factory=dict, max_length=60)
    checks: dict[str, int] = Field(default_factory=dict, max_length=4)
    errors: dict[str, int] = Field(default_factory=dict, max_length=30)
    diag: dict[str, int] = Field(default_factory=dict, max_length=4)   # entry test A / final test B: a, a_total, b, b_total


class HelpIn(BaseModel):
    on: bool


class CheckIn(BaseModel):
    order: str = Field(max_length=40)
    source: str = Field(max_length=checker.MAX_SOURCE)
    hints: int = Field(default=0, ge=0, le=3)
    clarify: list[int] | None = Field(default=None, max_length=10)


class CodeIn(BaseModel):
    order: str = Field(max_length=40)
    source: str = Field(max_length=checker.MAX_SOURCE)


class PollIn(BaseModel):
    action: Literal["start", "close", "clear"]
    question: str = Field(default="", max_length=200)
    options: list[str] = Field(default_factory=list, max_length=6)


class AnswerIn(BaseModel):
    poll: int
    option: int = Field(ge=0, le=5)


class CrewsIn(BaseModel):
    action: Literal["auto", "move", "clear", "accept"]
    size: int = Field(default=3, ge=2, le=4)
    student: int | None = None
    crew: int | None = None          # move: the target crew (None — a new crew); accept: the crew


class CrewPartIn(BaseModel):
    part: str = Field(max_length=20)
    source: str = Field(max_length=checker.MAX_SOURCE)


class CrewChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=crewlib.CHAT_MAX)


class CrewCheckIn(BaseModel):
    hints: int = Field(default=0, ge=0, le=3)


class CrewQuizIn(BaseModel):
    exhibit: str = Field(min_length=1, max_length=40)
    answer: int = Field(ge=0, le=5)


class CrewResultIn(BaseModel):
    """Browser check result: used only when the server has no checker service."""
    stars: int = Field(ge=0, le=5)
    score: float = Field(ge=0, le=100)
    passed: int = Field(ge=0, le=50)
    total: int = Field(ge=0, le=50)


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    order: str | None = Field(default=None, max_length=40)


# ------------------------------------------------------------------ app factory
def create_app(db_path: Path | str = ":memory:", content: Path | None = None,
               static_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="«Поехали!» — сервер урока", docs_url="/api/docs", openapi_url="/api/openapi.json")
    store = Store(db_path)
    content_dir = content or ROOT / "content"
    catalog = load_catalog(content_dir)
    missions = load_crews(content_dir)
    museum = load_museum(content_dir)
    hub = Hub(catalog, missions)
    chat_at: dict[int, float] = {}      # student → time of the last chat message (flood guard)
    fails: dict[str, list[float]] = defaultdict(list)
    checking: set[int] = set()          # students whose check is running: one check at a time per student
    app.state.store = store
    app.state.hub = hub
    app.state.catalog = catalog
    app.state.missions = missions

    def bearer(authorization: str | None) -> str | None:
        if authorization and authorization.lower().startswith("bearer "):
            return authorization[7:].strip()
        return None

    def teacher(authorization: str | None = Header(default=None)) -> str:
        token = bearer(authorization)
        if not store.teacher_ok(token):
            raise HTTPException(401, "Нужен вход преподавателя")
        return token or ""

    def student(authorization: str | None = Header(default=None)) -> Student:
        st = store.student(bearer(authorization))
        if st is None:
            raise HTTPException(401, "Нужно войти в урок по коду")
        return st

    def get_session(sid: int) -> Session:
        s = store.session(sid)
        if s is None:
            raise HTTPException(404, "Урок не найден")
        return s

    def stage_ids(s: Session) -> set[str]:
        return {st["id"] for st in catalog.get(s.lesson, {}).get("stages", [])}

    def order_ids(s: Session) -> set[str]:
        return {o["file"] for o in catalog.get(s.lesson, {}).get("orders", [])}

    def order_data(file_id: str) -> dict[str, Any]:
        """The full mission (with hidden cases) from the server's content, never from the browser."""
        path = content_dir / "orders" / f"{file_id}.json"
        if not path.is_file():
            raise HTTPException(404, "Нет такого задания")
        return json.loads(path.read_text(encoding="utf-8"))

    # ---------------------------------------------------------------- public
    @app.get("/api/health")
    def health() -> dict[str, Any]:
        # The address for students (the console shows it instead of «localhost»): BUREAU_PUBLIC_URL or the LAN address
        # found at start (python -m bureau_server); unknown inside Docker unless BUREAU_PUBLIC_URL is set.
        url = os.environ.get("BUREAU_PUBLIC_URL", "").strip().rstrip("/") or os.environ.get("BUREAU_STUDENT_URL", "").rstrip("/")
        return {"ok": True, "lessons": sorted(catalog), "teacher_ready": store.has_password(),
                "server_check": checker.enabled(), "student_url": f"{url}/" if url else None}

    # ---------------------------------------------------------------- teacher
    @app.post("/api/teacher/login")
    def login(body: LoginIn, request: Request) -> dict[str, str]:
        ip = request.client.host if request.client else "?"
        now = time.time()
        fails[ip] = [t for t in fails[ip] if now - t < LOGIN_WINDOW]
        if len(fails[ip]) >= LOGIN_MAX_FAILS:
            raise HTTPException(429, "Слишком много попыток. Подождите 5 минут.")
        if not store.check_password(body.password):
            fails[ip].append(now)
            raise HTTPException(401, "Пароль не подошёл. Он напечатан в окне запуска сервера.")
        fails.pop(ip, None)
        return {"token": store.new_teacher_token()}

    @app.post("/api/teacher/password")
    def change_password(body: PasswordIn, _: str = Depends(teacher)) -> dict[str, str]:
        if not store.check_password(body.old):
            raise HTTPException(400, "Старый пароль не подошёл")
        store.set_password(body.new)
        return {"token": store.new_teacher_token()}

    @app.get("/api/teacher/lessons")
    def lessons(_: str = Depends(teacher)) -> list[dict[str, Any]]:
        return [catalog[k] for k in sorted(catalog)]

    @app.get("/api/teacher/sessions")
    def sessions(_: str = Depends(teacher)) -> list[dict[str, Any]]:
        return [{**s.public(), "students": len(store.students(s.id))} for s in store.sessions()]

    @app.post("/api/teacher/sessions")
    async def create_session(body: SessionIn, _: str = Depends(teacher)) -> dict[str, Any]:
        if body.lesson not in catalog:
            raise HTTPException(400, "Нет такого занятия")
        s = store.create_session(body.lesson, body.mode, body.group.strip())
        store.audit(s.id, "teacher", "create", body.model_dump())
        return class_view(store, hub, s)

    @app.get("/api/teacher/sessions/{sid}")
    def session_detail(sid: int, _: str = Depends(teacher)) -> dict[str, Any]:
        return class_view(store, hub, get_session(sid))

    @app.get("/api/teacher/sessions/{sid}/log")
    def session_log(sid: int, _: str = Depends(teacher)) -> list[dict[str, Any]]:
        get_session(sid)
        return store.audit_log(sid)

    @app.get("/api/teacher/sessions/{sid}/report.csv")
    def session_report(sid: int, _: str = Depends(teacher)) -> Response:
        """Lesson report for the journal: one row per student (Excel: «;» and UTF-8 with BOM)."""
        s = get_session(sid)
        return Response(content=report_csv(s, store.students(s.id), store.audit_log(s.id), catalog.get(s.lesson, {})),
                        media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="lesson{s.lesson}-{s.id}-report.csv"'})

    async def changed(s: Session, action: str, data: dict[str, Any]) -> dict[str, Any]:
        store.save_session(s)
        store.audit(s.id, "teacher", action, data)
        await hub.push(store, s.id)
        return class_view(store, hub, s)

    @app.post("/api/teacher/sessions/{sid}/stage")
    async def set_stage(sid: int, body: StageIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        if body.stage not in stage_ids(s):
            raise HTTPException(400, "Нет такого этапа")
        order = [st["id"] for st in catalog[s.lesson]["stages"]]
        opened = set(s.open_stages)
        if body.open:
            # Opening a stage opens everything before it: students cannot skip the path.
            opened |= set(order[: order.index(body.stage) + 1])
        else:
            opened -= set(order[order.index(body.stage):])
        was_open = set(s.open_stages)
        s.open_stages = [x for x in order if x in opened]
        if (body.open and "closing" in s.open_stages and "closing" not in was_open and s.lesson in missions
                and not store.crews(s.id)):
            make_crews(s, 3)     # the team stage: the console splits the class into crews by itself
        return await changed(s, "stage", body.model_dump())

    @app.post("/api/teacher/sessions/{sid}/mode")
    async def set_mode(sid: int, body: ModeIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        s.mode = body.mode
        return await changed(s, "mode", body.model_dump())

    @app.post("/api/teacher/sessions/{sid}/order")
    async def set_order(sid: int, body: OrderIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        if body.order not in order_ids(s):
            raise HTTPException(400, "Нет такого задания")
        closed = set(s.closed_orders) - {body.order}
        if not body.open:
            closed.add(body.order)
        s.closed_orders = sorted(closed)
        return await changed(s, "order", body.model_dump())

    @app.post("/api/teacher/sessions/{sid}/attention")
    async def attention(sid: int, body: AttentionIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        s.attention = {"on": body.on, "text": body.text.strip() or "Все смотрим на преподавателя"}
        return await changed(s, "attention", body.model_dump())

    @app.post("/api/teacher/sessions/{sid}/message")
    async def message(sid: int, body: MessageIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        s.message = {"text": body.text.strip(), "at": time.time()} if body.text.strip() else None
        return await changed(s, "message", body.model_dump())

    @app.post("/api/teacher/sessions/{sid}/end")
    async def end(sid: int, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        s.ended = time.time()
        s.attention = {"on": False, "text": ""}
        return await changed(s, "end", {})

    def own_student(s: Session, stid: int) -> Student:
        st = store.student_by_id(stid)
        if st is None or st.session_id != s.id:
            raise HTTPException(404, "Ученик не найден")
        return st

    @app.post("/api/teacher/sessions/{sid}/students/{stid}/accept")
    async def accept(sid: int, stid: int, body: AcceptIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        if body.order not in order_ids(s):
            raise HTTPException(400, "Нет такого задания")
        st = own_student(s, stid)
        acc = set(st.grants.get("accepted", [])) - {body.order}
        if body.accept:
            acc.add(body.order)
        st.grants = {**st.grants, "accepted": sorted(acc)}
        store.save_student(st)
        store.audit(s.id, "teacher", "accept", {"student": st.id, **body.model_dump()})
        await hub.push(store, s.id)
        return class_view(store, hub, s)

    @app.post("/api/teacher/sessions/{sid}/students/{stid}/help")
    async def answer_help(sid: int, stid: int, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        st = own_student(s, stid)
        st.help = None
        store.save_student(st)
        store.audit(s.id, "teacher", "help_answered", {"student": st.id})
        await hub.push(store, s.id)
        return class_view(store, hub, s)

    @app.post("/api/teacher/sessions/{sid}/poll")
    async def poll(sid: int, body: PollIn, _: str = Depends(teacher)) -> dict[str, Any]:
        """Quick class poll for the projector: start (question + 2–6 options), close (stop answers), clear."""
        s = get_session(sid)
        if body.action == "start":
            options = [o.strip() for o in body.options if o.strip()]
            if not body.question.strip() or not 2 <= len(options) <= 6:
                raise HTTPException(400, "Нужен вопрос и от 2 до 6 вариантов ответа")
            prev = s.poll["id"] if s.poll else 0
            s.poll = {"id": prev + 1, "question": body.question.strip(), "options": options, "open": True,
                      "answers": {}}
        elif body.action == "close":
            if s.poll:
                s.poll = {**s.poll, "open": False}
        else:
            s.poll = None
        return await changed(s, "poll", body.model_dump())

    @app.get("/api/teacher/sessions/{sid}/students/{stid}/code")
    def student_code(sid: int, stid: int, _: str = Depends(teacher)) -> dict[str, Any]:
        """Latest program of the student for each mission: read-only for the teacher."""
        st = own_student(get_session(sid), stid)
        return {"student": st.view(), "code": store.codes(st.id)}

    @app.post("/api/teacher/sessions/{sid}/students/{stid}/comment")
    async def comment(sid: int, stid: int, body: CommentIn, _: str = Depends(teacher)) -> dict[str, Any]:
        s = get_session(sid)
        st = own_student(s, stid)
        notes = list(st.grants.get("comments", []))[-19:]
        notes.append({"id": int(time.time() * 1000), "text": body.text.strip(), "order": body.order, "at": time.time()})
        st.grants = {**st.grants, "comments": notes}
        store.save_student(st)
        store.audit(s.id, "teacher", "comment", {"student": st.id, **body.model_dump()})
        await hub.push(store, s.id)
        return class_view(store, hub, s)

    # ---------------------------------------------------------------- student
    @app.post("/api/join")
    async def join(body: JoinIn) -> dict[str, Any]:
        s = store.session_by_code(body.code)
        if s is None:
            raise HTTPException(404, "Урок с таким кодом не найден. Проверьте код на доске или экране.")
        nick = " ".join(body.nick.split())
        if not nick:
            raise HTTPException(400, "Нужен псевдоним")
        st = store.join(s, nick, body.avatar if body.avatar in AVATARS else "a1")
        store.audit(s.id, f"student:{st.id}", "join", {"nick": st.nick})
        crews_now = store.crews(s.id)
        if crews_now and not any(st.id in c.members for c in crews_now):
            add_late(s, st.id, crews_now)
        await hub.push(store, s.id, students=bool(crews_now))
        return {"token": st.token, **student_view(s, st, crew_context(store, hub, s))}

    @app.get("/api/state")
    def state(st: Student = Depends(student)) -> dict[str, Any]:
        st.last_seen = time.time()
        store.save_student(st)
        s = get_session(st.session_id)
        return student_view(s, st, crew_context(store, hub, s))

    @app.post("/api/progress")
    async def progress(body: ProgressIn, st: Student = Depends(student)) -> dict[str, Any]:
        st.progress = {**body.model_dump(), "at": time.time()}
        st.last_seen = time.time()
        store.save_student(st)
        await hub.push(store, st.session_id, students=False)
        return {"ok": True}

    @app.post("/api/help")
    async def help_request(body: HelpIn, st: Student = Depends(student)) -> dict[str, Any]:
        st.help = time.time() if body.on else None
        store.save_student(st)
        store.audit(st.session_id, f"student:{st.id}", "help", body.model_dump())
        await hub.push(store, st.session_id)
        s = get_session(st.session_id)
        return student_view(s, st, crew_context(store, hub, s))

    @app.post("/api/poll")
    async def answer_poll(body: AnswerIn, st: Student = Depends(student)) -> dict[str, Any]:
        s = get_session(st.session_id)
        if not s.poll or s.poll["id"] != body.poll or not s.poll["open"]:
            raise HTTPException(409, "Опрос уже закрыт")
        if body.option >= len(s.poll["options"]):
            raise HTTPException(400, "Нет такого варианта")
        s.poll["answers"][str(st.id)] = body.option
        store.save_session(s)
        await hub.push(store, s.id)
        return student_view(s, st, crew_context(store, hub, s))

    def allowed_order(st: Student, file_id: str) -> Session:
        s = get_session(st.session_id)
        if file_id not in order_ids(s):
            raise HTTPException(400, "Это задание не из текущего занятия")
        if s.ended is None and file_id in s.closed_orders:
            raise HTTPException(403, "Преподаватель пока закрыл это задание")
        stage = next((st["id"] for st in catalog[s.lesson]["stages"] if file_id in st.get("orders", [])), None)
        if s.ended is None and s.mode == "sync" and stage and stage not in s.open_stages:
            raise HTTPException(403, "Этап с заданиями ещё не открыт. Ждём команду ЦУП.")
        return s

    @app.post("/api/code")
    async def save_code(body: CodeIn, st: Student = Depends(student)) -> dict[str, Any]:
        """Snapshot of the student's program, so the teacher can look at it on the console."""
        s = allowed_order(st, body.order)
        prev = next((c for c in store.codes(st.id) if c["order"] == body.order), None)
        store.save_code(st.id, body.order, body.source, prev["result"] if prev and prev["source"] == body.source else None)
        await hub.push(store, s.id, students=False)
        return {"ok": True}

    @app.post("/api/check")
    async def check(body: CheckIn, st: Student = Depends(student)) -> dict[str, Any]:
        """Server check: the same judge in an isolated process, hidden cases from the server's content."""
        s = allowed_order(st, body.order)
        if not checker.enabled():
            raise HTTPException(503, "Серверная проверка не включена: проверяем в браузере.")
        if st.id in checking:
            raise HTTPException(429, "Предыдущая проверка ещё идёт. Подождите пару секунд.")
        checking.add(st.id)
        try:
            result = await run_in_threadpool(checker.check, order_data(body.order), body.source, body.hints, body.clarify)
        except checker.CheckError as exc:      # temporary failure (502): the browser checks this time
            raise HTTPException(502, str(exc)) from exc
        finally:
            checking.discard(st.id)
        summary = result.get("summary") or {}
        stars = int(summary.get("stars", 0))
        st = store.student_by_id(st.id) or st     # grants may have changed while the check was running
        best = dict(st.grants.get("checked", {}))
        best[body.order] = max(stars, int(best.get(body.order, 0)))
        st.grants = {**st.grants, "checked": best}
        store.save_student(st)
        store.save_code(st.id, body.order, body.source,
                        {"stars": stars, "passed": summary.get("passed"), "total": summary.get("total")})
        store.audit(s.id, f"student:{st.id}", "check", {"order": body.order, "stars": stars})
        await hub.push(store, s.id)
        return result

    # ---------------------------------------------------------------- crews (team «Конец смены»)
    def make_crews(s: Session, size: int) -> None:
        """Split the class into crews (online students first, so every crew has someone at the keyboard)."""
        store.delete_crews(s.id)
        ctx = crew_context(store, hub, s)
        ids = sorted(ctx.students, key=lambda sid: (sid not in ctx.online, ctx.students[sid].joined, sid))
        groups = crewlib.split(ids, size)
        for name, members in zip(crewlib.free_names(set(), len(groups)), groups):
            store.add_crew(s.id, name, members)
        store.audit(s.id, "teacher", "crews", {"size": size, "crews": len(groups)})

    def add_late(s: Session, student_id: int, crews_now: list[Crew]) -> None:
        small = min(crews_now, key=lambda c: (len(c.members), c.id))
        if len(small.members) < 3:
            small.members.append(student_id)
            store.save_crew(small)
        else:
            store.add_crew(s.id, crewlib.free_names({c.name for c in crews_now}, 1)[0], [student_id])

    def launch_if_ready(c: Crew) -> None:
        if c.launched is None and crewlib.crew_stars(c) >= 3:
            c.launched = time.time()

    @app.post("/api/teacher/sessions/{sid}/crews")
    async def teacher_crews(sid: int, body: CrewsIn, _: str = Depends(teacher)) -> dict[str, Any]:
        """Crews: auto split (2–4 per crew), move a student (to a crew or a new one), clear, accept a crew program."""
        s = get_session(sid)
        if s.lesson not in missions:
            raise HTTPException(400, "В этом занятии нет командной программы")
        if body.action == "auto":
            make_crews(s, body.size)
        elif body.action == "clear":
            store.delete_crews(s.id)
            store.audit(s.id, "teacher", "crews_clear", {})
        elif body.action == "move":
            if body.student is None:
                raise HTTPException(400, "Не выбран ученик")
            own_student(s, body.student)
            crews_now = store.crews(s.id)
            target = next((c for c in crews_now if c.id == body.crew), None) if body.crew is not None else None
            if body.crew is not None and target is None:
                raise HTTPException(404, "Экипаж не найден")
            for c in crews_now:
                if body.student in c.members and c is not target:
                    c.members.remove(body.student)
                    if c.members:
                        store.save_crew(c)
                    else:
                        store.delete_crew(c.id)
            if target is None:
                store.add_crew(s.id, crewlib.free_names({c.name for c in store.crews(s.id)}, 1)[0], [body.student])
            elif body.student not in target.members:
                target.members.append(body.student)
                store.save_crew(target)
            store.audit(s.id, "teacher", "crew_move", body.model_dump())
        else:
            c = store.crew(body.crew or 0)
            if c is None or c.session_id != s.id:
                raise HTTPException(404, "Экипаж не найден")
            c.accepted = True
            launch_if_ready(c)
            store.save_crew(c)
            store.audit(s.id, "teacher", "crew_accept", {"crew": c.id})
        await hub.push(store, s.id)
        return class_view(store, hub, s)

    def my_crew(st: Student) -> tuple[Session, Crew, dict[str, Any]]:
        s = get_session(st.session_id)
        if s.ended is not None:
            raise HTTPException(409, "Урок завершён: командная программа — только во время урока")
        if s.mode == "sync" and "closing" not in s.open_stages:
            raise HTTPException(403, "Этап «Конец смены» ещё не открыт. Ждём команду ЦУП.")
        c = store.crew_of(s.id, st.id)
        mission = missions.get(s.lesson)
        if c is None or mission is None:
            raise HTTPException(404, "Ты пока не в экипаже. Преподаватель распределит экипажи.")
        return s, c, mission

    @app.post("/api/crew/part")
    async def crew_part(body: CrewPartIn, st: Student = Depends(student)) -> dict[str, Any]:
        s, c, mission = my_crew(st)
        owners = crewlib.assignment(c.members, [p["id"] for p in mission["parts"]])
        if body.part not in owners:
            raise HTTPException(400, "Нет такой части программы")
        if owners[body.part] != st.id:
            raise HTTPException(403, "Эту часть пишет другой член экипажа")
        if c.parts.get(body.part, {}).get("source") != body.source:
            c.parts[body.part] = {"source": body.source, "by": st.id, "at": time.time()}
            store.save_crew(c)
            await hub.push(store, s.id)
        return {"ok": True}

    @app.post("/api/crew/chat")
    async def crew_chat(body: CrewChatIn, st: Student = Depends(student)) -> dict[str, Any]:
        s, c, _ = my_crew(st)
        text = crewlib.clean_chat(body.text)
        now = time.time()
        if not text:
            raise HTTPException(400, "Пустое сообщение")
        if now - chat_at.get(st.id, 0) < 1.0:
            raise HTTPException(429, "Не так быстро: одно сообщение в секунду")
        chat_at[st.id] = now
        c.chat = (c.chat + [{"id": int(now * 1000), "by": st.id, "nick": st.nick, "text": text, "at": now}]
                  )[-crewlib.CHAT_KEEP:]
        store.save_crew(c)
        store.audit(s.id, f"student:{st.id}", "crew_chat", {"crew": c.id, "text": text})
        await hub.push(store, s.id)
        return {"ok": True}

    def record(s: Session, c: Crew, st: Student, summary: dict[str, Any], verified: bool) -> None:
        best = c.result or {}
        c.checks += 1
        if int(summary.get("stars", 0)) >= int(best.get("stars", 0)):
            c.result = {"stars": int(summary.get("stars", 0)), "score": summary.get("score", 0),
                        "passed": summary.get("passed", 0), "total": summary.get("total", 0), "at": time.time(),
                        "by": st.id, "verified": verified}
        launch_if_ready(c)
        store.save_crew(c)
        store.audit(s.id, f"student:{st.id}", "crew_check", {"crew": c.id, "stars": summary.get("stars", 0)})

    @app.post("/api/crew/check")
    async def crew_check(body: CrewCheckIn, st: Student = Depends(student)) -> dict[str, Any]:
        """Server check of the crew program (the parts stored on the server) by the checker service."""
        s, c, mission = my_crew(st)
        if not checker.enabled():
            raise HTTPException(503, "Серверная проверка не включена: проверяем в браузере.")
        sources = {pid: part.get("source", "") for pid, part in c.parts.items()}
        try:
            result = await run_in_threadpool(checker.check_crew, mission, sources, body.hints)
        except checker.CheckError as exc:
            raise HTTPException(502, str(exc)) from exc
        c = store.crew(c.id) or c
        record(s, c, st, result.get("summary") or {}, True)
        await hub.push(store, s.id)
        return result

    @app.post("/api/crew/quiz")
    async def crew_quiz(body: CrewQuizIn, st: Student = Depends(student)) -> dict[str, Any]:
        """Museum quiz of the crew: one answer per question for the whole crew (discuss it in the chat first)."""
        s, c, mission = my_crew(st)
        question = crewlib.quiz_question(mission, museum, body.exhibit)
        if question is None:
            raise HTTPException(400, "В опросе экипажа нет такого вопроса")
        if body.exhibit in c.quiz:
            raise HTTPException(409, "Экипаж уже ответил на этот вопрос")
        if body.answer >= len(question["options"]):
            raise HTTPException(400, "Нет такого варианта ответа")
        correct = body.answer == int(question["answer"])
        c.quiz[body.exhibit] = {"answer": body.answer, "correct": correct, "by": st.id, "nick": st.nick,
                                "at": time.time()}
        store.save_crew(c)
        store.audit(s.id, f"student:{st.id}", "crew_quiz", {"crew": c.id, "exhibit": body.exhibit, "correct": correct})
        await hub.push(store, s.id)
        return {"correct": correct, "answer": int(question["answer"])}

    @app.post("/api/crew/result")
    async def crew_result(body: CrewResultIn, st: Student = Depends(student)) -> dict[str, Any]:
        """Without a checker service the browser judges the crew program and reports the summary."""
        s, c, _ = my_crew(st)
        if checker.enabled():
            raise HTTPException(409, "Программу экипажа проверяет сервер урока")
        record(s, c, st, body.model_dump(), False)
        await hub.push(store, s.id)
        return {"ok": True}

    # ---------------------------------------------------------------- websocket
    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket, token: str = "", role: str = "student", session: int = 0) -> None:
        if role == "teacher":
            if not store.teacher_ok(token) or store.session(session) is None:
                await ws.close(code=4401)
                return
            conn, sid = Conn(ws, "teacher"), session
        else:
            st = store.student(token)
            if st is None:
                await ws.close(code=4401)
                return
            conn, sid = Conn(ws, "student", st.id), st.session_id
        await ws.accept()
        hub.conns[sid].append(conn)
        await hub.push(store, sid, students=conn.role == "student")
        try:
            while True:
                msg = await ws.receive_json()
                if conn.student_id is not None and isinstance(msg, dict) and msg.get("type") == "ping":
                    st = store.student_by_id(conn.student_id)
                    if st:
                        st.last_seen = time.time()
                        store.save_student(st)
                await ws.send_json({"type": "pong"})
        except (WebSocketDisconnect, RuntimeError, ValueError):
            pass
        finally:
            if conn in hub.conns.get(sid, []):
                hub.conns[sid].remove(conn)
            await hub.push(store, sid, students=False)

    # ---------------------------------------------------------------- static frontend
    static = static_dir if static_dir is not None else ROOT / "frontend" / "dist"
    if static.exists():
        if (static / "assets").exists():
            app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            if path.startswith("api/"):
                raise HTTPException(404, "Нет такого адреса")
            target = (static / path).resolve()
            if path and target.is_file() and static.resolve() in target.parents:
                return FileResponse(target)
            return FileResponse(static / "index.html")

    return app
