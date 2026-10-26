"""Server-side code check (PROMPT.md §5, §6.6, §13).

The student's program never runs inside the API process: the same judge (packages/judge) runs in a separate
`python -I` process with an empty environment, a temporary working directory, a wall-clock timeout and —
on Linux — CPU / memory / file-size limits. The mission with its hidden cases is taken from the server's
content, not from the browser.

Deployment with Docker: the `checker` service (docker-compose.yml) runs `python -m bureau_server.checker --serve`
in a container without network; the lesson server then sends checks to it (env BUREAU_CHECKER_URL).

The lesson server itself never runs student code (PROMPT.md §5, §13): without BUREAU_CHECKER_URL the server check is
off and the browser checks as before. BUREAU_LOCAL_CHECK=1 runs the isolated process next to the server — only for
development and tests.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
JUDGE_DIR = Path(os.environ.get("BUREAU_JUDGE_DIR", ROOT / "packages" / "judge"))
TIMEOUT_S = 20
CPU_S = 15
MEMORY_BYTES = 512 * 1024 * 1024
MAX_SOURCE = 20_000

# Runs inside the isolated process: reads the request from stdin, prints the judge's JSON.
RUNNER = """
import json, sys
sys.stdin.reconfigure(encoding="utf-8")       # -I ignores PYTHONIOENCODING: set UTF-8 explicitly
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, sys.argv[1])
from judge import run_crew, run_order, to_json
req = json.loads(sys.stdin.read())
if req.get("crew"):
    out = run_crew(req["crew"], req["sources"], hints_used=req["hints"])
else:
    out = run_order(req["source"], req["order"], hints_used=req["hints"], clarify_chosen=req["clarify"])
sys.stdout.write(to_json(out))
"""


class CheckError(RuntimeError):
    """The check could not be completed (timeout, crash of the checker, bad request)."""


class CheckDisabled(CheckError):
    """No checker service is configured: the browser checks on its own."""


def enabled() -> bool:
    return bool(os.environ.get("BUREAU_CHECKER_URL")) or os.environ.get("BUREAU_LOCAL_CHECK") == "1"


def _limits() -> None:  # pragma: no cover - POSIX only
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_S, CPU_S))
    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_BYTES, MEMORY_BYTES))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))


def _env() -> dict[str, str]:
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}
    if os.name == "nt":  # Python on Windows needs these two to start
        for key in ("SYSTEMROOT", "WINDIR"):
            if key in os.environ:
                env[key] = os.environ[key]
    return env


def check_local(order: dict[str, Any], source: str, hints: int = 0, clarify: list[int] | None = None,
                crew: dict[str, Any] | None = None, sources: dict[str, str] | None = None) -> dict[str, Any]:
    """`crew` + `sources`: a crew mission and its parts (the judge joins them); otherwise an order and a program."""
    if len(source) > MAX_SOURCE or sum(len(x) for x in (sources or {}).values()) > MAX_SOURCE:
        raise CheckError("Программа слишком длинная для проверки.")
    request = json.dumps({"order": order, "source": source, "hints": hints, "clarify": clarify,
                          "crew": crew, "sources": sources or {}}, ensure_ascii=False)
    with tempfile.TemporaryDirectory(prefix="bureau-check-") as tmp:
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-c", RUNNER, str(JUDGE_DIR)],
                input=request, capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=TIMEOUT_S, cwd=tmp, env=_env(),
                preexec_fn=_limits if os.name == "posix" else None,  # noqa: PLW1509 - limits for the child only
            )
        except subprocess.TimeoutExpired as exc:
            raise CheckError("Проверка заняла слишком много времени.") from exc
    if proc.returncode != 0 or not proc.stdout:
        raise CheckError("Проверка не удалась на сервере. Попробуйте ещё раз.")
    return json.loads(proc.stdout)


def check(order: dict[str, Any], source: str, hints: int = 0, clarify: list[int] | None = None) -> dict[str, Any]:
    """Checker service (BUREAU_CHECKER_URL); an isolated local process only with BUREAU_LOCAL_CHECK=1."""
    url = os.environ.get("BUREAU_CHECKER_URL")
    if not url:
        if os.environ.get("BUREAU_LOCAL_CHECK") == "1":
            return check_local(order, source, hints, clarify)
        raise CheckDisabled("Серверная проверка не включена: проверяем в браузере.")
    data = json.dumps({"order": order, "source": source, "hints": hints, "clarify": clarify}).encode("utf-8")
    req = urllib.request.Request(url.rstrip("/") + "/check", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S + 5) as resp:  # noqa: S310 - internal service URL
            return json.loads(resp.read().decode("utf-8"))
    except OSError as exc:
        raise CheckError("Сервис проверки недоступен.") from exc


def check_crew(mission: dict[str, Any], sources: dict[str, str], hints: int = 0) -> dict[str, Any]:
    """Crew program (team «Конец смены»): the same isolation as an ordinary check."""
    url = os.environ.get("BUREAU_CHECKER_URL")
    if not url:
        if os.environ.get("BUREAU_LOCAL_CHECK") == "1":
            return check_local({}, "", hints, None, crew=mission, sources=sources)
        raise CheckDisabled("Серверная проверка не включена: проверяем в браузере.")
    data = json.dumps({"crew": mission, "sources": sources, "hints": hints}).encode("utf-8")
    req = urllib.request.Request(url.rstrip("/") + "/check_crew", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S + 5) as resp:  # noqa: S310 - internal service URL
            return json.loads(resp.read().decode("utf-8"))
    except OSError as exc:
        raise CheckError("Сервис проверки недоступен.") from exc


def serve(host: str, port: int) -> None:  # pragma: no cover - started inside the container
    """Minimal checker service: POST /check → judge result. Runs without network in docker-compose."""
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field
    import uvicorn

    class CheckRequest(BaseModel):
        order: dict[str, Any]
        source: str = Field(max_length=MAX_SOURCE)
        hints: int = Field(default=0, ge=0, le=3)
        clarify: list[int] | None = None

    class CrewRequest(BaseModel):
        crew: dict[str, Any]
        sources: dict[str, str] = Field(default_factory=dict)
        hints: int = Field(default=0, ge=0, le=3)

    app = FastAPI(title="«Поехали!» — checker")

    @app.post("/check_crew")
    def do_check_crew(body: CrewRequest) -> dict[str, Any]:
        try:
            return check_local({}, "", body.hints, None, crew=body.crew, sources=body.sources)
        except CheckError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/check")
    def do_check(body: CheckRequest) -> dict[str, Any]:
        try:
            return check_local(body.order, body.source, body.hints, body.clarify)
        except CheckError as exc:
            raise HTTPException(422, str(exc)) from exc

    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":  # pragma: no cover
    p = argparse.ArgumentParser(description="Сервис проверки кода курса «Поехали!»")
    p.add_argument("--serve", action="store_true")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8001)
    a = p.parse_args()
    if a.serve:
        serve(a.host, a.port)
