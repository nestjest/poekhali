from __future__ import annotations

import json
from pathlib import Path

import pytest

from lint_content import ROOT, Linter, find_cycle, sentences, words


def write(dirpath: Path, rel: str, data: object) -> None:
    p = dirpath / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


CHECK = {"kind": "single", "prompt": "?", "options": ["a", "b"], "answer": 0, "requires": [],
         "introduces": ["print"], "hint": "Подумай.", "explain": "Объясняю.",
         "feedback_correct": "Да!", "feedback_wrong": "Почти."}
ORDER = {
    "id": "0.1", "lesson": 0, "order_no": 1, "kind": "regular", "client_id": "zoya",
    "title": "Вывеска", "pitch": ["Нужна вывеска."], "requirements": [{"id": "R1", "text": "Вывеска"}],
    "cases": [{"id": "c1", "stdin": [], "expected_stdout": ["Пирог"], "requirement_id": "R1",
               "approve": "Ура.", "complaint": "Где вывеска?"},
              {"id": "h1", "stdin": [], "expected_stdout": ["Пирог"], "hidden": True,
               "requirement_id": "R1", "approve": "Ура.", "complaint": "Где вывеска?"}],
    "hints": ["Где?", "Что?", "Пример."], "requires": ["print"], "introduces": [],
    "reference_solution": ["print(\"Пирог\")"], "starter_code": ["# напиши"], "scaffold_level": 3,
}


def make_content(tmp: Path, *, say: str = "Привет! Это [[программа]].", order: dict | None = None,
                 skills: list | None = None, allowed: list | None = None, check: dict | None = None) -> Path:
    write(tmp, "characters.json", {"vika": {"name": "Вика", "role": "staff"},
                                  "zoya": {"name": "Зоя Андреевна", "role": "client"}})
    write(tmp, "skills.json", skills or [{"id": "print", "lesson": 0, "requires": []}])
    write(tmp, "glossary.json", [{"term": "программа", "forms": [], "simple": "x", "lesson": 0}])
    write(tmp, "dialogues/d.json", {"id": "d", "nodes": [
        {"id": "n1", "type": "say", "who": "vika", "mood": "joy", "text": say},
        {"id": "n2", "type": "check", "check": check or CHECK}, {"id": "n3", "type": "end"}]})
    write(tmp, "orders/o.json", order or ORDER)
    write(tmp, "lessons/l0.json", {
        "number": 0, "title": "t", "goal": "g", "result": "r", "competencies": [], "program_lines": [],
        "timing": [["a", 90]], "notebook": [], "reflection": [],
        "allowed_constructs": allowed or ["Call:print", "Constant", "Name", "Assign"],
        "stages": [{"id": "b", "dialogue": "d"}, {"id": "o", "orders": ["o"]}]})
    return tmp


def errors(tmp: Path, **kw) -> list[str]:
    return Linter(make_content(tmp, **kw)).run().errors


def test_clean_fixture(tmp_path):
    assert errors(tmp_path) == []


def test_long_reply_and_sentences(tmp_path):
    long = " ".join(["слово"] * 36)
    assert any("35 слов" in e for e in errors(tmp_path, say=long))
    assert any("предложений" in e for e in errors(tmp_path / "b", say="Раз. Два. Три."))


def test_unknown_term_and_two_new_terms(tmp_path):
    assert any("нет в глоссарии" in e for e in errors(tmp_path, say="Это [[цикл]]."))


def test_requires_before_introduce(tmp_path):
    bad = {**CHECK, "requires": ["print"], "introduces": []}
    assert any("ещё не введённые" in e for e in errors(tmp_path, check=bad))


def test_disallowed_construct(tmp_path):
    order = {**ORDER, "reference_solution": ["x = 'Пирог'", "print(f'{x}')"]}
    errs = errors(tmp_path, order=order)
    assert any("JoinedStr" in e for e in errs)


def test_reference_must_get_five_stars(tmp_path):
    order = {**ORDER, "reference_solution": ["print(\"Торт\")"]}
    assert any("эталон не получает 5★" in e for e in errors(tmp_path, order=order))


def test_starter_must_fail(tmp_path):
    order = {**ORDER, "starter_code": ["print(\"Пирог\")"]}
    assert any("шаблон" in e for e in errors(tmp_path, order=order))


def test_hidden_case_needs_complaint(tmp_path):
    cases = [ORDER["cases"][0], {**ORDER["cases"][1], "complaint": ""}]
    assert any("complaint" in e for e in errors(tmp_path, order={**ORDER, "cases": cases}))


def test_hint_leaks_solution(tmp_path):
    order = {**ORDER, "reference_solution": ["print(\"Пирог с вишней\")"],
             "cases": [{**c, "expected_stdout": ["Пирог с вишней"]} for c in ORDER["cases"]],
             "hints": ["a", "b", "Напиши print(\"Пирог с вишней\")"]}
    assert any("подсказка содержит" in e for e in errors(tmp_path, order=order))


def test_skill_cycle(tmp_path):
    skills = [{"id": "print", "lesson": 0, "requires": ["x"]}, {"id": "x", "lesson": 0, "requires": ["print"]}]
    assert any("цикл" in e for e in errors(tmp_path, skills=skills))
    assert find_cycle({"a": ["b"], "b": []}) is None


def test_text_metrics():
    assert words("Это `print(name)` и [[переменная]].") == 4
    assert sentences("Раз. Два!") == 2 and sentences("Вот так… и всё.") == 1


def test_character_role(tmp_path):
    make_content(tmp_path)
    write(tmp_path, "characters.json", {"vika": {"name": "Вика", "role": "boss"},
                                        "zoya": {"name": "Зоя", "role": "client"}})
    assert any("неизвестная роль" in e for e in Linter(tmp_path).run().errors)


def test_launch_node_needs_craft(tmp_path):
    make_content(tmp_path)
    write(tmp_path, "dialogues/d.json", {"id": "d", "nodes": [
        {"id": "n1", "type": "launch"}, {"id": "n2", "type": "check", "check": CHECK},
        {"id": "n3", "type": "end"}]})
    assert any("craft" in e for e in Linter(tmp_path).run().errors)


QUIZ = {"question": "Когда запустили ПС-1?", "options": ["1957", "1961", "1963"], "answer": 0}


def museum_content(tmp_path: Path, exhibit_unlock: object, order_museum: dict | None) -> Path:
    order = {**ORDER, "museum": order_museum} if order_museum is not None else ORDER
    content = make_content(tmp_path / "content", order=order)
    (tmp_path / "docs").mkdir(exist_ok=True)
    (tmp_path / "docs" / "space-facts.md").write_text(
        "| id | Факт | Источник |\n|---|---|---|\n| ps1 | Спутник | Вики |\n| q1 | Цитата | Книга |\n",
        encoding="utf-8")
    write(content, "museum.json", [{"id": "e1", "title": "ПС-1", "text": "Первый спутник.", "fact": "ps1",
                                    "unlock": exhibit_unlock, "quiz": [QUIZ]}])
    return content


def test_museum_quiz_and_client_question(tmp_path):
    ask = {"exhibit": "e1", "question": 0, "ask": "Ответишь — доплачу."}
    assert Linter(museum_content(tmp_path / "a", "start", ask)).run().errors == []
    # the exhibit opens at the same order → it is open once that order is accepted
    assert Linter(museum_content(tmp_path / "b", {"order": "o"}, ask)).run().errors == []
    # an exhibit of a later stage is not open yet
    errs = Linter(museum_content(tmp_path / "c", {"stage": "o"}, ask)).run().errors
    assert any("ещё не открыт" in e for e in errs)
    errs = Linter(museum_content(tmp_path / "d", "start", {**ask, "question": 3, "exhibit": "e1"})).run().errors
    assert any("нет вопроса №3" in e for e in errs)
    errs = Linter(museum_content(tmp_path / "e", "start", {**ask, "exhibit": "nope"})).run().errors
    assert any("нет экспоната nope" in e for e in errs)
    content = museum_content(tmp_path / "f", "start", None)
    write(content, "museum.json", [{"id": "e1", "title": "ПС-1", "text": "Спутник.", "fact": "ps1", "unlock": "start",
                                    "quiz": [{**QUIZ, "answer": 7}]}])
    assert any("answer" in e for e in Linter(content).run().errors)


def test_quote_node_and_quotes(tmp_path):
    content = museum_content(tmp_path, "start", None)
    d = json.loads((content / "dialogues" / "d.json").read_text(encoding="utf-8"))
    d["nodes"].insert(2, {"id": "q", "type": "quote", "quote": "q1"})
    write(content, "dialogues/d.json", d)
    assert any("нет цитаты q1" in e for e in Linter(content).run().errors)
    quote = {"id": "q1", "name": "Юрий Алексеевич Гагарин", "years": "1934–1968", "role": "Космонавт.",
             "about": "Первый полёт.", "quote": "Поехали!", "context": "На старте.", "fact": "q1", "source": "Вики"}
    write(content, "quotes.json", [quote])
    assert Linter(content).run().errors == []
    write(content, "quotes.json", [{**quote, "name": "Гагарин", "fact": "nope"}])
    errs = Linter(content).run().errors
    assert any("фамилия, имя и отчество" in e for e in errs) and any("нет в docs/space-facts.md" in e for e in errs)


def test_museum_facts_and_unlocks(tmp_path):
    content = make_content(tmp_path / "content")
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "space-facts.md").write_text(
        "| id | Факт | Источник |\n|---|---|---|\n| ps1 | Спутник | Вики |\n", encoding="utf-8")
    good = {"id": "e1", "title": "ПС-1", "year": 1957, "text": "Первый спутник.", "fact": "ps1",
            "unlock": {"order": "o"}, "quiz": [QUIZ]}
    write(content, "museum.json", [good, {**good, "id": "e2", "unlock": "start"}])
    assert Linter(content).run().errors == []
    write(content, "museum.json", [{**good, "fact": "nope"}, {**good, "id": "e3", "unlock": {"stage": "zz"}}])
    errs = Linter(content).run().errors
    assert any("нет в docs/space-facts.md" in e for e in errs)
    assert any("неизвестный этап" in e for e in errs)


def test_assume_prev_counts_earlier_lessons(tmp_path):
    # lesson 1 requires a lesson-0 skill that no lesson-0 file introduces yet (written in parallel)
    content = make_content(tmp_path, check={**CHECK, "requires": ["print"], "introduces": []},
                           skills=[{"id": "print", "lesson": 0, "requires": []}])
    lesson = json.loads((content / "lessons" / "l0.json").read_text(encoding="utf-8"))
    lesson["number"] = 1
    (content / "lessons" / "l0.json").write_text(json.dumps(lesson, ensure_ascii=False), encoding="utf-8")
    assert any("ещё не введённые" in e for e in Linter(content).run().errors)
    assert not any("ещё не введённые" in e for e in Linter(content, assume_prev=True).run().errors)


def test_real_content_is_clean():
    content = ROOT / "content"
    if not (content / "lessons").exists():
        pytest.skip("контент ещё не создан")
    rep = Linter(content).run()
    assert rep.errors == []
