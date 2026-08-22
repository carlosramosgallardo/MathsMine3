"""Training pressure curve — same rules as lib/training-game.ts and TrainingRules."""

DAILY_MINE_BASE = 100
TRAINING_PRICE = 0.00001


def get_diff(level: int) -> int:
    if level >= 70:
        return 5
    if level >= 40:
        return 4
    if level >= 20:
        return 3
    if level >= 8:
        return 2
    return 1


def time_limit_ms(level: int) -> int:
    return max(1500, 6000 - level * 55)


def fail_penalty(level: int) -> int:
    if level >= 70:
        return 5
    if level >= 40:
        return 3
    if level >= 15:
        return 2
    return 1


def success_delta(level: int) -> int:
    return 2 if level >= 80 else 1


def mining_reward(elapsed_ms: int, level: int) -> float:
    time_limit = time_limit_ms(level)
    reward_mult = 1 + (level // 10) * 0.5
    base = time_limit * 0.5
    if elapsed_ms <= base:
        raw = TRAINING_PRICE * ((base - elapsed_ms) / base)
    else:
        raw = -TRAINING_PRICE * 0.05 * min((elapsed_ms - base) / base, 1)
    return raw * reward_mult


def spec_row(level: int) -> dict:
    return {
        "diff": get_diff(level),
        "failPenalty": fail_penalty(level),
        "level": level,
        "successDelta": success_delta(level),
        "timeLimitMs": time_limit_ms(level),
    }
