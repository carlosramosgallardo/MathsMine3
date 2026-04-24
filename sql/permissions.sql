-- ============================================================
-- MATHSMINE3 — Permissions & RLS script (idempotent)
--
-- Safe to re-run on any existing instance at any time.
-- Use this to fix "permission denied" or "Transaction aborted"
-- errors, or after adding new tables to wire up RLS + grants.
--
-- Creates tables with IF NOT EXISTS, so it will not overwrite data.
-- For a clean install from scratch: use database.sql instead.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mm3_macro_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  war_percent NUMERIC NOT NULL DEFAULT 0 CHECK (war_percent >= 0 AND war_percent <= 100),
  nature_percent NUMERIC NOT NULL DEFAULT 0 CHECK (nature_percent >= 0 AND nature_percent <= 100),
  ticker_message TEXT NOT NULL DEFAULT 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  ticker_message_en TEXT NOT NULL DEFAULT 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  ticker_message_es TEXT NOT NULL DEFAULT 'BIENVENIDO A MATHSMINE3 // RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.mm3_macro_state
  ADD COLUMN IF NOT EXISTS ticker_message TEXT NOT NULL DEFAULT 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME';
ALTER TABLE IF EXISTS public.mm3_macro_state
  ADD COLUMN IF NOT EXISTS ticker_message_en TEXT NOT NULL DEFAULT 'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME';
ALTER TABLE IF EXISTS public.mm3_macro_state
  ADD COLUMN IF NOT EXISTS ticker_message_es TEXT NOT NULL DEFAULT 'BIENVENIDO A MATHSMINE3 // RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO';

CREATE TABLE IF NOT EXISTS public.mm3_wallet_presence (
  wallet TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'wallet' CHECK (source IN ('wallet', 'google')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mm3_wallet_presence_last_seen
  ON public.mm3_wallet_presence(last_seen DESC);

-- ==========================================================
-- 1. ENABLE ROW LEVEL SECURITY on all tables
-- ==========================================================

ALTER TABLE IF EXISTS public.games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.math_problems     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaderboard_data  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_market_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_macro_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_wallet_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_sell_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_visual_state  ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 2. RLS POLICIES  (drop+create = idempotent)
-- ==========================================================

-- games: anyone can read and insert
DROP POLICY IF EXISTS "public_read_games"   ON public.games;
DROP POLICY IF EXISTS "public_insert_games" ON public.games;
CREATE POLICY "public_read_games"   ON public.games FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_games" ON public.games FOR INSERT TO anon WITH CHECK (true);

-- math_problems: read-only
DROP POLICY IF EXISTS "public_read_math_problems" ON public.math_problems;
CREATE POLICY "public_read_math_problems" ON public.math_problems FOR SELECT TO anon USING (true);

-- leaderboard_data: read-only (writes come from the trigger as service_role)
DROP POLICY IF EXISTS "public_read_leaderboard_data" ON public.leaderboard_data;
CREATE POLICY "public_read_leaderboard_data" ON public.leaderboard_data FOR SELECT TO anon USING (true);

-- player_progress: per-wallet persistent level storage
DROP POLICY IF EXISTS "public_read_player_progress"   ON public.player_progress;
DROP POLICY IF EXISTS "public_insert_player_progress" ON public.player_progress;
DROP POLICY IF EXISTS "public_update_player_progress" ON public.player_progress;
CREATE POLICY "public_read_player_progress"   ON public.player_progress FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_player_progress" ON public.player_progress FOR INSERT TO anon WITH CHECK (level >= 0 AND level <= 100);
CREATE POLICY "public_update_player_progress" ON public.player_progress FOR UPDATE TO anon USING (true) WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_read_mm3_market_state" ON public.mm3_market_state;
DROP POLICY IF EXISTS "public_insert_mm3_market_state" ON public.mm3_market_state;
DROP POLICY IF EXISTS "public_update_mm3_market_state" ON public.mm3_market_state;
CREATE POLICY "public_read_mm3_market_state" ON public.mm3_market_state FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_market_state" ON public.mm3_market_state FOR INSERT TO anon WITH CHECK (id = 1);
CREATE POLICY "public_update_mm3_market_state" ON public.mm3_market_state FOR UPDATE TO anon USING (id = 1) WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_read_mm3_macro_state" ON public.mm3_macro_state;
CREATE POLICY "public_read_mm3_macro_state" ON public.mm3_macro_state FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_read_mm3_wallet_presence" ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_presence" ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_update_mm3_wallet_presence" ON public.mm3_wallet_presence;
CREATE POLICY "public_read_mm3_wallet_presence" ON public.mm3_wallet_presence FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_wallet_presence" ON public.mm3_wallet_presence FOR INSERT TO anon WITH CHECK (wallet <> '');
CREATE POLICY "public_update_mm3_wallet_presence" ON public.mm3_wallet_presence FOR UPDATE TO anon USING (true) WITH CHECK (wallet <> '');

DROP POLICY IF EXISTS "public_read_mm3_sell_transactions" ON public.mm3_sell_transactions;
DROP POLICY IF EXISTS "public_insert_mm3_sell_transactions" ON public.mm3_sell_transactions;
CREATE POLICY "public_read_mm3_sell_transactions" ON public.mm3_sell_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_sell_transactions" ON public.mm3_sell_transactions FOR INSERT TO anon WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_read_mm3_market_events" ON public.mm3_market_events;
DROP POLICY IF EXISTS "public_insert_mm3_market_events" ON public.mm3_market_events;
CREATE POLICY "public_read_mm3_market_events" ON public.mm3_market_events FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_market_events" ON public.mm3_market_events FOR INSERT TO anon WITH CHECK (event_type IN ('life_continue', 'nftmoji_claim'));

-- api_requests: read + insert for rate-limiting
DROP POLICY IF EXISTS "public_read_api_requests"   ON public.api_requests;
DROP POLICY IF EXISTS "public_insert_api_requests" ON public.api_requests;
CREATE POLICY "public_read_api_requests"   ON public.api_requests FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_api_requests" ON public.api_requests FOR INSERT TO anon WITH CHECK (true);

-- mm3_visual_state: read + upsert (restricted to the single config row, id = 1)
DROP POLICY IF EXISTS "public_read_visual_state"   ON public.mm3_visual_state;
DROP POLICY IF EXISTS "public_insert_visual_state" ON public.mm3_visual_state;
DROP POLICY IF EXISTS "public_update_visual_state" ON public.mm3_visual_state;
CREATE POLICY "public_read_visual_state"   ON public.mm3_visual_state FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_visual_state" ON public.mm3_visual_state FOR INSERT TO anon WITH CHECK (id = 1);
CREATE POLICY "public_update_visual_state" ON public.mm3_visual_state FOR UPDATE TO anon USING (id = 1) WITH CHECK (id = 1);


-- ==========================================================
-- 3. GRANTS to anon role
-- ==========================================================

-- Tables
GRANT SELECT          ON public.games            TO anon;
GRANT INSERT          ON public.games            TO anon;

GRANT SELECT          ON public.math_problems    TO anon;

GRANT SELECT          ON public.leaderboard_data TO anon;

GRANT SELECT          ON public.player_progress TO anon;
GRANT INSERT          ON public.player_progress TO anon;
GRANT UPDATE          ON public.player_progress TO anon;

GRANT SELECT          ON public.mm3_market_state TO anon;
GRANT INSERT          ON public.mm3_market_state TO anon;
GRANT UPDATE          ON public.mm3_market_state TO anon;

GRANT SELECT          ON public.mm3_macro_state TO anon;

GRANT SELECT          ON public.mm3_wallet_presence TO anon;
GRANT INSERT          ON public.mm3_wallet_presence TO anon;
GRANT UPDATE          ON public.mm3_wallet_presence TO anon;

GRANT SELECT          ON public.mm3_sell_transactions TO anon;
GRANT INSERT          ON public.mm3_sell_transactions TO anon;

GRANT SELECT          ON public.mm3_market_events TO anon;
GRANT INSERT          ON public.mm3_market_events TO anon;

GRANT SELECT          ON public.api_requests     TO anon;
GRANT INSERT          ON public.api_requests     TO anon;

GRANT SELECT          ON public.mm3_visual_state TO anon;
GRANT INSERT          ON public.mm3_visual_state TO anon;
GRANT UPDATE          ON public.mm3_visual_state TO anon;


-- Views
GRANT SELECT ON public.leaderboard_stats                 TO anon;
GRANT SELECT ON public.top_positive_miner                TO anon;
GRANT SELECT ON public.daily_stats                       TO anon;
GRANT SELECT ON public.player_performance_by_difficulty  TO anon;
GRANT SELECT ON public.token_value                       TO anon;
GRANT SELECT ON public.token_value_timeseries            TO anon;
GRANT SELECT ON public.difficulty_distribution           TO anon;
GRANT SELECT ON public.api_rate_summary                  TO anon;
-- Sequences (needed for SERIAL/BIGSERIAL inserts)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Functions
GRANT EXECUTE ON FUNCTION public.update_leaderboard()            TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn() TO anon;

-- ==========================================================
-- 5. SECURITY DEFINER on trigger functions
--    Without this, the DELETE inside update_leaderboard()
--    runs as the calling anon role, which has no DELETE policy
--    on leaderboard_data — Supabase blocks it with
--    "DELETE requires a WHERE clause".
-- ==========================================================

CREATE OR REPLACE FUNCTION public.update_leaderboard()
RETURNS void AS $$
BEGIN
  DELETE FROM leaderboard_data WHERE true;

  INSERT INTO leaderboard_data (wallet, total_eth, total_correct, total_games, highest_streak, current_streak, rank, updated_at)
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
      streaks AS (SELECT COUNT(*) AS streak_length FROM numbered WHERE is_correct = true GROUP BY grp)
      SELECT MAX(streak_length) FROM streaks
    ), 0) AS highest_streak,
    COALESCE((
      SELECT COUNT(*) FROM games sub
      WHERE sub.wallet = g.wallet AND sub.is_correct = true
        AND sub.id > COALESCE(
          (SELECT MAX(sub2.id) FROM games sub2 WHERE sub2.wallet = g.wallet AND sub2.is_correct = false), 0
        )
    ), 0) AS current_streak,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) DESC) AS rank,
    NOW() AS updated_at
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

-- ==========================================================
-- 4. Ensure the single config row exists in mm3_visual_state
-- ==========================================================
INSERT INTO public.mm3_visual_state (id, color_hex)
VALUES (1, '#000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mm3_market_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mm3_macro_state (id, war_percent, nature_percent, ticker_message, ticker_message_en, ticker_message_es)
VALUES (
  1,
  0,
  0,
  'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  'WELCOME TO MATHSMINE3 // SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME',
  'BIENVENIDO A MATHSMINE3 // RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO'
)
ON CONFLICT (id) DO UPDATE
SET
  ticker_message = COALESCE(NULLIF(public.mm3_macro_state.ticker_message, ''), EXCLUDED.ticker_message),
  ticker_message_en = COALESCE(NULLIF(public.mm3_macro_state.ticker_message_en, ''), EXCLUDED.ticker_message_en),
  ticker_message_es = COALESCE(NULLIF(public.mm3_macro_state.ticker_message_es, ''), EXCLUDED.ticker_message_es);

COMMIT;
