from __future__ import annotations

import pytest

from judge import (check_rules, check_style, clarify_accuracy, compare, detect, execute,
                   explain_error, public_order, run_code, run_order, stars_for, tips_due,
                   to_json, trace_code)
from judge.modes import MODES

ORDER = {
    "id": "t", "requirements": [{"id": "R1", "text": "Здоровается"}, {"id": "R2", "text": "По имени"}],
    "clarify": {"options": [{"text": "a", "relevant": True, "reply": "x"},
                            {"text": "b", "relevant": True, "reply": "x"},
                            {"text": "c", "relevant": False, "reply": "x"}]},
    "cases": [
        {"id": "c1", "stdin": ["Оля"], "expected_stdout": ["Привет, Оля"], "requirement_id": "R2",
         "approve": "Ура!", "complaint": "Молчит."},
        {"id": "h1", "stdin": ["Анна-Мария"], "expected_stdout": ["Привет, Анна-Мария"],
         "hidden": True, "requirement_id": "R2", "approve": "Узнала!", "complaint": "Не узнала."},
    ],
    "ast_rules": {"require": ["Call:input"]},
    "reference_solution": ["name = input()", "print(\"Привет,\", name)"],
}
REF = 'name = input()\nprint("Привет,", name)\n'


def test_determinism():
    assert to_json(run_order(REF, ORDER)) == to_json(run_order(REF, ORDER))


def test_reference_five_stars():
    res = run_order(REF, ORDER, clarify_chosen=[0, 1])
    assert res["summary"]["stars"] == 5 and res["summary"]["score"] == 100
    assert [e["type"] for e in res["events"]] == [
        "build_start", "case_start", "case_pass", "case_start", "case_pass", "build_end"]
    assert [r["ok"] for r in res["requirements"]] == [None, True]


def test_hardcoded_fails_hidden_with_complaint():
    res = run_order('input()\nprint("Привет, Оля")\n', ORDER, clarify_chosen=[0, 1])
    hidden = [c for c in res["cases"] if c["hidden"]][0]
    assert not hidden["passed"] and hidden["reply"] == "Не узнала."
    assert "expected" not in hidden and "stdin" not in hidden  # no leak
    assert res["needs_revision"]
    assert any(b["tag"] == "hardcoded_output" for b in res["bugs"])


def test_compile_error():
    res = run_order('print("Привет"\n', ORDER)
    assert res["error"]["type"] == "SyntaxError"
    assert res["summary"]["passed"] == 0 and res["summary"]["stars"] == 1


def test_ast_rule_caps_score():
    order = {**ORDER, "cases": ORDER["cases"][:1]}
    res = run_order('print("Привет,", "Оля")\n', order, clarify_chosen=[0, 1])
    assert not res["ast_report"][0]["ok"]
    assert res["summary"]["stars"] <= 3


def test_normalization_and_tolerance():
    assert compare("a\nb\n", "a  \nb\n\n\n")[0]
    ok, diff = compare("a\nb", "a\nc")
    assert not ok and diff == {"line": 2, "expected": "b", "actual": "c"}
    assert compare("Итого 3.33", "Итого 3.3333", tolerance=0.01)[0]
    assert not compare("Итого 3.33", "Итого 3.5", tolerance=0.01)[0]


def test_infinite_loop_step_limit():
    ex = execute("while True:\n    x = 1\n")
    assert ex.error["type"] == "Timeout"
    assert explain_error(ex.error)["tag"] == "infinite_loop"


def test_output_limit():
    assert execute("while True:\n    print('a' * 100)\n").error["type"] in ("OutputLimit", "Timeout")


def test_input_prompts_not_in_stdout_and_eof():
    ex = execute('a = input("Имя? ")\nprint(a)\nb = input()\n', ["Оля"])
    assert ex.stdout == "Оля\n" and ex.prompts == ["Имя? ", ""]
    assert ex.error["type"] == "EOFError"


def test_imports_blocked():
    assert execute("import os\n").error["type"] == "ImportError"
    assert execute("import math\nprint(math.floor(2.7))\n").stdout == "2\n"


@pytest.mark.parametrize("src,stdin,tag", [
    ("print(x)\n", [], "undefined_name"),
    ("Print(1)\n", [], "case_sensitivity"),
    ("print(___)\n", [], "blank_not_filled"),
    ("a = input()\nprint(a + 1)\n", ["5"], "str_plus_int"),
    ("a = input()\nprint(a * 1.5)\n", ["5"], "str_times_float"),
    ("print(int('пять'))\n", [], "bad_int_input"),
    ("print(float('2,5'))\n", [], "bad_float_input"),
    ("print(1 / 0)\n", [], "zero_division"),
    ("if 1:\nprint(1)\n", [], "indentation"),
    ("if 1 > 0\n    print(1)\n", [], "missing_colon"),
    ("x = 1\nif x = 1:\n    print(x)\n", [], "assign_vs_compare"),
    ('print("abc)\n', [], "unclosed_string"),
    ("input()\n", [], "too_many_inputs"),
])
def test_error_translator(src, stdin, tag):
    err = run_code(src, stdin)["error"]
    assert err is not None and err["explain"]["tag"] == tag, err
    assert err["explain"]["check"]


def test_style():
    codes = {w["code"] for w in check_style("x=1\nprint(x,1)\n  y = 2  \n")}
    assert {"E225", "E231", "W291", "E111"} <= codes
    assert check_style('name = input()\nprint("Привет,", name)\n') == []
    assert check_style("print(1, end='')\n") == []


def test_ast_rules_report():
    rep = check_rules("for i in range(3):\n    print(i)\n",
                      {"require": ["For", "Call:print"], "forbid": ["While", {"rule": "Call:print", "max": 0}]})
    assert [r["ok"] for r in rep] == [True, True, True, False]
    rep = check_rules("print(' стоп ')\n", {"forbid": ["Str:стоп"]})
    assert not rep[0]["ok"]


def test_scoring_helpers():
    assert [stars_for(s) for s in (10, 40, 60, 80, 95)] == [1, 2, 3, 4, 5]
    assert tips_due(0, 5) == 50 and tips_due(3, 4) == 15 and tips_due(4, 4) == 0
    assert clarify_accuracy(ORDER["clarify"], [0, 1]) == 10
    assert clarify_accuracy(ORDER["clarify"], [0]) == 5
    assert clarify_accuracy(ORDER["clarify"], [0, 1, 2]) == 0
    assert clarify_accuracy(None, None) == 10


def test_hints_lower_independence():
    res0 = run_order(REF, ORDER, clarify_chosen=[0, 1])
    res2 = run_order(REF, ORDER, clarify_chosen=[0, 1], hints_used=2)
    assert res0["summary"]["parts"]["independence"] == 10
    assert res2["summary"]["parts"]["independence"] == 4


def test_public_order_has_no_hidden_or_reference():
    pub = public_order(ORDER)
    assert "reference_solution" not in pub
    assert [c["id"] for c in pub["cases"]] == ["c1"] and pub["hidden_count"] == 1
    assert "Анна-Мария" not in to_json(pub)


def test_complaints_bound_to_requirements():
    res = run_order("name = input()\nprint(name)\n", ORDER)
    fails = [e for e in res["events"] if e["type"] == "case_fail"]
    assert fails and all(e["requirement_id"] == "R2" and e["reply"] for e in fails)
    assert res["requirements"][1]["ok"] is False and not res["requirements"][0]["checked"]


def test_trace():
    tr = trace_code("a = 1\na = a + 1\nprint(a)\n")
    lines = [s["line"] for s in tr["steps"]]
    assert lines[:3] == [1, 2, 3]
    step3 = tr["steps"][2]
    assert step3["vars"] == [{"name": "a", "type": "int", "value": "2", "changed": True}]
    assert tr["steps"][-1]["stdout"] == "2\n"


def test_trace_limit_and_truncation():
    tr = trace_code("s = 'x' * 200\nwhile True:\n    s = s\n")
    assert tr["truncated"] and len(tr["steps"]) == 501
    assert len(tr["steps"][1]["vars"][0]["value"]) <= 80


def test_detectors():
    tags = {d["tag"] for d in detect("a = input()\nprint(a + 1)\nfor i in range(1, n):\n    pass\n")}
    assert {"input_without_int", "off_by_one_range"} <= tags


def test_other_modes_are_interfaces():
    for name in ("func", "class", "data"):
        with pytest.raises(NotImplementedError):
            MODES[name].run("", {})
        with pytest.raises(NotImplementedError):
            run_order("", {"mode": name})
