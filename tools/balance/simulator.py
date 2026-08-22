"""Monte Carlo Training day — economy wall, MM3 sign, and daily-cap climb."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from training import (
    DAILY_MINE_BASE,
    fail_penalty,
    mining_reward,
    success_delta,
    time_limit_ms,
)


class SeededRng:
    """Deterministic SHA-256 stream for economy Monte Carlo (Sonar python:S2245)."""

    __slots__ = ("_n",)

    def __init__(self, seed: int = 0) -> None:
        self._n = int(seed) & 0xFFFFFFFFFFFFFFFF

    def _next_digest(self) -> bytes:
        self._n = (self._n + 1) & 0xFFFFFFFFFFFFFFFF
        return hashlib.sha256(self._n.to_bytes(8, "big")).digest()

    def random(self) -> float:
        return int.from_bytes(self._next_digest()[:8], "big") / float(1 << 64)

    def randrange(self, stop: int) -> int:
        if stop <= 0:
            raise ValueError("empty range for randrange()")
        return int.from_bytes(self._next_digest()[:8], "big") % stop


@dataclass(frozen=True)
class PlayerModel:
    """accuracy in [0, 1]; speed 0 = instant, 1 = full time-limit."""

    accuracy: float
    speed: float
    name: str = "player"


@dataclass
class DayResult:
    start_level: int
    end_level: int
    mm3: float
    correct: int
    wrong: int
    reached_legend: bool


def clamp_level(level: int) -> int:
    return max(0, min(100, level))


def play_day(model: PlayerModel, start_level: int = 0, rng: SeededRng | None = None) -> DayResult:
    rng = rng or SeededRng(0)
    level = clamp_level(start_level)
    mm3 = 0.0
    correct = 0
    wrong = 0
    for _ in range(DAILY_MINE_BASE):
        elapsed = int(model.speed * time_limit_ms(level))
        if rng.random() < model.accuracy:
            mm3 += mining_reward(elapsed, level)
            level = clamp_level(level + success_delta(level))
            correct += 1
        else:
            level = clamp_level(level - fail_penalty(level))
            wrong += 1
    return DayResult(
        start_level=start_level,
        end_level=level,
        mm3=mm3,
        correct=correct,
        wrong=wrong,
        reached_legend=level >= 80,
    )


def median(values: list[int]) -> float:
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2


def simulate_cohort(
    model: PlayerModel,
    n: int,
    start_level: int,
    seed: int = 1,
) -> list[DayResult]:
    parent = SeededRng(seed)
    return [
        play_day(model, start_level=start_level, rng=SeededRng(parent.randrange(1 << 30)))
        for _ in range(n)
    ]
