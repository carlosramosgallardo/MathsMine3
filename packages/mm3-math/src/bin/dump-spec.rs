use mm3_math::{fail_penalty, get_diff, success_delta, time_limit_ms};

fn main() {
    for level in 0..=100 {
        println!(
            r#"{{"diff":{},"failPenalty":{},"level":{},"successDelta":{},"timeLimitMs":{}}}"#,
            get_diff(level),
            fail_penalty(level),
            level,
            success_delta(level),
            time_limit_ms(level)
        );
    }
}
