"""Error translator: «что случилось → где → что проверить», friendly tone.

Rules are data (RULES): first matching rule wins. Each rule has a misconception
tag for analytics. Never contains a ready solution.
"""
from __future__ import annotations

import re
from typing import Any

# type: exception type; match: regex on message (optional); what/check: texts.
# {name}, {value} are filled from regex groups named the same way.
RULES: list[dict[str, str]] = [
    {"type": "NameError", "match": r"name '(?P<name>_+)' is not defined",
     "what": "Остался незаполненный пропуск.", "check": "Замени ___ на нужное значение.",
     "tag": "blank_not_filled"},
    {"type": "NameError", "match": r"name '(?P<name>(?:Print|PRINT|Input|INPUT|Int|Len|Str|Float|Round))' is not defined",
     "what": "Python различает большие и маленькие буквы: «{name}» и «{lower}» — разные имена.",
     "check": "Встроенные команды пишутся маленькими буквами.", "tag": "case_sensitivity"},
    {"type": "NameError", "match": r"name '(?P<name>[^']+)' is not defined",
     "what": "Python не знает имени «{name}».",
     "check": "Может, это опечатка? А если это текст — возьми его в кавычки.",
     "tag": "undefined_name"},
    {"type": "TypeError", "match": r"can only concatenate str|unsupported operand type\(s\) for \+: 'int' and 'str'",
     "what": "Строку и число нельзя сложить через +.",
     "check": "Одно из значений — текст. Нужно число? Оберни его в int(). Нужен текст? — в str().",
     "tag": "str_plus_int"},
    {"type": "TypeError", "match": r"can't multiply sequence by non-int of type 'float'",
     "what": "Строку можно умножать только на целое число.",
     "check": "Похоже, число осталось текстом. Проверь, где нужен float() или int().",
     "tag": "str_times_float"},
    {"type": "TypeError", "match": r"unsupported operand type\(s\) for [-*/]: 'str'|unsupported operand type\(s\) for [-*/]: '\w+' and 'str'",
     "what": "С текстом нельзя считать, как с числом.",
     "check": "input() всегда даёт текст. Преврати его в число через int() или float().",
     "tag": "input_without_int"},
    {"type": "TypeError", "match": r"not supported between instances of 'str' and 'int'",
     "what": "Сравниваются текст и число.",
     "check": "Не забыт ли int() после input()?", "tag": "input_without_int"},
    {"type": "ValueError", "match": r"invalid literal for int\(\) with base 10: (?P<value>.*)",
     "what": "int() не может превратить {value} в целое число.",
     "check": "В «Входных данных» должно быть целое число без лишних букв.",
     "tag": "bad_int_input"},
    {"type": "ValueError", "match": r"could not convert string to float",
     "what": "float() не понял число.", "check": "Дробную часть пишут через точку: 12.5.",
     "tag": "bad_float_input"},
    {"type": "ZeroDivisionError", "what": "Деление на ноль.",
     "check": "Посмотри, откуда в делителе взялся 0.", "tag": "zero_division"},
    {"type": "IndentationError", "what": "Сбились отступы.",
     "check": "Строки одного уровня начинаются ровно с одного места.", "tag": "indentation"},
    {"type": "TabError", "what": "Смешаны пробелы и табуляция.",
     "check": "Используй только пробелы: 4 на уровень.", "tag": "indentation"},
    {"type": "SyntaxError", "match": r"expected ':'", "what": "Не хватает двоеточия.",
     "check": "После if, else, for, while ставится «:».", "tag": "missing_colon"},
    {"type": "SyntaxError", "match": r"Maybe you meant '==' or ':='|cannot assign to",
     "what": "Похоже, сравнение записано одним знаком =.",
     "check": "= кладёт значение в переменную, а == сравнивает.", "tag": "assign_vs_compare"},
    {"type": "SyntaxError", "match": r"unterminated string|EOL while scanning",
     "what": "Не закрыта кавычка.", "check": "У текста должна быть пара кавычек.",
     "tag": "unclosed_string"},
    {"type": "SyntaxError", "match": r"was never closed|unmatched|closing parenthesis",
     "what": "Скобки не парные.", "check": "Посчитай открывающие и закрывающие скобки.",
     "tag": "unbalanced_parens"},
    {"type": "SyntaxError", "match": r"invalid syntax. Perhaps you forgot a comma",
     "what": "Между значениями не хватает запятой.",
     "check": "В print() значения разделяют запятыми.", "tag": "missing_comma"},
    {"type": "SyntaxError", "what": "Python не понял запись.",
     "check": "Проверь кавычки, скобки и знаки в этой строке.", "tag": "syntax"},
    {"type": "EOFError", "what": "Ввод закончился.",
     "check": "Программа просит больше данных, чем дали. Посчитай вызовы input().",
     "tag": "too_many_inputs"},
    {"type": "Timeout", "what": "Программа работает слишком долго.",
     "check": "Скорее всего, цикл не заканчивается. Меняется ли условие внутри цикла?",
     "tag": "infinite_loop"},
    {"type": "OutputLimit", "what": "Программа печатает слишком много.",
     "check": "Возможно, print() стоит внутри бесконечного цикла.", "tag": "infinite_loop"},
    {"type": "ImportError", "what": "Этот модуль здесь недоступен.",
     "check": "Для задания хватает встроенных команд.", "tag": "import"},
]


def explain_error(error: dict[str, Any]) -> dict[str, str]:
    """Returns {title, where, check, tag}."""
    t, msg = error.get("type", ""), error.get("message") or ""
    line = error.get("line")
    where = f"Строка {line}." if line else ""
    for rule in RULES:
        if rule["type"] != t:
            continue
        m = re.search(rule["match"], msg) if "match" in rule else None
        if "match" in rule and not m:
            continue
        values = m.groupdict() if m else {}
        values.setdefault("name", "")
        values["lower"] = values["name"].lower()
        return {"title": rule["what"].format(**values), "where": where,
                "check": rule["check"].format(**values), "tag": rule["tag"]}
    return {"title": f"Ошибка {t}.", "where": where,
            "check": "Прочитай строку внимательно — и попробуй ещё раз.", "tag": "other"}
