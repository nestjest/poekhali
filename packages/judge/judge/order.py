"""Order checking (mode «io»): cases → client complaints/approvals, AST, style, score."""
from __future__ import annotations

from typing import Any

from .astcheck import check_rules
from .detectors import detect
from .explain import explain_error
from .normalize import compare, lines
from .sandbox import execute
from .scoring import ACCEPT_STARS, clarify_accuracy, score, stars_for
from .style import check_style, style_points

PUBLIC_CASE_KEYS = ("id", "stdin", "expected_stdout", "weight", "requirement_id", "approve",
                    "complaint", "tolerance")


def code_text(value: Any) -> str:
    return "\n".join(value) + "\n" if isinstance(value, list) else (value or "")


def run_code(source: str, stdin: list[str] | None = None) -> dict[str, Any]:
    """«Запустить»: one run with the given stdin, for the client screen."""
    ex = execute(source, stdin)
    error = ex.error
    if error:
        error = {**error, "explain": explain_error(error)}
    return {"stdout": ex.stdout, "error": error, "prompts": ex.prompts, "steps": ex.steps}


def _run_case(source: str, case: dict[str, Any]) -> dict[str, Any]:
    ex = execute(source, list(case.get("stdin", [])))
    expected = code_text(case.get("expected_stdout", []))
    passed, diff = compare(expected, ex.stdout, case.get("tolerance"))
    if ex.error:
        passed = False
    hidden = bool(case.get("hidden"))
    result = {
        "id": case["id"], "hidden": hidden, "passed": passed,
        "weight": case.get("weight", 1), "requirement_id": case.get("requirement_id"),
        "reply": case.get("approve") if passed else case.get("complaint"),
        "error": {**ex.error, "explain": explain_error(ex.error)} if ex.error else None,
    }
    if not hidden:
        # Hidden cases never reveal their input or expected output (decision: only complaints).
        result.update({"stdin": case.get("stdin", []), "expected": lines(expected),
                       "actual": lines(ex.stdout), "diff": diff})
    return result


def run_order(source: str, order: dict[str, Any], include_hidden: bool = True,
              hints_used: int = 0, clarify_chosen: list[int] | None = None) -> dict[str, Any]:
    mode = order.get("mode", "io")
    if mode != "io":
        from .modes import MODES
        return MODES[mode].run(source, order)
    cases = [c for c in order.get("cases", []) if include_hidden or not c.get("hidden")]
    events: list[dict[str, Any]] = [{"type": "build_start", "total": len(cases)}]
    results = []
    compile_error = None
    try:
        compile(source, "<student>", "exec", dont_inherit=True)
    except SyntaxError:
        compile_error = run_code(source)["error"]
        events.append({"type": "compile_fail", "error": compile_error})
    for case in cases:
        events.append({"type": "case_start", "id": case["id"]})
        res = _run_case(source, case)
        results.append(res)
        events.append({"type": "case_pass" if res["passed"] else "case_fail", "id": case["id"],
                       "requirement_id": res["requirement_id"], "reply": res["reply"],
                       "hidden": res["hidden"]})
    requirements = []
    for req in order.get("requirements", []):
        linked = [r for r in results if r["requirement_id"] == req["id"]]
        requirements.append({"id": req["id"], "text": req["text"],
                             "ok": all(r["passed"] for r in linked) if linked else None,
                             "checked": bool(linked)})
    ast_report = check_rules(source, order.get("ast_rules"))
    style_report = check_style(source) if compile_error is None else []
    ast_ok = all(a["ok"] for a in ast_report)
    accuracy = clarify_accuracy(order.get("clarify"), clarify_chosen)
    scored = score(results, style_points(style_report), hints_used, accuracy)
    if not ast_ok:
        # The order asked for a specific construct: without it the result is capped at 3★ (79 points).
        scored["score"] = min(scored["score"], 79.0)
        scored["stars"] = stars_for(scored["score"])
        scored["accepted"] = scored["stars"] >= ACCEPT_STARS
    expected_all = [ln for c in order.get("cases", []) if not c.get("hidden")
                    for ln in c.get("expected_stdout", [])]
    summary = {
        "passed": sum(r["passed"] for r in results), "total": len(results),
        "hidden_failed": sum(1 for r in results if r["hidden"] and not r["passed"]),
        **scored,
    }
    events.append({"type": "build_end", "summary": summary})
    return {
        "order_id": order.get("id"), "cases": results, "requirements": requirements,
        "error": compile_error, "ast_report": ast_report, "style_report": style_report,
        "bugs": detect(source, expected_all), "events": events, "summary": summary,
        "needs_revision": summary["hidden_failed"] > 0,
    }


def public_order(order: dict[str, Any]) -> dict[str, Any]:
    """What a student may receive: no hidden cases, no reference solution."""
    out = {k: v for k, v in order.items() if k not in ("reference_solution", "cases")}
    out["cases"] = [{k: c[k] for k in PUBLIC_CASE_KEYS if k in c}
                    for c in order.get("cases", []) if not c.get("hidden")]
    out["hidden_count"] = sum(1 for c in order.get("cases", []) if c.get("hidden"))
    return out
