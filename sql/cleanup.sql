-- ============================================================
-- MATHSMINE3 — One-time cleanup script (pre-v1.0 instances only)
--
-- Run once in the Supabase SQL editor if your instance was set up
-- before v1.0 and the leaderboard trigger stopped updating (caused
-- by the highest_difficulty → highest_streak column rename).
--
-- For fresh installs: use database.sql instead.
-- For permission issues: use permissions.sql instead.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. OLD VIEW: leaderboard
--    Simple aggregation view from migration 1, superseded by
--    leaderboard_data table + leaderboard_stats view.
--    Already dropped by migration 2, but kept here for safety.
-- ----------------------------------------------------------
DROP VIEW IF EXISTS public.leaderboard CASCADE;

-- ----------------------------------------------------------
-- 2. BROKEN VIEWS: still reference the removed column
--    leaderboard_data.highest_difficulty (renamed to highest_streak).
--    Drop first so the recreations below don't hit dependency errors.
-- ----------------------------------------------------------
DROP VIEW IF EXISTS public.leaderboard_stats CASCADE;

-- ----------------------------------------------------------
-- 3. BROKEN FUNCTION: update_leaderboard()
--    Migration 1 version inserts into leaderboard_data using
--    highest_difficulty which no longer exists.  The trigger
--    fires on every games INSERT, so leaderboard stops updating.
-- ----------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_leaderboard() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_update_leaderboard_fn() CASCADE;
DROP TRIGGER IF EXISTS trigger_update_leaderboard ON public.games;

-- ----------------------------------------------------------
-- 4. Recreate function with current column names
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_leaderboard()
RETURNS void AS $$
BEGIN
  DELETE FROM leaderboard_data;

  INSERT INTO leaderboard_data (
    wallet, total_eth, total_correct, total_games,
    highest_streak, current_streak, rank, updated_at
  )
  SELECT
    g.wallet,
    COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) AS total_eth,
    COALESCE(SUM(CASE WHEN g.is_correct THEN 1 ELSE 0 END), 0)               AS total_correct,
    COUNT(*)                                                                   AS total_games,
    COALESCE((
      WITH numbered AS (
        SELECT
          is_correct,
          ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY id) -
          ROW_NUMBER() OVER (PARTITION BY wallet, is_correct ORDER BY id) AS grp
        FROM games WHERE wallet = g.wallet
      ),
      streaks AS (
        SELECT COUNT(*) AS streak_length FROM numbered WHERE is_correct = true GROUP BY grp
      )
      SELECT MAX(streak_length) FROM streaks
    ), 0)                                                                      AS highest_streak,
    COALESCE((
      SELECT COUNT(*)
      FROM games sub
      WHERE sub.wallet = g.wallet
        AND sub.is_correct = true
        AND sub.id > COALESCE(
          (SELECT MAX(sub2.id) FROM games sub2
           WHERE sub2.wallet = g.wallet AND sub2.is_correct = false), 0
        )
    ), 0)                                                                      AS current_streak,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) DESC
    )                                                                          AS rank,
    NOW()                                                                      AS updated_at
  FROM games g
  GROUP BY g.wallet
  ORDER BY 2 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trigger_update_leaderboard_fn()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_leaderboard();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_leaderboard
AFTER INSERT ON public.games
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_update_leaderboard_fn();

-- ----------------------------------------------------------
-- 5. Recreate broken views with current column names
-- ----------------------------------------------------------
CREATE OR REPLACE VIEW public.leaderboard_stats AS
SELECT
  wallet,
  total_eth,
  total_correct,
  total_games,
  highest_streak AS level,
  rank,
  CASE
    WHEN total_games > 0 THEN ROUND((total_correct::NUMERIC / total_games) * 100, 2)
    ELSE 0
  END AS accuracy_percentage,
  updated_at
FROM leaderboard_data
ORDER BY rank;

-- ----------------------------------------------------------
-- 6. Re-grant access on recreated objects
-- ----------------------------------------------------------
GRANT SELECT ON public.leaderboard_stats     TO anon, authenticated, service_role;
GRANT ALL    ON FUNCTION public.update_leaderboard()              TO anon, authenticated, service_role;
GRANT ALL    ON FUNCTION public.trigger_update_leaderboard_fn()   TO anon, authenticated, service_role;

-- ----------------------------------------------------------
-- 7. Refresh leaderboard data with the fixed function
-- ----------------------------------------------------------
SELECT public.update_leaderboard();

COMMIT;
