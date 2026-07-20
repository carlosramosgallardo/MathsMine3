-- Cleanup: drop three tables with zero references anywhere in app/api or lib
-- code (verified by repo-wide grep before writing this migration):
--   - mm3_game_winner    — singleton "game winner" row, superseded by the
--     current chain-solve/leaderboard flow; nothing reads or writes it.
--   - mm3_player_positions — position seeding for new joiners, superseded by
--     realtime presence broadcast (see project memory: realtime budget).
--   - mm3_visual_state   — a single color_hex row; the current visual system
--     (per-wallet HSL accent colors) doesn't read from the DB.
-- Not applied automatically — review for any data worth keeping before running.
drop table if exists mm3_game_winner cascade;
drop table if exists mm3_player_positions cascade;
drop table if exists mm3_visual_state cascade;
