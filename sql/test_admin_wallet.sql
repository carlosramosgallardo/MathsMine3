-- ============================================================
-- MATHSMINE3 — test admin wallet boost
--
-- Gives the admin wallet:
--   - Level 100
--   - 1,000 available MM3 for UI/ranking purposes
--   - 1,000 in each in-game Money balance rail (EUR/USD/CNY)
--
-- This does NOT write to games, mm3_market_events, or mm3_market_state,
-- so it does not change the global MM3 total/value views.
--
-- Re-run after update_leaderboard() or a reset if the denormalized
-- leaderboard_data row is rebuilt.
-- ============================================================

BEGIN;

INSERT INTO public.player_progress (
  wallet,
  level,
  mm3_sold,
  cny_earned,
  eur_earned,
  usd_earned,
  updated_at
)
VALUES (
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
  100,
  0,
  1000,
  1000,
  1000,
  NOW()
)
ON CONFLICT (wallet) DO UPDATE SET
  level      = 100,
  mm3_sold   = 0,
  cny_earned = 1000,
  eur_earned = 1000,
  usd_earned = 1000,
  updated_at = NOW();

-- Keep any existing rank ordering mostly intact while putting admin first.
UPDATE public.leaderboard_data
SET rank = rank + 1,
    updated_at = NOW()
WHERE wallet <> '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
  AND rank >= 1;

INSERT INTO public.leaderboard_data (
  wallet,
  total_eth,
  total_correct,
  total_games,
  highest_streak,
  current_streak,
  rank,
  updated_at
)
VALUES (
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
  1000,
  0,
  0,
  0,
  0,
  1,
  NOW()
)
ON CONFLICT (wallet) DO UPDATE SET
  total_eth      = 1000,
  total_correct  = GREATEST(public.leaderboard_data.total_correct, 0),
  total_games    = GREATEST(public.leaderboard_data.total_games, 0),
  highest_streak = GREATEST(public.leaderboard_data.highest_streak, 0),
  current_streak = GREATEST(public.leaderboard_data.current_streak, 0),
  rank           = 1,
  updated_at     = NOW();

COMMIT;
