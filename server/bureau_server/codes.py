"""Lesson join codes like «КЕДР-42».

Students type the code by hand, so input is treated as dirty: case, spaces, dashes,
Latin look-alike letters, transliteration («KEDR-42»), the wrong keyboard layout
(«rtlh 42») and «ё» must not prevent joining.
"""
from __future__ import annotations

import re
import secrets

WORDS = ("КЕДР", "ЧАЙКА", "ВОСТОК", "СОЮЗ", "ЗАРЯ", "ЛУНА", "ВЕГА", "ИСКРА", "МИР", "ОРБИТА", "АЛМАЗ", "ЗВЕЗДА")

_LOOKALIKE = str.maketrans({
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К", "M": "М", "O": "О",
    "P": "Р", "T": "Т", "X": "Х", "Y": "У", "Ё": "Е",
})
_TRANSLIT = {
    "KEDR": "КЕДР", "CHAIKA": "ЧАЙКА", "CHAYKA": "ЧАЙКА", "VOSTOK": "ВОСТОК", "SOYUZ": "СОЮЗ",
    "SOJUZ": "СОЮЗ", "ZARYA": "ЗАРЯ", "ZARJA": "ЗАРЯ", "LUNA": "ЛУНА", "VEGA": "ВЕГА",
    "ISKRA": "ИСКРА", "MIR": "МИР", "ORBITA": "ОРБИТА", "ALMAZ": "АЛМАЗ", "ZVEZDA": "ЗВЕЗДА",
}
_WRONG_LAYOUT = str.maketrans(
    "qwertyuiop[]asdfghjkl;'zxcvbnm,.`",
    "йцукенгшщзхъфывапролджэячсмитьбюё",
)
_LATIN_KEYS = re.compile(r"[a-z\[\];',.`]+")


def normalize_code(raw: str) -> str:
    """Canonical form: Cyrillic upper-case word immediately followed by digits («КЕДР42»)."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    word = re.sub(r"[\s\-_–—\d]+", "", raw.strip())
    upper = word.upper()
    if upper in _TRANSLIT:
        return _TRANSLIT[upper] + digits
    if _LATIN_KEYS.fullmatch(word.lower()):
        switched = word.lower().translate(_WRONG_LAYOUT).upper().replace("Ё", "Е")
        if switched in WORDS:
            return switched + digits
    word = re.sub(r"[^А-Я]", "", upper.translate(_LOOKALIKE).replace("Ё", "Е"))
    return word + digits


def make_code(taken: set[str]) -> str:
    """A fresh code whose normalized form is not in ``taken``."""
    for _ in range(1000):
        code = f"{secrets.choice(WORDS)}-{secrets.randbelow(90) + 10}"
        if normalize_code(code) not in taken:
            return code
    raise RuntimeError("не удалось подобрать свободный код урока")
