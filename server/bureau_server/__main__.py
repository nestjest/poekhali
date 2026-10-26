"""Run the lesson server:  python -m bureau_server  (from the `server` folder).

On first start a teacher password is generated and printed; change it with --set-password.
"""
from __future__ import annotations

import argparse
import getpass
import os
import secrets
import socket
from pathlib import Path

import uvicorn

from .app import ROOT, create_app
from .codes import WORDS
from .store import Store

_LATIN = {"КЕДР": "kedr", "ЧАЙКА": "chaika", "ВОСТОК": "vostok", "СОЮЗ": "soyuz", "ЗАРЯ": "zarya",
          "ЛУНА": "luna", "ВЕГА": "vega", "ИСКРА": "iskra", "МИР": "mir", "ОРБИТА": "orbita",
          "АЛМАЗ": "almaz", "ЗВЕЗДА": "zvezda"}


def readable_password() -> str:
    """Latin letters + digits: typed the same on any keyboard layout."""
    return f"{_LATIN[secrets.choice(WORDS)]}-{secrets.randbelow(9000) + 1000}-{_LATIN[secrets.choice(WORDS)]}"


def primary_address() -> str | None:
    """The address of the interface with the default route (no packet is sent): the LAN address, not a virtual adapter."""
    for probe in ("8.8.8.8", "10.255.255.255"):     # internet route first; a LAN without internet — the second
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect((probe, 1))
                return str(sock.getsockname()[0])
        except OSError:
            continue
    return None


def lan_addresses() -> list[str]:
    addrs: set[str] = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addrs.add(str(info[4][0]))
    except OSError:
        pass
    main = primary_address()
    if main:
        addrs.add(main)
    found = sorted(a for a in addrs if not a.startswith(("127.", "169.254.")))
    # The default-route address first: WSL / Hyper-V / Docker adapters (often 172.x) are useless for students.
    return sorted(found, key=lambda a: a != main) or ["127.0.0.1"]


def in_container() -> bool:
    """Inside Docker the container's own addresses are useless for students: they need the host computer's address."""
    return Path("/.dockerenv").exists() or os.environ.get("BUREAU_IN_DOCKER") == "1"


def print_addresses(port: int) -> None:
    suffix = f":{port}" if port != 80 else ""
    public = os.environ.get("BUREAU_PUBLIC_URL", "").strip().rstrip("/")
    if public:
        students, teacher = [public + "/"], public + "/#/teacher"
    elif in_container():
        print(f"    Преподавателю (на этом компьютере): http://localhost{suffix}/#/teacher")
        print(f"    Ученикам: http://<адрес этого компьютера в сети>{suffix}/")
        print("      адрес: Windows — ipconfig (IPv4), Linux/macOS — ip addr; или задайте BUREAU_PUBLIC_URL")
        return
    else:
        ips = lan_addresses()
        students, teacher = [f"http://{ip}{suffix}/" for ip in ips], f"http://{ips[0]}{suffix}/#/teacher"
        if ips[0] != "127.0.0.1":
            os.environ["BUREAU_STUDENT_URL"] = f"http://{ips[0]}{suffix}"
    print(f"    Ученикам:        {students[0]}")
    for url in students[1:]:
        print(f"                     {url}")
    print(f"    Преподавателю:   {teacher}")


def main() -> None:
    p = argparse.ArgumentParser(description="Сервер урока курса «Поехали!»")
    p.add_argument("--host", default="0.0.0.0", help="адрес (0.0.0.0 — доступно всем в локальной сети)")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--db", default=str(ROOT / "server" / "data" / "bureau.db"), help="файл базы SQLite")
    p.add_argument("--set-password", action="store_true", help="задать пароль преподавателя и выйти")
    p.add_argument("--reset-password", action="store_true", help="сгенерировать новый пароль и показать его")
    args = p.parse_args()

    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    store = Store(args.db)
    if args.set_password:
        pw = getpass.getpass("Новый пароль преподавателя (от 6 символов): ")
        if len(pw) < 6:
            raise SystemExit("Пароль короче 6 символов — не сохранён.")
        store.set_password(pw)
        print("Пароль сохранён.")
        return
    generated = None
    env_pw = os.environ.get("BUREAU_TEACHER_PASSWORD")
    if env_pw:
        store.set_password(env_pw)
    elif args.reset_password or not store.has_password():
        generated = readable_password()
        store.set_password(generated)

    print("\n  «Поехали!» — сервер урока")
    print_addresses(args.port)
    if generated:
        print(f"\n    Пароль преподавателя: {generated}")
        hint = ("docker compose exec app python -m bureau_server --set-password" if in_container()
                else "python -m bureau_server --set-password")
        print(f"    (запишите его; сменить: {hint})")
    if not (ROOT / "frontend" / "dist" / "index.html").exists():
        print("\n    Внимание: игра не собрана. Выполните: cd frontend && npm run build")
    print()
    uvicorn.run(create_app(args.db), host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
