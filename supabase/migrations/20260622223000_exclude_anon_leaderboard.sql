-- Anonymous presence IDs are session-only guests and must never become ranked wallets.
DELETE FROM public.leaderboard_data
WHERE lower(btrim(wallet)) ~ '^anon($|[-:])';

-- Ranking also merges player_progress, which is where the leaked guest row lived.
DELETE FROM public.player_progress
WHERE lower(btrim(wallet)) ~ '^anon($|[-:])';

ALTER TABLE public.leaderboard_data
  DROP CONSTRAINT IF EXISTS leaderboard_wallet_not_anonymous;

ALTER TABLE public.leaderboard_data
  ADD CONSTRAINT leaderboard_wallet_not_anonymous
  CHECK (lower(btrim(wallet)) !~ '^anon($|[-:])');

ALTER TABLE public.player_progress
  DROP CONSTRAINT IF EXISTS player_progress_wallet_not_anonymous;

ALTER TABLE public.player_progress
  ADD CONSTRAINT player_progress_wallet_not_anonymous
  CHECK (lower(btrim(wallet)) !~ '^anon($|[-:])');

CREATE OR REPLACE FUNCTION public.update_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.leaderboard_data WHERE true;

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
  SELECT
    g.wallet,
    COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN g.is_correct THEN 1 ELSE 0 END), 0),
    COUNT(*),
    COALESCE((
      WITH numbered AS (
        SELECT
          is_correct,
          ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY id) -
          ROW_NUMBER() OVER (PARTITION BY wallet, is_correct ORDER BY id) AS grp
        FROM public.games
        WHERE wallet = g.wallet
      ),
      streaks AS (
        SELECT COUNT(*) AS streak_length
        FROM numbered
        WHERE is_correct = true
        GROUP BY grp
      )
      SELECT MAX(streak_length) FROM streaks
    ), 0),
    COALESCE((
      SELECT COUNT(*)
      FROM public.games sub
      WHERE sub.wallet = g.wallet
        AND sub.is_correct = true
        AND sub.id > COALESCE((
          SELECT MAX(sub2.id)
          FROM public.games sub2
          WHERE sub2.wallet = g.wallet
            AND sub2.is_correct = false
        ), 0)
    ), 0),
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) DESC
    ),
    NOW()
  FROM public.games g
  WHERE lower(btrim(g.wallet)) !~ '^anon($|[-:])'
  GROUP BY g.wallet
  ORDER BY 2 DESC;
END;
$$;
