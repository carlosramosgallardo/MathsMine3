"""Training pressure-curve checks (Gherkin + README invariants)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from training import (
    TRAINING_PRICE,
    fail_penalty,
    get_diff,
    mining_reward,
    spec_row,
    success_delta,
    time_limit_ms,
)

ROOT = Path(__file__).resolve().parents[2]
FEATURE = ROOT / "features" / "training.feature"

COLUMN_TO_FN = {
    "diff": get_diff,
    "penalty": fail_penalty,
    "delta": success_delta,
    "ms": time_limit_ms,
}


def parse_examples(text: str) -> list[dict[str, int]]:
    rows: list[dict[str, int]] = []
    in_table = False
    headers: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("|") and "level" in line.replace(" ", "").lower():
            headers = [cell.strip() for cell in line.strip("|").split("|")]
            in_table = True
            continue
        if in_table and line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            rows.append({headers[i]: int(cells[i]) for i in range(len(headers))})
            continue
        if in_table and not line.startswith("|"):
            in_table = False
    return rows


def check_gherkin() -> None:
    examples = parse_examples(FEATURE.read_text(encoding="utf-8"))
    if len(examples) < 20:
        raise SystemExit(f"too few Gherkin examples: {len(examples)}")
    for row in examples:
        level = row["level"]
        for column, expected in row.items():
            if column == "level":
                continue
            actual = COLUMN_TO_FN[column](level)
            if actual != expected:
                raise SystemExit(
                    f"level {level}: {column} expected {expected}, got {actual}"
                )


def _spec_int(rows: list[dict[str, int]], level: int, column: str) -> int:
    for row in rows:
        if row.get("level") == level and column in row:
            return row[column]
    raise SystemExit(f"missing Gherkin cell level={level} {column}")


def check_invariants() -> None:
    # Read expected floors from the feature file so these are regression checks,
    # not compile-time constants (Sonar pythonbugs:S2583).
    examples = parse_examples(FEATURE.read_text(encoding="utf-8"))
    legend_ms = _spec_int(examples, 100, "ms")
    if time_limit_ms(100) != legend_ms:
        raise SystemExit(f"LEGEND time limit must floor at {legend_ms} ms")
    high_penalty = _spec_int(examples, 70, "penalty")
    if fail_penalty(95) != high_penalty:
        raise SystemExit(f"level 95+ fail penalty must match 70+ band ({high_penalty})")
    legend_delta = _spec_int(examples, 80, "delta")
    if success_delta(80) != legend_delta:
        raise SystemExit(f"LEGEND success delta must be {legend_delta}")
    instant = mining_reward(0, 0)
    if abs(instant - TRAINING_PRICE) > 1e-18:
        raise SystemExit(f"level-0 instant reward drifted: {instant}")


def dump_spec() -> None:
    for level in range(0, 101):
        print(json.dumps(spec_row(level), sort_keys=True, separators=(",", ":")))


def main(argv: list[str]) -> int:
    if argv[1:] == ["--dump"]:
        dump_spec()
        return 0
    check_gherkin()
    check_invariants()
    print(f"ok  gherkin={FEATURE.relative_to(ROOT)}  levels=0..100")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
