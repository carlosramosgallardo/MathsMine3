//! Training pressure-curve lock for MathsMine3 CI.
//!
//! Web (`lib/training-game.ts`) and Android `TrainingRules` remain the
//! runtimes. This crate exists so CI can prove those copies still match —
//! not as a third gameplay implementation. WASM belongs here only when JS
//! calls this crate instead of keeping a parallel formula.

pub mod training;

pub use training::{
    fail_penalty, get_diff, mining_reward, success_delta, time_limit_ms, TRAINING_PRICE,
};
