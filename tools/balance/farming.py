"""Detect Training farming from a games/progress snapshot.

Official in-game bots (CRON_SECRET /api/bot/tick) are labelled, not accused.
Unknown superhuman timing, cloned time_ms, or daily-cap breaches are flagged.

Offline:  python3 tools/balance/farming.py --input tools/balance/fixtures/farming_snapshot.json
Live:     SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL → --supabase
SQL editor (read-only, does not replace this CLI): tools/sql/farming_snapshot.sql
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

OFFICIAL_BOTS = {
    "0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528",
    "0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202",
    "0xd6c6c15060b27406d956c7e99e520cc810b44233",
    "0xd89413f5f444cd420b448cda3bc096ea9c46e8ab",
}

DAILY_MINE_BASE = 100
SUPERHUMAN_MS = 80
CLONE_TIME_MIN = 15
PERFECT_LEGEND_MIN = 40
REPO_ROOT = Path(__file__).resolve().parents[2]


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def resolved_input_file(raw: Path) -> Path:
    """Reject paths that escape the repo or the process working directory (S8707)."""
    resolved = raw.expanduser().resolve()
    if not resolved.is_file():
        raise ValueError(f"input is not a file: {resolved}")
    allowed = (Path.cwd().resolve(), REPO_ROOT)
    if not any(_is_inside(resolved, root) for root in allowed):
        raise ValueError(f"input path escapes allowed directories: {resolved}")
    return resolved


def norm_wallet(value: str) -> str:
    return str(value or "").strip().lower()


def utc_day(ts: str) -> str:
    raw = str(ts or "")
    if not raw:
        return "unknown"
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return raw[:10]
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date().isoformat()


def analyze(snapshot: dict) -> dict:
    games = snapshot.get("games") or []
    progress = {
        norm_wallet(row.get("wallet")): row
        for row in (snapshot.get("progress") or [])
        if norm_wallet(row.get("wallet"))
    }

    by_wallet: dict[str, list[dict]] = defaultdict(list)
    for game in games:
        wallet = norm_wallet(game.get("wallet"))
        if wallet:
            by_wallet[wallet].append(game)

    findings: list[dict] = []
    for wallet, rows in sorted(by_wallet.items()):
        official = wallet in OFFICIAL_BOTS
        marked_bot = bool((progress.get(wallet) or {}).get("is_bot"))
        level = int((progress.get(wallet) or {}).get("level") or 0)

        if official:
            findings.append(
                {
                    "code": "official_bot",
                    "severity": "info",
                    "wallet": wallet,
                    "detail": "in-game cron bot from /api/bot/tick",
                }
            )
        elif marked_bot:
            findings.append(
                {
                    "code": "unlisted_bot_flag",
                    "severity": "high",
                    "wallet": wallet,
                    "detail": "player_progress.is_bot=true but wallet is not an official bot",
                }
            )

        times = [int(row.get("time_ms") or 0) for row in rows]
        superhuman = sum(1 for ms in times if 0 <= ms < SUPERHUMAN_MS)
        if superhuman >= 10 and not official:
            findings.append(
                {
                    "code": "superhuman_timing",
                    "severity": "high",
                    "wallet": wallet,
                    "detail": f"{superhuman}/{len(times)} answers under {SUPERHUMAN_MS}ms",
                }
            )

        common_ms, clone_n = Counter(times).most_common(1)[0] if times else (0, 0)
        if clone_n >= CLONE_TIME_MIN and not official:
            findings.append(
                {
                    "code": "cloned_latency",
                    "severity": "medium",
                    "wallet": wallet,
                    "detail": f"{clone_n} answers share time_ms={common_ms}",
                }
            )

        correct = sum(1 for row in rows if row.get("is_correct"))
        if (
            not official
            and level >= 80
            and len(rows) >= PERFECT_LEGEND_MIN
            and correct == len(rows)
        ):
            findings.append(
                {
                    "code": "perfect_legend_sample",
                    "severity": "medium",
                    "wallet": wallet,
                    "detail": f"{correct}/{len(rows)} correct at level {level}",
                }
            )

        per_day: dict[str, int] = defaultdict(int)
        for row in rows:
            per_day[utc_day(row.get("created_at"))] += 1
        for day, n in per_day.items():
            if n > DAILY_MINE_BASE and not official:
                findings.append(
                    {
                        "code": "daily_cap_exceeded",
                        "severity": "high",
                        "wallet": wallet,
                        "detail": f"{n} games on {day} (base cap {DAILY_MINE_BASE} + Trade EXECs)",
                    }
                )

    farming = [item for item in findings if item["severity"] in {"high", "medium"}]
    return {
        "wallets": len(by_wallet),
        "games": len(games),
        "farming": farming,
        "findings": findings,
    }


def load_supabase(url: str, key: str, limit: int = 4000) -> dict:
    base = url.rstrip("/") + "/rest/v1"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }

    def get(path: str) -> list:
        req = urllib.request.Request(base + path, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))

    games = get(
        "/games?select=wallet,is_correct,time_ms,created_at,difficulty&order=created_at.desc"
        f"&limit={limit}"
    )
    progress = get("/player_progress?select=wallet,level,is_bot")
    return {"games": games, "progress": progress}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="MathsMine3 farming detector")
    parser.add_argument("--input", type=Path, help="JSON snapshot {games, progress}")
    parser.add_argument("--supabase", action="store_true", help="Pull from Supabase REST")
    args = parser.parse_args(argv[1:])

    if args.supabase:
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        if not url or not key:
            print("need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
            return 2
        snapshot = load_supabase(url, key)
    elif args.input:
        try:
            snapshot = json.loads(resolved_input_file(args.input).read_text(encoding="utf-8"))
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 2
    else:
        parser.print_help()
        return 2

    report = analyze(snapshot)
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")
    print(
        f"ok  farming  wallets={report['wallets']} flags={len(report['farming'])}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
