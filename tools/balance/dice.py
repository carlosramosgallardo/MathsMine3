"""Hourly dice window — bit-identical to lib/dice.ts seededRand."""

from __future__ import annotations

import math

DICE_DURATION_MS = 15 * 60 * 1000
MODIFIER_MIN = -0.50
MODIFIER_MAX = 0.50


def u32(value: int) -> int:
    return value & 0xFFFFFFFF


def js_round(value: float) -> float:
    """Match JavaScript Math.round (half toward +Infinity)."""
    return math.floor(value + 0.5)


def seeded_rand(n: int) -> float:
    s = u32(n ^ 0xDEADBEEF)
    s = u32((s ^ (s >> 16)) * 0x45D9F3B)
    s = u32((s ^ (s >> 16)) * 0x45D9F3B)
    return u32(s ^ (s >> 16)) / 0x100000000


def get_dice_window_for_hour(hour_start_ms: int) -> dict:
    seed = hour_start_ms // 3_600_000
    r1 = seeded_rand(seed * 1664525 + 1013904223)
    r3 = seeded_rand(seed * 6364136 + 1442695041)
    start_second = math.floor(r1 * 2699) + 1
    modifier = js_round((r3 - 0.5) * 100) / 100
    start_ms = hour_start_ms + start_second * 1000
    return {
        "startMs": start_ms,
        "endMs": start_ms + DICE_DURATION_MS,
        "modifier": modifier,
    }


def nftji_drop_multiplier(modifier: float) -> float:
    """README: drop rates scale by (1 + modifier)."""
    return 1.0 + modifier
