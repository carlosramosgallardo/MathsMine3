-- Zero-Day 👾 — Trading NFTJI.
-- Drops with 5% probability on every trading EXEC (players + ai_team bots).
-- Same level semantics as the training luckies: -1 = never owned, first
-- claim sets 0, each re-drop +1. Ownership itself rides wallet_emojis ('👾').
alter table player_progress
  add column if not exists zero_day_level integer not null default -1;
