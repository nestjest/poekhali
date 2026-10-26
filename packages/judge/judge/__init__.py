"""judge: the single source of mission checking for the course «Поехали!»."""
import json as _json

from .astcheck import check_rules, constructs_used, disallowed
from .crew import crew_order, crew_ranges, crew_source, run_crew
from .detectors import detect
from .explain import RULES as ERROR_RULES, explain_error
from .normalize import compare, lines
from .order import code_text, public_order, run_code, run_order
from .sandbox import execute
from .scoring import clarify_accuracy, stars_for, tips_due
from .style import check_style
from .trace import trace_code

__version__ = "0.1.0"


def to_json(data: object) -> str:
    """Canonical serialization used for CPython/Pyodide identity checks."""
    return _json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


__all__ = [
    "ERROR_RULES", "check_rules", "check_style", "clarify_accuracy", "code_text", "compare",
    "crew_order", "crew_ranges", "crew_source", "run_crew",
    "constructs_used", "detect", "disallowed", "execute", "explain_error", "lines",
    "public_order", "run_code", "run_order", "stars_for", "tips_due", "to_json", "trace_code",
]
