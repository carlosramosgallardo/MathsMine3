from dice import get_dice_window_for_hour, nftji_drop_multiplier
from simulator import PlayerModel, SeededRng, median, play_day, simulate_cohort
from training import fail_penalty, mining_reward, success_delta, time_limit_ms


def test_slow_correct_answer_never_pays():
    for level in range(0, 101):
        assert mining_reward(time_limit_ms(level), level) < 0


def test_instant_correct_answer_always_pays():
    for level in range(0, 101):
        assert mining_reward(0, level) > 0


def test_perfect_player_reaches_legend_inside_daily_cap():
    result = play_day(PlayerModel(accuracy=1, speed=0, name="perfect"), rng=SeededRng(0))
    assert result.wrong == 0
    assert result.correct == 100
    assert result.end_level == 100
    assert result.reached_legend


def test_all_fail_player_stays_on_the_floor():
    result = play_day(PlayerModel(accuracy=0, speed=1, name="brick"), rng=SeededRng(1))
    assert result.correct == 0
    assert result.end_level == 0
    assert result.mm3 == 0


def test_level_never_escapes_0_100():
    for accuracy in (0, 0.5, 1):
        result = play_day(PlayerModel(accuracy=accuracy, speed=0.2), start_level=90, rng=SeededRng(7))
        assert 0 <= result.end_level <= 100


def test_legend_coin_flip_cannot_hold_the_wall():
    """README: one miss at 70+ costs 5 levels; 50% accuracy must slide down."""
    model = PlayerModel(accuracy=0.5, speed=0.3, name="coin-flip")
    results = simulate_cohort(model, n=400, start_level=80, seed=42)
    assert median([row.end_level for row in results]) < 80
    assert fail_penalty(80) == 5
    assert success_delta(80) == 2


def test_seeded_rng_is_deterministic():
    first = SeededRng(42)
    second = SeededRng(42)
    assert [first.random() for _ in range(8)] == [second.random() for _ in range(8)]
    assert SeededRng(1).randrange(1000) != SeededRng(2).randrange(1000)


def test_dice_modifier_and_drop_mult_stay_in_documented_band():
    hour0 = 1_704_067_200_000  # 2024-01-01 UTC
    modifiers = []
    for hour in range(24 * 30):
        window = get_dice_window_for_hour(hour0 + hour * 3_600_000)
        assert window["endMs"] - window["startMs"] == 15 * 60 * 1000
        assert -0.50 <= window["modifier"] <= 0.50
        mult = nftji_drop_multiplier(window["modifier"])
        assert 0.50 <= mult <= 1.50
        modifiers.append(window["modifier"])
    assert min(modifiers) < 0
    assert max(modifiers) > 0
