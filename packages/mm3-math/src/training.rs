/// Fictional MM3 unit price used by Training rewards (same default as Next.js).
pub const TRAINING_PRICE: f64 = 0.00001;

pub fn get_diff(level: i32) -> i32 {
    if level >= 70 {
        5
    } else if level >= 40 {
        4
    } else if level >= 20 {
        3
    } else if level >= 8 {
        2
    } else {
        1
    }
}

pub fn time_limit_ms(level: i32) -> i32 {
    (6000 - level * 55).max(1500)
}

pub fn fail_penalty(level: i32) -> i32 {
    if level >= 70 {
        5
    } else if level >= 40 {
        3
    } else if level >= 15 {
        2
    } else {
        1
    }
}

pub fn success_delta(level: i32) -> i32 {
    if level >= 80 {
        2
    } else {
        1
    }
}

pub fn mining_reward(elapsed_ms: i32, level: i32) -> f64 {
    let time_limit = f64::from(time_limit_ms(level));
    let reward_mult = 1.0 + f64::from(level / 10) * 0.5;
    let base = time_limit * 0.5;
    let elapsed = f64::from(elapsed_ms);
    let raw = if elapsed <= base {
        TRAINING_PRICE * ((base - elapsed) / base)
    } else {
        -TRAINING_PRICE * 0.05 * ((elapsed - base) / base).min(1.0)
    };
    raw * reward_mult
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legend_time_floor_is_1500ms() {
        assert_eq!(time_limit_ms(81), 1545);
        assert_eq!(time_limit_ms(82), 1500);
        assert_eq!(time_limit_ms(100), 1500);
    }

    #[test]
    fn fail_penalty_matches_readme_wall() {
        assert_eq!(fail_penalty(14), 1);
        assert_eq!(fail_penalty(15), 2);
        assert_eq!(fail_penalty(69), 3);
        assert_eq!(fail_penalty(70), 5);
        assert_eq!(fail_penalty(100), 5);
    }

    #[test]
    fn legend_success_is_double() {
        assert_eq!(success_delta(79), 1);
        assert_eq!(success_delta(80), 2);
    }

    #[test]
    fn instant_correct_answer_at_level_zero_pays_unit_price() {
        let reward = mining_reward(0, 0);
        assert!((reward - TRAINING_PRICE).abs() < 1e-18);
    }
}
