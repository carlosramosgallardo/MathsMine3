-- ============================================================
-- MATHSMINE3 — Permissions & RLS script (idempotent)
--
-- Safe to re-run on any existing instance at any time.
-- Use this to fix "permission denied" or "Transaction aborted"
-- errors, or after adding new tables to wire up RLS + grants.
--
-- For a clean install from scratch: use database.sql instead.
-- ============================================================

BEGIN;

-- ==========================================================
-- 1. ENABLE ROW LEVEL SECURITY on all tables
-- ==========================================================

ALTER TABLE IF EXISTS public.games                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.math_problems         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaderboard_data      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_progress       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_market_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_macro_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_wallet_presence   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_sell_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_market_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_visual_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_podcast_pixels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_market_commands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mm3_command_penalties ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "public_read_mm3_market_state"   ON public.mm3_market_state;
DROP POLICY IF EXISTS "public_insert_mm3_market_state" ON public.mm3_market_state;
DROP POLICY IF EXISTS "public_update_mm3_market_state" ON public.mm3_market_state;
CREATE POLICY "public_read_mm3_market_state"   ON public.mm3_market_state FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_market_state" ON public.mm3_market_state FOR INSERT TO anon WITH CHECK (id = 1);
CREATE POLICY "public_update_mm3_market_state" ON public.mm3_market_state FOR UPDATE TO anon USING (id = 1) WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_read_mm3_macro_state" ON public.mm3_macro_state;
CREATE POLICY "public_read_mm3_macro_state" ON public.mm3_macro_state FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_read_mm3_wallet_presence"   ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_presence" ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_update_mm3_wallet_presence" ON public.mm3_wallet_presence;
CREATE POLICY "public_read_mm3_wallet_presence"   ON public.mm3_wallet_presence FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_wallet_presence" ON public.mm3_wallet_presence FOR INSERT TO anon WITH CHECK (wallet <> '');
CREATE POLICY "public_update_mm3_wallet_presence" ON public.mm3_wallet_presence FOR UPDATE TO anon USING (true) WITH CHECK (wallet <> '');

DROP POLICY IF EXISTS "public_read_mm3_sell_transactions"   ON public.mm3_sell_transactions;
DROP POLICY IF EXISTS "public_insert_mm3_sell_transactions" ON public.mm3_sell_transactions;
CREATE POLICY "public_read_mm3_sell_transactions"   ON public.mm3_sell_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_sell_transactions" ON public.mm3_sell_transactions FOR INSERT TO anon WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_read_mm3_market_events"   ON public.mm3_market_events;
DROP POLICY IF EXISTS "public_insert_mm3_market_events" ON public.mm3_market_events;
CREATE POLICY "public_read_mm3_market_events"   ON public.mm3_market_events FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_market_events" ON public.mm3_market_events FOR INSERT TO anon WITH CHECK (event_type IN ('life_continue', 'nftmoji_claim', 'market_buy', 'market_resell'));

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

-- mm3_podcast_pixels: read + update
DROP POLICY IF EXISTS "public_read_mm3_podcast_pixels"   ON public.mm3_podcast_pixels;
DROP POLICY IF EXISTS "public_update_mm3_podcast_pixels" ON public.mm3_podcast_pixels;
CREATE POLICY "public_read_mm3_podcast_pixels"   ON public.mm3_podcast_pixels FOR SELECT TO anon USING (true);
CREATE POLICY "public_update_mm3_podcast_pixels" ON public.mm3_podcast_pixels FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- mm3_market_commands: read + insert (Bloque B commands)
DROP POLICY IF EXISTS "public_read_mm3_market_commands"   ON public.mm3_market_commands;
DROP POLICY IF EXISTS "public_insert_mm3_market_commands" ON public.mm3_market_commands;
CREATE POLICY "public_read_mm3_market_commands"   ON public.mm3_market_commands FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_market_commands" ON public.mm3_market_commands FOR INSERT TO anon WITH CHECK (wallet <> '' AND nftmoji_key <> '' AND command <> '');

-- mm3_command_penalties: read-only (written by service_role / admin)
DROP POLICY IF EXISTS "public_read_mm3_command_penalties" ON public.mm3_command_penalties;
CREATE POLICY "public_read_mm3_command_penalties" ON public.mm3_command_penalties FOR SELECT TO anon USING (true);

-- ==========================================================
-- 3. GRANTS to anon role
-- ==========================================================

-- Tables
GRANT SELECT          ON public.games                 TO anon;
GRANT INSERT          ON public.games                 TO anon;
GRANT SELECT          ON public.math_problems         TO anon;
GRANT SELECT          ON public.leaderboard_data      TO anon;
GRANT SELECT          ON public.player_progress       TO anon;
GRANT INSERT          ON public.player_progress       TO anon;
GRANT UPDATE          ON public.player_progress       TO anon;
GRANT SELECT          ON public.mm3_market_state      TO anon;
GRANT INSERT          ON public.mm3_market_state      TO anon;
GRANT UPDATE          ON public.mm3_market_state      TO anon;
GRANT SELECT          ON public.mm3_macro_state       TO anon;
GRANT SELECT          ON public.mm3_wallet_presence   TO anon;
GRANT INSERT          ON public.mm3_wallet_presence   TO anon;
GRANT UPDATE          ON public.mm3_wallet_presence   TO anon;
GRANT SELECT          ON public.mm3_sell_transactions TO anon;
GRANT INSERT          ON public.mm3_sell_transactions TO anon;
GRANT SELECT          ON public.mm3_market_events     TO anon;
GRANT INSERT          ON public.mm3_market_events     TO anon;
GRANT SELECT          ON public.api_requests          TO anon;
GRANT INSERT          ON public.api_requests          TO anon;
GRANT SELECT          ON public.mm3_visual_state      TO anon;
GRANT INSERT          ON public.mm3_visual_state      TO anon;
GRANT UPDATE          ON public.mm3_visual_state      TO anon;
GRANT SELECT          ON public.mm3_podcast_pixels    TO anon;
GRANT UPDATE          ON public.mm3_podcast_pixels    TO anon;
GRANT SELECT, INSERT  ON public.mm3_market_commands   TO anon;
GRANT SELECT          ON public.mm3_command_penalties TO anon;

-- Views
GRANT SELECT ON public.leaderboard_stats                TO anon;
GRANT SELECT ON public.top_positive_miner               TO anon;
GRANT SELECT ON public.daily_stats                      TO anon;
GRANT SELECT ON public.player_performance_by_difficulty TO anon;
GRANT SELECT ON public.token_value                      TO anon;
GRANT SELECT ON public.token_value_timeseries           TO anon;
GRANT SELECT ON public.difficulty_distribution          TO anon;
GRANT SELECT ON public.api_rate_summary                 TO anon;

-- Sequences (needed for SERIAL/BIGSERIAL inserts)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Functions
GRANT EXECUTE ON FUNCTION public.update_leaderboard()            TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn() TO anon;

-- ==========================================================
-- 4. Ensure the single config rows exist
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
  ticker_message    = COALESCE(NULLIF(public.mm3_macro_state.ticker_message,    ''), EXCLUDED.ticker_message),
  ticker_message_en = COALESCE(NULLIF(public.mm3_macro_state.ticker_message_en, ''), EXCLUDED.ticker_message_en),
  ticker_message_es = COALESCE(NULLIF(public.mm3_macro_state.ticker_message_es, ''), EXCLUDED.ticker_message_es);

COMMIT;
