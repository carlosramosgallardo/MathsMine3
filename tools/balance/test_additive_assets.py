"""Guards for additive polyglot assets (HTML / SQL / Batchfile)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "apps/android-native/app/src/main/assets/webview/offline.html"
SQL = ROOT / "tools/sql/farming_snapshot.sql"
CMD = ROOT / "scripts/windows/Connect-FreakingAI.cmd"
FARMING_PY = ROOT / "tools/balance/farming.py"

FORBIDDEN_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|execute|do)\b",
    re.IGNORECASE,
)
UNSAFE_HTML = re.compile(
    r"<script|javascript:|\son[a-z]+\s*=|http://",
    re.IGNORECASE,
)
UNSAFE_CMD = re.compile(
    r"downloadstring|invoke-expression|\biex\b|curl .+\|\s*(sh|bash|powershell)",
    re.IGNORECASE,
)


def test_offline_html_is_static_and_bilingual():
    text = HTML.read_text(encoding="utf-8")
    assert "MathsMine3" in text
    assert "Content-Security-Policy" in text
    assert "script-src 'none'" in text
    assert "English" in text and "Español" in text
    assert "href=\"/\"" in text
    assert UNSAFE_HTML.search(text) is None
    assert len(text) > 1500


def test_farming_sql_is_select_only_and_matches_python_columns():
    text = SQL.read_text(encoding="utf-8")
    assert "FROM games" in text
    assert "FROM player_progress" in text
    assert FORBIDDEN_SQL.search(text) is None
    py = FARMING_PY.read_text(encoding="utf-8")
    assert "wallet,is_correct,time_ms,created_at,difficulty" in py
    assert "wallet,level,is_bot" in py
    for column in ("wallet", "is_correct", "time_ms", "created_at", "difficulty", "level", "is_bot"):
        assert column in text


def test_windows_cmd_only_forwards_to_powershell():
    text = CMD.read_text(encoding="utf-8")
    assert "Connect-FreakingAI.ps1" in text
    assert "pwsh" in text
    assert UNSAFE_CMD.search(text) is None
