"""Content linter for the course «Поехали!».

Checks (PROMPT.md §1.1, §3.2, §4.4, §15):
  * schema basics of lessons, dialogues, orders;
  * «air» rules: a reply ≤ 35 words, a paragraph ≤ 2 sentences, ≤ 1 new term per reply;
  * glossary: every [[term]] exists and belongs to this or an earlier lesson;
  * sequence: requires[] must be introduced earlier; skills exist; skill graph has no cycles;
  * rhythm: ≤ 4 replies in a row without an interactive check;
  * allowed_constructs: reference solutions and shown code use only allowed AST constructs;
  * order autotest: reference gets 5★ on all cases, starters fail ≥ 1 case,
    hidden cases have complaint + requirement_id, hints don't leak the solution;
  * museum: exhibits cite facts from docs/space-facts.md and unlock by known stages/orders; every exhibit has
    1–2 quiz questions; a client's museum question (`museum` of an order) and the crew quiz (`quiz` of a crew
    mission) only ask about exhibits that are already open at that moment;
  * quotes of the day (content/quotes.json): a `quote` node of a closing scene points to a known quote;
  * crew missions (content/crews): 2–4 parts, the joined reference gets 5★, joined templates fail,
    each `crew` node of a closing scene points to the mission of its lesson.

Usage: python tools/lint_content.py [content_dir] [--assume-prev]   (exit code 1 on errors)
  --assume-prev  skills of earlier lessons count as introduced (for writing several lessons in parallel;
                 the final check runs without it)
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "judge"))

from judge import code_text, crew_source, disallowed, run_code, run_crew, run_order  # noqa: E402

MAX_WORDS = 35
MAX_SENTENCES = 2
MAX_SAYS_IN_ROW = 4
NODE_TYPES = {"say", "narrate", "check", "choice", "jump", "flag", "end",
              "scene", "enter", "exit", "board", "input", "avatar", "unlock", "launch", "crew", "quote"}
LOCATIONS = {"street", "reception", "board", "desk", "counter", "studio", "launch"}
FEATURES = {"phone", "notebook", "vika_chat", "mail", "reviews", "shop", "skills", "settings",
            "studio", "desk", "orders", "board", "door", "coins", "museum", "orbit"}
HOTSPOTS = {"orders", "desk", "board", "cabinet", "mail", "shop", "reviews", "door", "museum", "orbit"}
ROLES = {"staff", "client"}
FACT_ROW_RE = re.compile(r"^\|\s*([a-z0-9_]+)\s*\|", re.MULTILINE)
MAX_BOARD_LINES = 6
MAX_BOARD_WORDS = 14
CHECK_KINDS = {"single", "multi", "predict", "order", "fill", "find_bug", "tiny_code", "match"}
ORDER_KINDS = {"regular", "boss", "bugreport", "refactor", "urgent", "team", "review"}
TERM_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
CODE_RE = re.compile(r"`[^`]*`")


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def err(self, where: str, text: str) -> None:
        self.errors.append(f"{where}: {text}")


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def words(text: str) -> int:
    plain = TERM_RE.sub(lambda m: m.group(1), CODE_RE.sub("код", text))
    return len(re.findall(r"[\wёЁ\-]+", plain))


def sentences(paragraph: str) -> int:
    plain = CODE_RE.sub("код", paragraph)
    plain = re.sub(r"\.\.\.|…", "", plain)
    parts = [p for p in re.split(r"[.!?]+(?:\s|$)", plain.strip()) if p.strip()]
    return len(parts)


def check_text(rep: Report, where: str, text: str) -> None:
    if words(text) > MAX_WORDS:
        rep.err(where, f"реплика длиннее {MAX_WORDS} слов ({words(text)})")
    for para in text.split("\n"):
        if para.strip() and sentences(para) > MAX_SENTENCES:
            rep.err(where, f"в абзаце больше {MAX_SENTENCES} предложений: «{para[:50]}…»")


def find_cycle(graph: dict[str, list[str]]) -> list[str] | None:
    state: dict[str, int] = {}
    stack: list[str] = []

    def visit(node: str) -> list[str] | None:
        state[node] = 1
        stack.append(node)
        for nxt in graph.get(node, []):
            if state.get(nxt) == 1:
                return stack[stack.index(nxt):] + [nxt]
            if state.get(nxt) is None:
                found = visit(nxt)
                if found:
                    return found
        state[node] = 2
        stack.pop()
        return None

    for node in graph:
        if state.get(node) is None:
            found = visit(node)
            if found:
                return found
    return None


class Linter:
    def __init__(self, content: Path, assume_prev: bool = False):
        self.content = content
        self.assume_prev = assume_prev
        self.rep = Report()
        self.skills = {s["id"]: s for s in load(content / "skills.json")}
        self.glossary = {}
        for g in load(content / "glossary.json"):
            for form in [g["term"], *g.get("forms", [])]:
                self.glossary[form.lower()] = g
        self.characters = load(content / "characters.json")
        for cid, ch in self.characters.items():
            if ch.get("role") not in ROLES:
                self.rep.err(f"characters.json: {cid}", f"неизвестная роль {ch.get('role')}")
        facts = content.parent / "docs" / "space-facts.md"
        self.facts: set[str] | None = (
            set(FACT_ROW_RE.findall(facts.read_text(encoding="utf-8"))) - {"id"} if facts.exists() else None)
        self.stage_ids: dict[int, set[str]] = {}
        self.order_files: set[str] = set()
        self.known: set[str] = set()
        self.seen_terms: set[str] = set()
        self.allowed: set[str] = set()
        crew_dir = content / "crews"
        self.crews: dict[str, dict[str, Any]] = (
            {p.stem: load(p) for p in sorted(crew_dir.glob("*.json"))} if crew_dir.exists() else {})
        self.crew_used: set[str] = set()
        quotes = content / "quotes.json"
        self.quotes: dict[str, dict[str, Any]] = {q["id"]: q for q in load(quotes)} if quotes.exists() else {}
        self.stage_order: dict[int, list[str]] = {}
        self.lesson_orders: dict[int, set[str]] = {}
        self.lesson_stages: list[dict[str, Any]] = []
        # Museum questions to check once all lessons are known: (where, exhibit, question, lesson, stage, order).
        self.museum_refs: list[tuple[str, str, Any, int, str, str | None]] = []

    # ------------------------------------------------------------- helpers
    def terms_in(self, where: str, text: str, lesson_no: int) -> None:
        new = 0
        for m in TERM_RE.finditer(text):
            term = m.group(1).strip().lower()
            g = self.glossary.get(term)
            if g is None:
                self.rep.err(where, f"термина «{term}» нет в глоссарии")
                continue
            if g["lesson"] > lesson_no:
                self.rep.err(where, f"термин «{term}» относится к занятию {g['lesson']}")
            if g["term"] not in self.seen_terms:
                new += 1
                self.seen_terms.add(g["term"])
        if new > 1:
            self.rep.err(where, f"больше одного нового термина в реплике ({new})")

    def require(self, where: str, item: dict[str, Any]) -> None:
        for tag in item.get("requires", []) + item.get("introduces", []):
            if tag not in self.skills:
                self.rep.err(where, f"неизвестный навык «{tag}» (нет в skills.json)")
        missing = [t for t in item.get("requires", []) if t not in self.known]
        if missing:
            self.rep.err(where, f"требует ещё не введённые навыки: {', '.join(missing)}")
        self.known |= set(item.get("introduces", []))

    def constructs(self, where: str, source: str) -> None:
        try:
            bad = disallowed(source, self.allowed)
        except SyntaxError as exc:
            self.rep.err(where, f"код не разбирается: {exc.msg}")
            return
        if bad:
            self.rep.err(where, f"конструкции вне allowed_constructs: {', '.join(sorted(bad))}")

    # ------------------------------------------------------------ dialogues
    def dialogue(self, did: str, lesson_no: int) -> None:
        path = self.content / "dialogues" / f"{did}.json"
        if not path.exists():
            self.rep.err(did, "файл диалога не найден")
            return
        d = load(path)
        diagnostic = d.get("diagnostic", False)
        ids = {n["id"] for n in d["nodes"]}
        in_row = 0
        for n in d["nodes"]:
            where = f"{did}#{n['id']}"
            t = n.get("type")
            if t not in NODE_TYPES:
                self.rep.err(where, f"неизвестный тип узла {t}")
                continue
            for key in ("next",):
                if key in n and n[key] not in ids:
                    self.rep.err(where, f"переход на несуществующий узел {n[key]}")
            if t in ("say", "narrate"):
                if t == "say" and n.get("who") not in self.characters and n.get("who") != "player":
                    self.rep.err(where, f"неизвестный персонаж {n.get('who')}")
                check_text(self.rep, where, n["text"])
                self.terms_in(where, n["text"], lesson_no)
                in_row += 1
                if in_row > MAX_SAYS_IN_ROW:
                    self.rep.err(where, f"больше {MAX_SAYS_IN_ROW} реплик подряд без выбора или проверки")
            elif t == "choice":
                in_row = 0
                if not n.get("options"):
                    self.rep.err(where, "у выбора нет вариантов")
                for o in n.get("options", []):
                    check_text(self.rep, f"{where}.option", o["text"])
                    if o.get("next") and o["next"] not in ids:
                        self.rep.err(where, f"выбор ведёт на несуществующий узел {o['next']}")
            elif t in ("input", "avatar"):
                in_row = 0
                if t == "input" and n.get("field") not in ("nick", "group"):
                    self.rep.err(where, f"неизвестное поле ввода {n.get('field')}")
            elif t == "scene":
                if n.get("location") not in LOCATIONS:
                    self.rep.err(where, f"неизвестная локация {n.get('location')}")
                for c in n.get("cast", []):
                    if c.get("who") not in self.characters:
                        self.rep.err(where, f"неизвестный персонаж в сцене {c.get('who')}")
            elif t in ("enter", "exit"):
                if n.get("who") not in self.characters:
                    self.rep.err(where, f"неизвестный персонаж {n.get('who')}")
            elif t == "board":
                lines = n.get("lines", [])
                if len(lines) > MAX_BOARD_LINES:
                    self.rep.err(where, f"на доске больше {MAX_BOARD_LINES} строк")
                for line in lines:
                    if words(line) > MAX_BOARD_WORDS:
                        self.rep.err(where, f"строка доски длиннее {MAX_BOARD_WORDS} слов: «{line[:40]}»")
            elif t == "unlock":
                if n.get("feature") not in FEATURES:
                    self.rep.err(where, f"неизвестная функция для открытия {n.get('feature')}")
            elif t == "launch":
                if not n.get("craft"):
                    self.rep.err(where, "у запуска нет названия аппарата (craft)")
            elif t == "crew":
                in_row = 0
                mission = self.crews.get(n.get("mission", ""))
                if mission is None:
                    self.rep.err(where, f"нет командной миссии {n.get('mission')} в content/crews")
                elif mission.get("lesson") != lesson_no:
                    self.rep.err(where, f"миссия {n.get('mission')} относится к занятию {mission.get('lesson')}")
                else:
                    self.crew_used.add(n["mission"])
            elif t == "quote":
                in_row = 0
                if n.get("quote") not in self.quotes:
                    self.rep.err(where, f"нет цитаты {n.get('quote')} в content/quotes.json")
            elif t == "check":
                in_row = 0
                self.check(where, n["check"], lesson_no, diagnostic)

    def check(self, where: str, c: dict[str, Any], lesson_no: int, diagnostic: bool) -> None:
        kind = c.get("kind")
        if kind not in CHECK_KINDS:
            self.rep.err(where, f"неизвестный тип проверки {kind}")
            return
        for key in ("prompt", "feedback_correct", "feedback_wrong", "hint", "explain"):
            if not c.get(key):
                self.rep.err(where, f"у проверки нет поля {key}")
            elif key != "prompt":
                check_text(self.rep, f"{where}.{key}", c[key])
        if not diagnostic:
            self.require(where, c)
        if kind in ("single", "multi"):
            n = len(c.get("options", []))
            answers = c["answer"] if isinstance(c["answer"], list) else [c["answer"]]
            if any(not 0 <= a < n for a in answers):
                self.rep.err(where, "ответ вне списка вариантов")
        if kind in ("predict", "find_bug", "order", "fill", "tiny_code") and not diagnostic:
            src = self.check_code(c)
            if src:
                self.constructs(where, src)
        if kind == "predict":
            res = run_code(code_text(c["code"]), c.get("stdin", []))
            if res["error"]:
                self.rep.err(where, f"код predict падает: {res['error']['type']}")
        if kind == "tiny_code":
            ref = run_code(code_text(c["reference"]), c.get("stdin", []))
            if [ln.rstrip() for ln in ref["stdout"].rstrip("\n").split("\n")] != c["expected_stdout"]:
                self.rep.err(where, "эталон tiny_code не даёт expected_stdout")
        if kind == "find_bug":
            lines = c["code"] if isinstance(c["code"], list) else c["code"].split("\n")
            if not 1 <= c["answer"] <= len(lines):
                self.rep.err(where, "номер строки с багом вне кода")
        if kind == "fill":
            slots = len(re.findall(r"\{\{\d+\}\}", code_text(c["code"])))
            if slots != len(c["answer"]):
                self.rep.err(where, "число пропусков не совпадает с ответами")
        if kind == "match" and len(c.get("pairs", [])) < 2:
            self.rep.err(where, "в match меньше двух пар")

    @staticmethod
    def check_code(c: dict[str, Any]) -> str:
        kind = c["kind"]
        if kind == "predict" or kind == "find_bug":
            return code_text(c["code"]) if kind == "predict" else ""
        if kind == "order":
            return code_text(c["lines"])
        if kind == "fill":
            src = code_text(c["code"])
            for i, chip in enumerate(c["answer"]):
                src = src.replace("{{%d}}" % i, c["chips"][chip])
            return src
        if kind == "tiny_code":
            return code_text(c["reference"])
        return ""

    # --------------------------------------------------------------- orders
    def order(self, path: Path, lesson_no: int) -> None:
        o = load(path)
        where = f"заказ {o.get('id', path.stem)}"
        for key in ("id", "lesson", "order_no", "kind", "client_id", "title", "pitch",
                    "requirements", "cases", "hints", "requires", "introduces",
                    "reference_solution", "scaffold_level"):
            if key not in o:
                self.rep.err(where, f"нет поля {key}")
        if o.get("kind") not in ORDER_KINDS:
            self.rep.err(where, f"неизвестный вид заказа {o.get('kind')}")
        if o.get("client_id") not in self.characters:
            self.rep.err(where, f"неизвестный клиент {o.get('client_id')}")
        for i, line in enumerate(o.get("pitch", [])):
            check_text(self.rep, f"{where}.pitch[{i}]", line)
            self.terms_in(f"{where}.pitch[{i}]", line, lesson_no)
        if len(o.get("hints", [])) != 3:
            self.rep.err(where, "подсказок должно быть ровно 3")
        clarify = o.get("clarify")
        if clarify:
            opts = clarify["options"]
            if not 4 <= len(opts) <= 5:
                self.rep.err(where, "в уточнении должно быть 4–5 вопросов")
            rel = [x for x in opts if x.get("relevant")]
            if not 2 <= len(rel) <= 3:
                self.rep.err(where, "нужных вопросов должно быть 2–3")
            for x in opts:
                check_text(self.rep, f"{where}.clarify", x["reply"])
                if x.get("adds_requirement") and x["adds_requirement"] not in {r["id"] for r in o["requirements"]}:
                    self.rep.err(where, f"уточнение ссылается на неизвестное требование {x['adds_requirement']}")
        if o.get("warmup"):
            self.check(f"{where}.warmup", o["warmup"], lesson_no, False)
        self.require(where, o)
        req_ids = {r["id"] for r in o.get("requirements", [])}
        for c in o.get("cases", []):
            cw = f"{where}.case {c['id']}"
            if c.get("requirement_id") not in req_ids:
                self.rep.err(cw, "нет requirement_id или он не из requirements")
            if c.get("hidden") and not c.get("complaint"):
                self.rep.err(cw, "у скрытого кейса нет complaint")
            for key in ("complaint", "approve"):
                if c.get(key):
                    check_text(self.rep, f"{cw}.{key}", c[key])
        if not any(c.get("hidden") for c in o.get("cases", [])):
            self.rep.err(where, "нет ни одного скрытого кейса")
        ref = code_text(o.get("reference_solution", ""))
        self.constructs(f"{where}.reference", ref)
        relevant = [i for i, x in enumerate((clarify or {}).get("options", [])) if x.get("relevant")]
        res = run_order(ref, o, hints_used=0, clarify_chosen=relevant)
        if res["summary"]["stars"] != 5 or res["summary"]["passed"] != res["summary"]["total"]:
            failed = [c["id"] for c in res["cases"] if not c["passed"]]
            self.rep.err(where, f"эталон не получает 5★ (балл {res['summary']['score']}, "
                         f"провалены {failed}, ast {[a['text'] for a in res['ast_report'] if not a['ok']]}, "
                         f"стиль {[s['code'] for s in res['style_report']]})")
        starters = {"write": o.get("starter_code")}
        if o.get("fill_code"):
            starters["fill"] = o["fill_code"]
        for name, starter in starters.items():
            if starter is None:
                continue
            sres = run_order(code_text(starter), o)
            if sres["summary"]["passed"] == sres["summary"]["total"]:
                self.rep.err(where, f"шаблон «{name}» проходит все кейсы — заданию нечего делать")
        if o.get("parsons_lines"):
            good = [ln["code"] for ln in o["parsons_lines"] if not ln.get("distractor")]
            pres = run_order(code_text(good), o)
            if pres["summary"]["passed"] != pres["summary"]["total"]:
                self.rep.err(where, "строки Парсонса (без лишних) в исходном порядке не решают заказ")
        ref_lines = [ln.strip() for ln in code_text(ref).split("\n") if len(ln.strip()) > 12]
        for h in o.get("hints", []):
            check_text(self.rep, f"{where}.hint", h)
            if any(line in h for line in ref_lines):
                self.rep.err(where, f"подсказка содержит строку эталона: «{h[:40]}…»")
        museum = o.get("museum")
        if museum is not None:
            if not museum.get("ask"):
                self.rep.err(where, "у вопроса по музею нет реплики заказчика (ask)")
            else:
                check_text(self.rep, f"{where}.museum.ask", museum["ask"])
            stage = next((st["id"] for st in self.lesson_stages if path.stem in st.get("orders", [])), "orders")
            self.museum_refs.append((f"{where}.museum", museum.get("exhibit", ""), museum.get("question"),
                                     lesson_no, stage, path.stem))

    # --------------------------------------------------------------- course
    def run(self) -> Report:
        graph = {sid: s.get("requires", []) for sid, s in self.skills.items()}
        cycle = find_cycle(graph)
        if cycle:
            self.rep.err("skills.json", f"цикл зависимостей навыков: {' → '.join(cycle)}")
        lessons = sorted((self.content / "lessons").glob("*.json"),
                         key=lambda p: load(p)["number"])
        for lp in lessons:
            lesson = load(lp)
            no = lesson["number"]
            self.allowed |= set(lesson["allowed_constructs"])
            if self.assume_prev:
                self.known |= {sid for sid, s in self.skills.items() if s.get("lesson", 0) < no}
            for key in ("title", "goal", "result", "competencies", "program_lines", "timing",
                        "stages", "notebook", "reflection"):
                if key not in lesson:
                    self.rep.err(lp.name, f"нет поля {key}")
            if sum(m for _, m in lesson.get("timing", [])) != 90:
                self.rep.err(lp.name, "тайминг занятия должен давать 90 минут")
            self.lesson_stages = lesson["stages"]
            self.stage_order[no] = [st["id"] for st in lesson["stages"]]
            for st in lesson["stages"]:
                self.stage_ids.setdefault(no, set()).add(st["id"])
                self.order_files |= set(st.get("orders", []))
                self.lesson_orders.setdefault(no, set()).update(st.get("orders", []))
                if st.get("hotspot") and st["hotspot"] not in HOTSPOTS:
                    self.rep.err(lp.name, f"этап {st['id']}: неизвестный объект студии {st['hotspot']}")
                for f in st.get("unlocks", []):
                    if f not in FEATURES:
                        self.rep.err(lp.name, f"этап {st['id']}: неизвестная функция {f}")
                if st.get("dialogue"):
                    self.dialogue(st["dialogue"], no)
                for oid in st.get("orders", []):
                    op = self.content / "orders" / f"{oid}.json"
                    if not op.exists():
                        self.rep.err(lp.name, f"заказ {oid} не найден")
                        continue
                    self.order(op, no)
            for cid, mission in self.crews.items():
                if mission.get("lesson") == no:
                    self.crew(cid, mission, no)
            for card in lesson.get("notebook", []):
                body = [card.get("syntax", ""), card.get("example", ""), card.get("mistake", "")]
                n_lines = sum(len(code_text(b).rstrip("\n").split("\n")) for b in body if b)
                if n_lines > 5:
                    self.rep.err(f"{lp.name}: карточка {card['id']}", "карточка длиннее 5 строк")
                # The notebook shows a card once its skill is introduced: `skills`, or the card id itself.
                for tag in card.get("skills", [card["id"]]):
                    if tag not in self.skills:
                        self.rep.err(f"{lp.name}: карточка {card['id']}", f"неизвестный навык «{tag}» (поле skills)")
        self.museum()
        self.quotes_check()
        for cid in sorted(set(self.crews) - self.crew_used):
            self.rep.err(f"команда {cid}", "миссия не используется ни в одной сцене (узел crew)")
        return self.rep

    # --------------------------------------------------------------- crew missions
    def crew(self, cid: str, m: dict[str, Any], lesson_no: int) -> None:
        where = f"команда {cid}"
        for key in ("id", "lesson", "title", "craft", "client_id", "brief", "parts", "requirements", "cases", "hints"):
            if key not in m:
                self.rep.err(where, f"нет поля {key}")
        if m.get("id") != cid:
            self.rep.err(where, "id не совпадает с именем файла")
        if m.get("client_id") not in self.characters:
            self.rep.err(where, f"неизвестный заказчик {m.get('client_id')}")
        for i, line in enumerate(m.get("brief", [])):
            check_text(self.rep, f"{where}.brief[{i}]", line)
        parts = m.get("parts", [])
        if not 2 <= len(parts) <= 4:
            self.rep.err(where, "частей должно быть от 2 до 4")
        if len({p.get("id") for p in parts}) != len(parts):
            self.rep.err(where, "повторяющиеся id частей")
        for p in parts:
            for key in ("id", "role", "title", "task", "template", "reference"):
                if key not in p:
                    self.rep.err(f"{where}.{p.get('id')}", f"нет поля {key}")
            check_text(self.rep, f"{where}.{p.get('id')}.task", p.get("task", ""))
        if len(m.get("hints", [])) != 3:
            self.rep.err(where, "подсказок должно быть ровно 3")
        for tag in m.get("requires", []):
            if tag not in self.skills:
                self.rep.err(where, f"неизвестный навык «{tag}»")
            elif not self.assume_prev and tag not in self.known:
                self.rep.err(where, f"требует ещё не введённый навык {tag}")
        req_ids = {r["id"] for r in m.get("requirements", [])}
        for c in m.get("cases", []):
            cw = f"{where}.case {c['id']}"
            if c.get("requirement_id") not in req_ids:
                self.rep.err(cw, "нет requirement_id или он не из requirements")
            if c.get("hidden") and not c.get("complaint"):
                self.rep.err(cw, "у скрытого кейса нет complaint")
            for key in ("complaint", "approve"):
                if c.get(key):
                    check_text(self.rep, f"{cw}.{key}", c[key])
        if not any(c.get("hidden") for c in m.get("cases", [])):
            self.rep.err(where, "нет ни одного скрытого кейса")
        ref = {p["id"]: code_text(p.get("reference", "")) for p in parts if "id" in p}
        joined = crew_source(m, ref)
        self.constructs(f"{where}.reference", joined)
        res = run_crew(m, ref)
        if res["summary"]["stars"] != 5 or res["summary"]["passed"] != res["summary"]["total"]:
            self.rep.err(where, f"эталон экипажа не получает 5★ (балл {res['summary']['score']}, "
                         f"стиль {[s['code'] for s in res['style_report']]})")
        tres = run_crew(m, {})
        if tres["summary"]["passed"] == tres["summary"]["total"]:
            self.rep.err(where, "шаблоны частей проходят все кейсы — экипажу нечего делать")
        ref_lines = [ln.strip() for ln in joined.splitlines() if len(ln.strip()) > 12]
        for h in m.get("hints", []):
            check_text(self.rep, f"{where}.hint", h)
            if any(line in h for line in ref_lines):
                self.rep.err(where, f"подсказка содержит строку эталона: «{h[:40]}…»")
        quiz = m.get("quiz", [])
        if not 2 <= len(quiz) <= 5:
            self.rep.err(where, "в музейном опросе экипажа должно быть 2–5 вопросов")
        if len({x.get("exhibit") for x in quiz}) != len(quiz):
            self.rep.err(where, "в музейном опросе повторяется экспонат")
        for i, x in enumerate(quiz):
            # The crew node lives in the closing scene: exhibits of the closing itself are not open yet.
            self.museum_refs.append((f"{where}.quiz[{i}]", x.get("exhibit", ""), x.get("question"), lesson_no,
                                     "closing", None))

    # --------------------------------------------------------------- museum
    def museum(self) -> None:
        path = self.content / "museum.json"
        if not path.exists():
            return
        seen: set[str] = set()
        exhibits = {ex.get("id"): ex for ex in load(path)}
        for ex in exhibits.values():
            where = f"museum.json: {ex.get('id')}"
            if ex.get("id") in seen:
                self.rep.err(where, "повторяющийся id экспоната")
            seen.add(ex.get("id"))
            for key in ("id", "title", "text", "fact", "unlock"):  # year is optional
                if key not in ex:
                    self.rep.err(where, f"нет поля {key}")
            if ex.get("text"):
                check_text(self.rep, where, ex["text"])
            if self.facts is not None and ex.get("fact") not in self.facts:
                self.rep.err(where, f"факта «{ex.get('fact')}» нет в docs/space-facts.md")
            unlock = ex.get("unlock", {})
            if unlock == "start":
                continue
            if not isinstance(unlock, dict) or not (unlock.get("stage") or unlock.get("order")):
                self.rep.err(where, "unlock: \"start\", {\"stage\": id} или {\"order\": файл}")
            elif unlock.get("stage") and unlock["stage"] not in self.stage_ids.get(unlock.get("lesson", 0), set()):
                self.rep.err(where, f"неизвестный этап {unlock['stage']} в занятии {unlock.get('lesson', 0)}")
            elif unlock.get("order") and unlock["order"] not in self.order_files:
                self.rep.err(where, f"неизвестное задание {unlock['order']}")
        for ex in exhibits.values():
            where = f"museum.json: {ex.get('id')}"
            quiz = ex.get("quiz", [])
            if not 1 <= len(quiz) <= 2:
                self.rep.err(where, "у экспоната должно быть 1–2 вопроса (quiz)")
            for i, x in enumerate(quiz):
                qw = f"{where}.quiz[{i}]"
                check_text(self.rep, qw, x.get("question", ""))
                opts = x.get("options", [])
                if not 3 <= len(opts) <= 4 or len(set(opts)) != len(opts):
                    self.rep.err(qw, "вариантов ответа должно быть 3–4, без повторов")
                if not isinstance(x.get("answer"), int) or not 0 <= x["answer"] < len(opts):
                    self.rep.err(qw, "answer — номер верного варианта (с нуля)")
        for where, eid, qi, lesson_no, stage, order in self.museum_refs:
            ex = exhibits.get(eid)
            if ex is None:
                self.rep.err(where, f"нет экспоната {eid} в museum.json")
                continue
            if not isinstance(qi, int) or not 0 <= qi < len(ex.get("quiz", [])):
                self.rep.err(where, f"у экспоната {eid} нет вопроса №{qi}")
            if not self.exhibit_open_at(ex, lesson_no, stage, order):
                self.rep.err(where, f"экспонат {eid} ещё не открыт в этот момент (занятие {lesson_no}, этап {stage})")

    def quotes_check(self) -> None:
        for qid, q in self.quotes.items():
            where = f"quotes.json: {qid}"
            for key in ("id", "name", "years", "role", "about", "quote", "context", "fact", "source"):
                if not q.get(key):
                    self.rep.err(where, f"нет поля {key}")
            if len(q.get("name", "").split()) < 3:
                self.rep.err(where, "нужны фамилия, имя и отчество")
            for key in ("role", "about", "context"):
                check_text(self.rep, f"{where}.{key}", q.get(key, ""))
            if self.facts is not None and q.get("fact") not in self.facts:
                self.rep.err(where, f"факта «{q.get('fact')}» нет в docs/space-facts.md")

    def exhibit_open_at(self, ex: dict[str, Any], lesson_no: int, stage: str, order: str | None) -> bool:
        """Is the exhibit open at stage `stage` of lesson `lesson_no` (for an order: once `order` is accepted)?"""
        unlock = ex.get("unlock")
        if unlock == "start":
            return True
        if not isinstance(unlock, dict):
            return False
        if unlock.get("order"):
            if unlock["order"] == order:
                return True
            owner = next((no for no, ids in self.lesson_orders.items() if unlock["order"] in ids), None)
            if owner is None:
                return False
            # An earlier lesson's mission counts as done; in the same lesson only for the crew quiz (end of day).
            return owner < lesson_no or (owner == lesson_no and order is None)
        at, no = unlock.get("stage"), unlock.get("lesson", 0)
        if no != lesson_no:
            return no < lesson_no
        stages = self.stage_order.get(no, [])
        return at in stages and stage in stages and stages.index(at) < stages.index(stage)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    content = Path(args[0]) if args else ROOT / "content"
    rep = Linter(content, assume_prev="--assume-prev" in sys.argv).run()
    for e in rep.errors:
        print(f"ОШИБКА  {e}")
    print(f"\nЛинтер контента: ошибок {len(rep.errors)}")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
