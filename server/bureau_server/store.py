"""Storage for lesson sessions: SQLite (stdlib, the default: a classroom computer) or PostgreSQL.

PostgreSQL is used when the database is given as a URL (`postgres://…`, env DATABASE_URL): serverless hosting
(Vercel) has no persistent disk. The SQL is the same for both; the driver (psycopg 3) is imported only then.
One teacher password per server. Students are pseudonyms inside a session (no full names, 152-ФЗ).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .codes import make_code, normalize_code
from .crews import Crew

TEACHER_TOKEN_TTL = 12 * 3600
SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teacher_tokens (token TEXT PRIMARY KEY, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, code_norm TEXT NOT NULL, lesson INTEGER NOT NULL,
  mode TEXT NOT NULL, grp TEXT NOT NULL, state TEXT NOT NULL, created REAL NOT NULL, ended REAL);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, nick TEXT NOT NULL, nick_norm TEXT NOT NULL,
  avatar TEXT NOT NULL, token TEXT NOT NULL UNIQUE, joined REAL NOT NULL, last_seen REAL NOT NULL,
  progress TEXT NOT NULL, help REAL, grants TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, at REAL NOT NULL, session_id INTEGER, actor TEXT NOT NULL,
  action TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crews (
  id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, name TEXT NOT NULL, members TEXT NOT NULL,
  parts TEXT NOT NULL, result TEXT, launched REAL, chat TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0,
  checks INTEGER NOT NULL DEFAULT 0, quiz TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS code (
  student_id INTEGER NOT NULL, order_file TEXT NOT NULL, source TEXT NOT NULL, at REAL NOT NULL,
  result TEXT, PRIMARY KEY (student_id, order_file));
"""


def is_url(db: Path | str) -> bool:
    return str(db).startswith(("postgres://", "postgresql://"))


def pg_schema(schema: str) -> list[str]:
    """The SQLite schema in PostgreSQL types: autoincrement ids and floating timestamps."""
    sql = schema.replace("INTEGER PRIMARY KEY,", "BIGSERIAL PRIMARY KEY,").replace(" REAL", " DOUBLE PRECISION")
    return [x.strip() for x in sql.split(";") if x.strip()]


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt_hex)).split("$")[2], digest_hex)


def normalize_nick(nick: str) -> str:
    return " ".join(nick.lower().replace("ё", "е").split())


@dataclass
class Session:
    id: int
    code: str
    lesson: int
    mode: str                      # "sync" — teacher opens stages; "free" — own pace
    group: str
    open_stages: list[str] = field(default_factory=list)
    closed_orders: list[str] = field(default_factory=list)
    attention: dict[str, Any] = field(default_factory=lambda: {"on": False, "text": ""})
    message: dict[str, Any] | None = None
    poll: dict[str, Any] | None = None   # {id, question, options, open, answers: {student id: option}}
    created: float = 0.0
    ended: float | None = None

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "code": self.code, "lesson": self.lesson, "mode": self.mode,
                "group": self.group, "open_stages": self.open_stages, "closed_orders": self.closed_orders,
                "attention": self.attention, "message": self.message, "poll": poll_public(self.poll),
                "ended": self.ended is not None}


def poll_public(poll: dict[str, Any] | None) -> dict[str, Any] | None:
    """A poll without who answered what: only the counts per option (answers are anonymous for the class)."""
    if not poll:
        return None
    counts = [0] * len(poll["options"])
    for idx in poll.get("answers", {}).values():
        if 0 <= idx < len(counts):
            counts[idx] += 1
    return {"id": poll["id"], "question": poll["question"], "options": poll["options"], "open": poll["open"],
            "counts": counts, "total": sum(counts)}


@dataclass
class Student:
    id: int
    session_id: int
    nick: str
    avatar: str
    token: str
    joined: float
    last_seen: float
    progress: dict[str, Any]
    help: float | None
    grants: dict[str, Any]

    def view(self) -> dict[str, Any]:
        return {"id": self.id, "nick": self.nick, "avatar": self.avatar, "joined": self.joined,
                "last_seen": self.last_seen, "progress": self.progress, "help": self.help,
                "grants": self.grants}


class Store:
    def __init__(self, path: Path | str):
        self.path = str(path)
        self.lock = threading.Lock()
        self.pg = is_url(self.path)
        self.db: Any = None
        self._connect()
        if self.pg:
            with self.lock:
                for stmt in pg_schema(SCHEMA):
                    self.db.execute(stmt)
                self.db.execute("ALTER TABLE crews ADD COLUMN IF NOT EXISTS quiz TEXT NOT NULL DEFAULT '{}'")
            return
        self.db.executescript(SCHEMA)
        # Databases made before the museum quiz: add the column in place (SQLite has no ADD COLUMN IF NOT EXISTS).
        if "quiz" not in {r["name"] for r in self.db.execute("PRAGMA table_info(crews)")}:
            self.db.execute("ALTER TABLE crews ADD COLUMN quiz TEXT NOT NULL DEFAULT '{}'")
        self.db.commit()

    def _connect(self) -> None:
        if self.pg:
            import psycopg  # only for PostgreSQL hosting (requirements-vercel.txt)
            from psycopg.rows import dict_row
            self.db = psycopg.connect(self.path, autocommit=True, row_factory=dict_row, prepare_threshold=None)
        else:
            self.db = sqlite3.connect(self.path, check_same_thread=False)
            self.db.row_factory = sqlite3.Row

    # ------------------------------------------------------------ helpers
    def _exec(self, sql: str, args: tuple[Any, ...]) -> Any:
        if not self.pg:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur
        sql = sql.replace("?", "%s")
        try:
            return self.db.execute(sql, args)
        except Exception as exc:  # noqa: BLE001 — a serverless instance may wake up with a dropped connection
            if not getattr(self.db, "closed", False) and type(exc).__name__ not in ("OperationalError", "InterfaceError"):
                raise
            self._connect()
            return self.db.execute(sql, args)

    def _q(self, sql: str, args: tuple[Any, ...] = ()) -> list[Any]:
        with self.lock:
            cur = self._exec(sql, args)
            return cur.fetchall() if cur.description else []

    def _ins(self, sql: str, args: tuple[Any, ...]) -> int:
        """INSERT into a table with an autoincrement id; returns the id."""
        with self.lock:
            if self.pg:
                return int(self._exec(sql + " RETURNING id", args).fetchone()["id"])
            return int(self._exec(sql, args).lastrowid or 0)

    def audit(self, session_id: int | None, actor: str, action: str, data: dict[str, Any]) -> None:
        self._ins("INSERT INTO audit (at, session_id, actor, action, data) VALUES (?, ?, ?, ?, ?)",
                  (time.time(), session_id, actor, action, json.dumps(data, ensure_ascii=False)))

    def audit_log(self, session_id: int) -> list[dict[str, Any]]:
        rows = self._q("SELECT at, actor, action, data FROM audit WHERE session_id = ? ORDER BY id", (session_id,))
        return [{"at": r["at"], "actor": r["actor"], "action": r["action"], "data": json.loads(r["data"])}
                for r in rows]

    # ------------------------------------------------------------ teacher
    def has_password(self) -> bool:
        return bool(self._q("SELECT 1 FROM settings WHERE key = 'teacher_password'"))

    def set_password(self, password: str) -> None:
        self._q("INSERT INTO settings (key, value) VALUES ('teacher_password', ?) "
                "ON CONFLICT (key) DO UPDATE SET value = excluded.value", (hash_password(password),))
        self._q("DELETE FROM teacher_tokens")

    def ensure_password(self, password: str) -> None:
        """Set the password from the environment only if it changed: a restart must not log the teacher out."""
        if not self.check_password(password):
            self.set_password(password)

    def check_password(self, password: str) -> bool:
        rows = self._q("SELECT value FROM settings WHERE key = 'teacher_password'")
        return bool(rows) and verify_password(password, rows[0]["value"])

    def new_teacher_token(self) -> str:
        token = secrets.token_urlsafe(24)
        self._q("DELETE FROM teacher_tokens WHERE expires < ?", (time.time(),))
        self._q("INSERT INTO teacher_tokens (token, expires) VALUES (?, ?)", (token, time.time() + TEACHER_TOKEN_TTL))
        return token

    def teacher_ok(self, token: str | None) -> bool:
        if not token:
            return False
        return bool(self._q("SELECT 1 FROM teacher_tokens WHERE token = ? AND expires > ?", (token, time.time())))

    # ------------------------------------------------------------ sessions
    def _session(self, row: Any) -> Session:
        st = json.loads(row["state"])
        return Session(id=row["id"], code=row["code"], lesson=row["lesson"], mode=row["mode"], group=row["grp"],
                       open_stages=st.get("open_stages", []), closed_orders=st.get("closed_orders", []),
                       attention=st.get("attention", {"on": False, "text": ""}), message=st.get("message"),
                       poll=st.get("poll"), created=row["created"], ended=row["ended"])

    def create_session(self, lesson: int, mode: str, group: str) -> Session:
        taken = {r["code_norm"] for r in self._q("SELECT code_norm FROM sessions WHERE ended IS NULL")}
        code = make_code(taken)
        state = {"open_stages": [], "closed_orders": [], "attention": {"on": False, "text": ""}, "message": None}
        sid = self._ins("INSERT INTO sessions (code, code_norm, lesson, mode, grp, state, created) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (code, normalize_code(code), lesson, mode, group, json.dumps(state), time.time()))
        return self.session(sid)  # type: ignore[return-value]

    def session(self, sid: int) -> Session | None:
        rows = self._q("SELECT * FROM sessions WHERE id = ?", (sid,))
        return self._session(rows[0]) if rows else None

    def session_by_code(self, raw: str) -> Session | None:
        rows = self._q("SELECT * FROM sessions WHERE code_norm = ? AND ended IS NULL ORDER BY id DESC",
                       (normalize_code(raw),))
        return self._session(rows[0]) if rows else None

    def sessions(self, active_only: bool = True) -> list[Session]:
        sql = "SELECT * FROM sessions" + (" WHERE ended IS NULL" if active_only else "") + " ORDER BY id DESC"
        return [self._session(r) for r in self._q(sql)]

    def save_session(self, s: Session) -> None:
        state = {"open_stages": s.open_stages, "closed_orders": s.closed_orders,
                 "attention": s.attention, "message": s.message, "poll": s.poll}
        self._q("UPDATE sessions SET mode = ?, grp = ?, state = ?, ended = ? WHERE id = ?",
                (s.mode, s.group, json.dumps(state, ensure_ascii=False), s.ended, s.id))

    # ------------------------------------------------------------ students
    def _student(self, row: Any) -> Student:
        return Student(id=row["id"], session_id=row["session_id"], nick=row["nick"], avatar=row["avatar"],
                       token=row["token"], joined=row["joined"], last_seen=row["last_seen"],
                       progress=json.loads(row["progress"]), help=row["help"], grants=json.loads(row["grants"]))

    def join(self, session: Session, nick: str, avatar: str) -> Student:
        """Join by pseudonym; the same pseudonym in the same session continues (switching computers)."""
        norm = normalize_nick(nick)
        rows = self._q("SELECT * FROM students WHERE session_id = ? AND nick_norm = ?", (session.id, norm))
        now = time.time()
        if rows:
            st = self._student(rows[0])
            token = secrets.token_urlsafe(24)
            self._q("UPDATE students SET token = ?, avatar = ?, last_seen = ? WHERE id = ?", (token, avatar, now, st.id))
            return self.student(token)  # type: ignore[return-value]
        token = secrets.token_urlsafe(24)
        self._ins("INSERT INTO students (session_id, nick, nick_norm, avatar, token, joined, last_seen, progress, "
                  "help, grants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
                  (session.id, " ".join(nick.split()), norm, avatar, token, now, now, "{}", json.dumps({"accepted": []})))
        return self.student(token)  # type: ignore[return-value]

    def student(self, token: str | None) -> Student | None:
        if not token:
            return None
        rows = self._q("SELECT * FROM students WHERE token = ?", (token,))
        return self._student(rows[0]) if rows else None

    def student_by_id(self, sid: int) -> Student | None:
        rows = self._q("SELECT * FROM students WHERE id = ?", (sid,))
        return self._student(rows[0]) if rows else None

    def students(self, session_id: int) -> list[Student]:
        return [self._student(r) for r in self._q("SELECT * FROM students WHERE session_id = ? ORDER BY nick_norm",
                                                  (session_id,))]

    def save_student(self, st: Student) -> None:
        self._q("UPDATE students SET last_seen = ?, progress = ?, help = ?, grants = ? WHERE id = ?",
                (st.last_seen, json.dumps(st.progress, ensure_ascii=False), st.help,
                 json.dumps(st.grants, ensure_ascii=False), st.id))

    # ------------------------------------------------------------ code snapshots (read-only for the teacher)
    def save_code(self, student_id: int, order_file: str, source: str, result: dict[str, Any] | None = None) -> None:
        self._q("INSERT INTO code (student_id, order_file, source, at, result) VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT (student_id, order_file) DO UPDATE SET source = excluded.source, at = excluded.at, "
                "result = excluded.result",
                (student_id, order_file, source, time.time(),
                 json.dumps(result, ensure_ascii=False) if result is not None else None))

    def codes(self, student_id: int) -> list[dict[str, Any]]:
        rows = self._q("SELECT order_file, source, at, result FROM code WHERE student_id = ? ORDER BY at DESC",
                       (student_id,))
        return [{"order": r["order_file"], "source": r["source"], "at": r["at"],
                 "result": json.loads(r["result"]) if r["result"] else None} for r in rows]

    # ------------------------------------------------------------ crews (team «Конец смены»)
    @staticmethod
    def _crew(row: Any) -> Crew:
        return Crew(id=row["id"], session_id=row["session_id"], name=row["name"], members=json.loads(row["members"]),
                    parts=json.loads(row["parts"]), result=json.loads(row["result"]) if row["result"] else None,
                    launched=row["launched"], chat=json.loads(row["chat"]), accepted=bool(row["accepted"]),
                    checks=row["checks"], quiz=json.loads(row["quiz"] or "{}"))

    def crews(self, session_id: int) -> list[Crew]:
        return [self._crew(r) for r in self._q("SELECT * FROM crews WHERE session_id = ? ORDER BY id", (session_id,))]

    def crew(self, crew_id: int) -> Crew | None:
        rows = self._q("SELECT * FROM crews WHERE id = ?", (crew_id,))
        return self._crew(rows[0]) if rows else None

    def crew_of(self, session_id: int, student_id: int) -> Crew | None:
        return next((c for c in self.crews(session_id) if student_id in c.members), None)

    def add_crew(self, session_id: int, name: str, members: list[int]) -> Crew:
        cid = self._ins("INSERT INTO crews (session_id, name, members, parts, chat) VALUES (?, ?, ?, '{}', '[]')",
                        (session_id, name, json.dumps(members)))
        return self.crew(cid)  # type: ignore[return-value]

    def save_crew(self, c: Crew) -> None:
        self._q("UPDATE crews SET name = ?, members = ?, parts = ?, result = ?, launched = ?, chat = ?, accepted = ?, "
                "checks = ?, quiz = ? WHERE id = ?",
                (c.name, json.dumps(c.members), json.dumps(c.parts, ensure_ascii=False),
                 json.dumps(c.result, ensure_ascii=False) if c.result is not None else None, c.launched,
                 json.dumps(c.chat, ensure_ascii=False), int(c.accepted), c.checks,
                 json.dumps(c.quiz, ensure_ascii=False), c.id))

    def delete_crew(self, crew_id: int) -> None:
        self._q("DELETE FROM crews WHERE id = ?", (crew_id,))

    def delete_crews(self, session_id: int) -> None:
        self._q("DELETE FROM crews WHERE session_id = ?", (session_id,))
