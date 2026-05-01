-- ============================================
-- MATHSMINE3 COMPLETE DATABASE SCHEMA
-- Drops and recreates everything from scratch
-- ============================================

BEGIN;

-- ==============================================
-- PHASE 1: DROP EVERYTHING (in correct order)
-- ==============================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS top_positive_miner CASCADE;
DROP VIEW IF EXISTS token_value CASCADE;
DROP VIEW IF EXISTS token_value_timeseries CASCADE;
-- Drop functions and triggers
DROP TRIGGER IF EXISTS trigger_update_leaderboard ON games;
DROP FUNCTION IF EXISTS trigger_update_leaderboard_fn();
DROP FUNCTION IF EXISTS update_leaderboard();

-- Drop tables
DROP TABLE IF EXISTS mm3_command_penalties CASCADE;
DROP TABLE IF EXISTS mm3_hidden_cmd_executions CASCADE;
DROP TABLE IF EXISTS mm3_market_commands CASCADE;
DROP TABLE IF EXISTS mm3_sell_transactions CASCADE;
DROP TABLE IF EXISTS mm3_market_events CASCADE;
DROP TABLE IF EXISTS mm3_market_state CASCADE;
DROP TABLE IF EXISTS mm3_macro_state CASCADE;
DROP TABLE IF EXISTS mm3_wallet_presence CASCADE;
DROP TABLE IF EXISTS player_progress CASCADE;
DROP TABLE IF EXISTS leaderboard_data CASCADE;
DROP TABLE IF EXISTS math_problems CASCADE;
DROP TABLE IF EXISTS api_requests CASCADE;
DROP TABLE IF EXISTS mm3_visual_state CASCADE;
DROP TABLE IF EXISTS mm3_market_blocks CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS games_id_seq;

-- ==============================================
-- PHASE 2: CREATE TABLES
-- ==============================================

-- Games table (main transaction log)
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  problem TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER NOT NULL,
  mining_reward NUMERIC DEFAULT 0,
  problem_id BIGINT,
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
  problem_type TEXT CHECK (problem_type IN ('arithmetic', 'operator_fix', 'digit_fix', 'powers', 'sequence', 'definition', 'modulo', 'logic', 'fractions', 'primes', 'geometry', 'percentage', 'algebra')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Math problems table (dynamic problem bank)
CREATE TABLE math_problems (
  id BIGSERIAL PRIMARY KEY,
  problem_type TEXT NOT NULL CHECK (problem_type IN (
    'arithmetic', 'operator_fix', 'digit_fix', 'powers', 'sequence', 'definition',
    'modulo', 'logic', 'fractions', 'primes', 'geometry', 'percentage', 'algebra'
  )),
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  answer_options TEXT[] DEFAULT NULL,
  is_definition_type BOOLEAN DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  base_points NUMERIC NOT NULL DEFAULT 0.00001,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard data (denormalized for performance)
CREATE TABLE leaderboard_data (
  wallet TEXT PRIMARY KEY,
  total_eth NUMERIC DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  highest_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Persistent player progress by wallet
CREATE TABLE player_progress (
  wallet TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 100),
  mm3_sold NUMERIC NOT NULL DEFAULT 0,
  cny_earned NUMERIC NOT NULL DEFAULT 0,
  eur_earned NUMERIC NOT NULL DEFAULT 0,
  usd_earned NUMERIC NOT NULL DEFAULT 0,
  wallet_emojis TEXT[] NOT NULL DEFAULT '{}',
  market_nftji_key TEXT,
  market_nftji_price NUMERIC NOT NULL DEFAULT 0,
  market_nftji_since TIMESTAMPTZ,
  life_used BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_50_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_100_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_500_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_1000_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  sell_rate_cny NUMERIC NOT NULL DEFAULT 0,
  sell_quote_cny NUMERIC NOT NULL DEFAULT 0,
  sell_quote_eur NUMERIC NOT NULL DEFAULT 0,
  sell_quote_usd NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_market_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_mm3 NUMERIC NOT NULL DEFAULT 0,
  commission_cny NUMERIC NOT NULL DEFAULT 0,
  commission_eur NUMERIC NOT NULL DEFAULT 0,
  commission_usd NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_sell_transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wallet' CHECK (source IN ('wallet', 'google')),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 100),
  mm3_amount NUMERIC NOT NULL DEFAULT 0,
  mm3_commission NUMERIC NOT NULL DEFAULT 0,
  rate_cny NUMERIC NOT NULL DEFAULT 0,
  gross_cny NUMERIC NOT NULL DEFAULT 0,
  gross_eur NUMERIC NOT NULL DEFAULT 0,
  gross_usd NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_cny NUMERIC NOT NULL DEFAULT 0,
  commission_eur NUMERIC NOT NULL DEFAULT 0,
  commission_usd NUMERIC NOT NULL DEFAULT 0,
  net_cny NUMERIC NOT NULL DEFAULT 0,
  net_eur NUMERIC NOT NULL DEFAULT 0,
  net_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_market_events (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('life_continue', 'nftji_claim', 'market_buy', 'market_resell')),
  delta_mm3 NUMERIC NOT NULL DEFAULT 0,
  emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_macro_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  war_percent NUMERIC NOT NULL DEFAULT 0 CHECK (war_percent >= 0 AND war_percent <= 100),
  nature_percent NUMERIC NOT NULL DEFAULT 0 CHECK (nature_percent >= 0 AND nature_percent <= 100),
  ticker_message TEXT NOT NULL DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_en TEXT NOT NULL DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_es TEXT NOT NULL DEFAULT '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_wallet_presence (
  wallet TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'wallet' CHECK (source IN ('wallet', 'google')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Request Tracking
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- MM3 Visual State
CREATE TABLE mm3_visual_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  color_hex TEXT NOT NULL DEFAULT '#000000',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market NFTJI blocks (formerly mm3_podcast_pixels)
CREATE TABLE mm3_market_blocks (
  id BIGSERIAL PRIMARY KEY,
  block_key TEXT NOT NULL UNIQUE,
  grid_row INTEGER NOT NULL,
  grid_col INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  title_es TEXT NOT NULL DEFAULT '',
  answer_hash TEXT NOT NULL,
  price_eur NUMERIC NOT NULL DEFAULT 1 CHECK (price_eur >= 0),
  short_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  claimed_by TEXT,
  claimed_source TEXT CHECK (claimed_source IN ('wallet', 'google')),
  claimed_at TIMESTAMPTZ,
  first_purchased_at TIMESTAMPTZ,
  paid_eur NUMERIC NOT NULL DEFAULT 0,
  paid_usd NUMERIC NOT NULL DEFAULT 0,
  paid_cny NUMERIC NOT NULL DEFAULT 0,
  market_command TEXT NOT NULL DEFAULT '',
  formula_x INTEGER NOT NULL DEFAULT 123,
  formula_result_5d TEXT NOT NULL DEFAULT '',
  hidden_command TEXT NOT NULL DEFAULT '',
  hidden_cmd_min_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_market_commands (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  nftji_key TEXT NOT NULL,
  command TEXT NOT NULL,
  numeric_code TEXT NOT NULL DEFAULT '',
  formula_x INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_command_penalties (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  command_id BIGINT REFERENCES mm3_market_commands(id) ON DELETE CASCADE,
  nftji_key TEXT NOT NULL DEFAULT '',
  penalty_code TEXT NOT NULL,
  penalty_effect TEXT NOT NULL DEFAULT 'money' CHECK (penalty_effect IN ('money', 'mm3')),
  penalty_value NUMERIC NOT NULL DEFAULT 0,
  penalty_eur NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  attempted_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_hidden_cmd_executions (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  block_key TEXT NOT NULL,
  amount_eur NUMERIC NOT NULL DEFAULT 0,
  amount_mm3 NUMERIC NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IRC Messages table (permanent — no retention policy)
CREATE TABLE mm3_irc_messages (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  text TEXT NOT NULL,
  ts BIGINT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat', 'system')),
  tone TEXT NOT NULL DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- PHASE 3: CREATE INDEXES
-- ==============================================

CREATE INDEX idx_games_wallet ON games(wallet);
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_games_wallet_correct ON games(wallet, is_correct);

CREATE INDEX idx_problems_type ON math_problems(problem_type);
CREATE INDEX idx_problems_difficulty ON math_problems(difficulty);
CREATE INDEX idx_problems_type_difficulty ON math_problems(problem_type, difficulty);
CREATE INDEX idx_problems_language_difficulty ON math_problems(language, difficulty);

CREATE INDEX idx_leaderboard_data_total_eth ON leaderboard_data(total_eth DESC);
CREATE INDEX idx_player_progress_level ON player_progress(level DESC);
CREATE INDEX idx_mm3_wallet_presence_last_seen ON mm3_wallet_presence(last_seen DESC);
CREATE INDEX idx_mm3_sell_transactions_wallet ON mm3_sell_transactions(wallet);
CREATE INDEX idx_mm3_sell_transactions_created_at ON mm3_sell_transactions(created_at DESC);
CREATE INDEX idx_mm3_market_events_wallet ON mm3_market_events(wallet);
CREATE INDEX idx_mm3_market_events_created_at ON mm3_market_events(created_at DESC);
CREATE INDEX idx_mm3_market_blocks_claimed_by ON mm3_market_blocks(claimed_by);
CREATE INDEX idx_player_progress_market_nftji_key ON player_progress(market_nftji_key) WHERE market_nftji_key IS NOT NULL;
CREATE INDEX idx_mm3_market_commands_wallet ON mm3_market_commands(wallet);
CREATE INDEX idx_mm3_market_commands_nftji_key_reset ON mm3_market_commands(nftji_key, reset_at DESC);
CREATE INDEX idx_mm3_command_penalties_wallet ON mm3_command_penalties(wallet);
CREATE INDEX idx_mm3_command_penalties_active ON mm3_command_penalties(wallet, reset_at DESC) WHERE redeemed_at IS NULL;
CREATE INDEX idx_mm3_hidden_cmd_executions_wallet_block ON mm3_hidden_cmd_executions(wallet, block_key, executed_at DESC);
CREATE INDEX idx_mm3_irc_messages_wallet ON mm3_irc_messages(wallet);
CREATE INDEX idx_mm3_irc_messages_ts ON mm3_irc_messages(ts DESC);
CREATE INDEX idx_mm3_irc_messages_created_at ON mm3_irc_messages(created_at DESC);

-- ==============================================
-- PHASE 4: CREATE FUNCTIONS
-- ==============================================

-- Utility function to update leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.leaderboard_data WHERE true;

  INSERT INTO public.leaderboard_data (wallet, total_eth, total_correct, total_games, highest_streak, current_streak, rank, updated_at)
  SELECT
    g.wallet,
    COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) as total_eth,
    COALESCE(SUM(CASE WHEN g.is_correct THEN 1 ELSE 0 END), 0) as total_correct,
    COUNT(*) as total_games,
    -- Calculate highest streak by finding max consecutive correct answers
    COALESCE((
      WITH numbered AS (
        SELECT
          is_correct,
          ROW_NUMBER() OVER (PARTITION BY wallet ORDER BY id) -
          ROW_NUMBER() OVER (PARTITION BY wallet, is_correct ORDER BY id) as grp
        FROM public.games
        WHERE wallet = g.wallet
      ),
      streaks AS (
        SELECT COUNT(*) as streak_length
        FROM numbered
        WHERE is_correct = true
        GROUP BY grp
      )
      SELECT MAX(streak_length) FROM streaks
    ), 0) as highest_streak,
    -- Current streak = consecutive correct answers after the last wrong one
    COALESCE((
      SELECT COUNT(*)
      FROM public.games sub
      WHERE sub.wallet = g.wallet
        AND sub.is_correct = true
        AND sub.id > COALESCE(
          (SELECT MAX(sub2.id) FROM public.games sub2
           WHERE sub2.wallet = g.wallet AND sub2.is_correct = false), 0
        )
    ), 0) as current_streak,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN g.is_correct THEN g.mining_reward ELSE 0 END), 0) DESC) as rank,
    NOW() as updated_at
  FROM public.games g
  GROUP BY g.wallet
  ORDER BY 2 DESC;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION trigger_update_leaderboard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_leaderboard();
  RETURN NULL;
END;
$$;

-- ==============================================
-- PHASE 5: CREATE TRIGGERS
-- ==============================================

CREATE TRIGGER trigger_update_leaderboard
AFTER INSERT ON games
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_update_leaderboard_fn();

-- ==============================================
-- PHASE 6: CREATE VIEWS
-- ==============================================

-- Top Positive Miner (used by use-mm3-accent.js)
CREATE OR REPLACE VIEW top_positive_miner AS
SELECT
  wallet,
  total_eth as pos_total,
  rank
FROM leaderboard_data
WHERE total_eth > 0
ORDER BY total_eth DESC
LIMIT 1;

-- Token Value
CREATE OR REPLACE VIEW token_value AS
SELECT
  COALESCE(SUM(mining_reward), 0)
    + COALESCE((SELECT commission_mm3 FROM mm3_market_state WHERE id = 1), 0)
    + COALESCE((SELECT SUM(delta_mm3) FROM mm3_market_events), 0) AS total_eth,
  COALESCE((SELECT commission_mm3 FROM mm3_market_state WHERE id = 1), 0) AS commission_pool_mm3,
  (SELECT COUNT(*) FROM games WHERE is_correct = TRUE) as total_correct_answers,
  (SELECT COUNT(DISTINCT wallet) FROM games) as total_players
FROM games
WHERE is_correct = TRUE;

-- Token Value Timeseries
CREATE OR REPLACE VIEW token_value_timeseries AS
WITH raw_events AS (
  SELECT date_trunc('hour', created_at) AS hour, SUM(mining_reward) AS delta_mm3
  FROM games
  WHERE is_correct = TRUE
  GROUP BY date_trunc('hour', created_at)
  UNION ALL
  SELECT date_trunc('hour', created_at) AS hour, SUM(mm3_commission) AS delta_mm3
  FROM mm3_sell_transactions
  GROUP BY date_trunc('hour', created_at)
  UNION ALL
  SELECT date_trunc('hour', created_at) AS hour, SUM(delta_mm3) AS delta_mm3
  FROM mm3_market_events
  GROUP BY date_trunc('hour', created_at)
),
hour_series AS (
  SELECT generate_series(
    date_trunc('hour', (SELECT COALESCE(MIN(hour), NOW()) FROM raw_events)),
    date_trunc('hour', NOW()),
    interval '1 hour'
  ) AS hour
),
hour_rewards AS (
  SELECT
    hour,
    SUM(delta_mm3) AS total_hour
  FROM raw_events
  GROUP BY hour
),
final AS (
  SELECT
    hs.hour,
    COALESCE(hr.total_hour, 0) AS hourly_reward
  FROM hour_series hs
  LEFT JOIN hour_rewards hr ON hr.hour = hs.hour
)
SELECT
  hour,
  SUM(hourly_reward) OVER (
    ORDER BY hour ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_reward
FROM final;

-- ==============================================
-- PHASE 7: ENABLE ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_macro_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_wallet_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_sell_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_visual_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_command_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_hidden_cmd_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_irc_messages ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- PHASE 8: CREATE ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Games policies
DROP POLICY IF EXISTS "public_read_games" ON games;
CREATE POLICY "public_read_games" ON games FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_games" ON games;
CREATE POLICY "public_insert_games" ON games FOR INSERT TO public WITH CHECK (true);

-- Math problems policies
DROP POLICY IF EXISTS "public_read_math_problems" ON math_problems;
CREATE POLICY "public_read_math_problems" ON math_problems FOR SELECT TO public USING (true);

-- Leaderboard data policies
DROP POLICY IF EXISTS "public_read_leaderboard_data" ON leaderboard_data;
CREATE POLICY "public_read_leaderboard_data" ON leaderboard_data FOR SELECT TO public USING (true);

-- Player progress policies
DROP POLICY IF EXISTS "public_read_player_progress" ON player_progress;
CREATE POLICY "public_read_player_progress" ON player_progress FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_player_progress" ON player_progress;
CREATE POLICY "public_insert_player_progress" ON player_progress FOR INSERT TO public WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_update_player_progress" ON player_progress;
CREATE POLICY "public_update_player_progress" ON player_progress FOR UPDATE TO public USING (true) WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_read_mm3_market_state" ON mm3_market_state;
CREATE POLICY "public_read_mm3_market_state" ON mm3_market_state FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_macro_state" ON mm3_macro_state;
CREATE POLICY "public_read_mm3_macro_state" ON mm3_macro_state FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_wallet_presence" ON mm3_wallet_presence;
CREATE POLICY "public_read_mm3_wallet_presence" ON mm3_wallet_presence FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_wallet_presence" ON mm3_wallet_presence;
CREATE POLICY "public_insert_mm3_wallet_presence" ON mm3_wallet_presence FOR INSERT TO public WITH CHECK (wallet <> '');

DROP POLICY IF EXISTS "public_update_mm3_wallet_presence" ON mm3_wallet_presence;
CREATE POLICY "public_update_mm3_wallet_presence" ON mm3_wallet_presence FOR UPDATE TO public USING (true) WITH CHECK (wallet <> '');

DROP POLICY IF EXISTS "public_insert_mm3_market_state" ON mm3_market_state;
CREATE POLICY "public_insert_mm3_market_state" ON mm3_market_state FOR INSERT TO public WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_update_mm3_market_state" ON mm3_market_state;
CREATE POLICY "public_update_mm3_market_state" ON mm3_market_state FOR UPDATE TO public USING (id = 1) WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_read_mm3_sell_transactions" ON mm3_sell_transactions;
CREATE POLICY "public_read_mm3_sell_transactions" ON mm3_sell_transactions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_sell_transactions" ON mm3_sell_transactions;
CREATE POLICY "public_insert_mm3_sell_transactions" ON mm3_sell_transactions FOR INSERT TO public WITH CHECK (level >= 0 AND level <= 100);

DROP POLICY IF EXISTS "public_read_mm3_market_events" ON mm3_market_events;
CREATE POLICY "public_read_mm3_market_events" ON mm3_market_events FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_market_events" ON mm3_market_events;
CREATE POLICY "public_insert_mm3_market_events" ON mm3_market_events FOR INSERT TO public WITH CHECK (event_type IN ('life_continue', 'nftji_claim', 'market_buy', 'market_resell'));

-- API Requests policies
DROP POLICY IF EXISTS "public_read_api_requests" ON api_requests;
CREATE POLICY "public_read_api_requests" ON api_requests FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_api_requests" ON api_requests;
CREATE POLICY "public_insert_api_requests" ON api_requests FOR INSERT TO public WITH CHECK (true);

-- MM3 Visual State policies
DROP POLICY IF EXISTS "public_read_visual_state" ON mm3_visual_state;
CREATE POLICY "public_read_visual_state" ON mm3_visual_state FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_insert_visual_state" ON mm3_visual_state;
CREATE POLICY "public_insert_visual_state" ON mm3_visual_state FOR INSERT TO anon WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_update_visual_state" ON mm3_visual_state;
CREATE POLICY "public_update_visual_state" ON mm3_visual_state FOR UPDATE TO anon USING (id = 1) WITH CHECK (id = 1);

DROP POLICY IF EXISTS "public_read_mm3_market_blocks" ON mm3_market_blocks;
CREATE POLICY "public_read_mm3_market_blocks" ON mm3_market_blocks FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_update_mm3_market_blocks" ON mm3_market_blocks;
CREATE POLICY "public_update_mm3_market_blocks" ON mm3_market_blocks FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_mm3_market_commands" ON mm3_market_commands;
CREATE POLICY "public_read_mm3_market_commands" ON mm3_market_commands FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_market_commands" ON mm3_market_commands;
CREATE POLICY "public_insert_mm3_market_commands" ON mm3_market_commands FOR INSERT TO anon WITH CHECK (wallet <> '' AND nftji_key <> '' AND command <> '');

DROP POLICY IF EXISTS "public_update_mm3_market_commands" ON mm3_market_commands;
CREATE POLICY "public_update_mm3_market_commands" ON mm3_market_commands FOR UPDATE TO anon USING (wallet <> '') WITH CHECK (wallet <> '');

DROP POLICY IF EXISTS "public_read_mm3_command_penalties" ON mm3_command_penalties;
CREATE POLICY "public_read_mm3_command_penalties" ON mm3_command_penalties FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_command_penalties" ON mm3_command_penalties;
CREATE POLICY "public_insert_mm3_command_penalties" ON mm3_command_penalties FOR INSERT TO public WITH CHECK (wallet <> '' AND nftji_key <> '' AND penalty_code <> '');

DROP POLICY IF EXISTS "public_update_mm3_command_penalties" ON mm3_command_penalties;
CREATE POLICY "public_update_mm3_command_penalties" ON mm3_command_penalties FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_mm3_hidden_cmd_executions" ON mm3_hidden_cmd_executions;
CREATE POLICY "public_read_mm3_hidden_cmd_executions" ON mm3_hidden_cmd_executions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_hidden_cmd_executions" ON mm3_hidden_cmd_executions;
CREATE POLICY "public_insert_mm3_hidden_cmd_executions" ON mm3_hidden_cmd_executions FOR INSERT TO public WITH CHECK (wallet <> '' AND block_key <> '');

-- IRC Messages policies
DROP POLICY IF EXISTS "public_read_mm3_irc_messages" ON mm3_irc_messages;
CREATE POLICY "public_read_mm3_irc_messages" ON mm3_irc_messages FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_irc_messages" ON mm3_irc_messages;
CREATE POLICY "public_insert_mm3_irc_messages" ON mm3_irc_messages FOR INSERT TO public WITH CHECK (wallet <> '' AND text <> '');

DROP POLICY IF EXISTS "public_delete_mm3_irc_messages" ON mm3_irc_messages;
CREATE POLICY "public_delete_mm3_irc_messages" ON mm3_irc_messages FOR DELETE TO public USING (true);

-- ==============================================
-- PHASE 9: INSERT INITIAL DATA
-- ==============================================

-- Insert MM3 Visual State
INSERT INTO mm3_macro_state (
  id,
  war_percent,
  nature_percent,
  ticker_message,
  ticker_message_en,
  ticker_message_es,
  updated_at
)
VALUES (
  1,
  0,
  0,
  '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  ticker_message    = EXCLUDED.ticker_message,
  ticker_message_en = EXCLUDED.ticker_message_en,
  ticker_message_es = EXCLUDED.ticker_message_es,
  updated_at        = NOW();

INSERT INTO mm3_market_blocks (
  block_key,
  grid_row,
  grid_col,
  emoji,
  title_en,
  title_es,
  answer_hash,
  price_eur,
  short_url,
  is_active
)
VALUES
  (
    'mm3-023',
    0,
    22,
    '🛰',
    'Genesis Uplink',
    'Uplink Génesis',
    '0ac59a6eff4c0d73984b7ec775d6a01864e80dbc5e5488c594ed1ae4748ff56d',
    1,
    'https://www.youtube.com/shorts/NRaN40UXpOM',
    TRUE
  ),
  (
    'mm3-05c',
    3,
    8,
    '🌐',
    'Signal Nexus',
    'Nexo Señal',
    '',
    3,
    NULL,
    TRUE
  ),
  (
    'mm3-0b9',
    6,
    17,
    '🔭',
    'Deep Relay',
    'Relay Profundo',
    '',
    5,
    NULL,
    TRUE
  ),
  (
    'mm3-11b',
    10,
    3,
    '🧬',
    'Code Strand',
    'Cadena Código',
    '',
    7,
    NULL,
    TRUE
  ),
  (
    'mm3-184',
    13,
    24,
    '💠',
    'Fractal Core',
    'Núcleo Fractal',
    '',
    10,
    NULL,
    TRUE
  ),
  (
    'mm3-1e7',
    17,
    11,
    '⚡',
    'Arc Burst',
    'Destello Arco',
    '',
    15,
    NULL,
    TRUE
  ),
  (
    'mm3-244',
    20,
    20,
    '🌀',
    'Entropy Loop',
    'Bucle Entropía',
    '',
    25,
    NULL,
    TRUE
  ),
  (
    'mm3-26d',
    22,
    5,
    '🔴',
    'Null Beacon',
    'Baliza Nula',
    '',
    50,
    NULL,
    TRUE
  ),
  (
    'mm3-2ca',
    25,
    14,
    '⭐',
    'Star Protocol',
    'Protocolo Estelar',
    '',
    75,
    NULL,
    TRUE
  ),
  (
    'mm3-30e',
    27,
    26,
    '💎',
    'Crystal Forge',
    'Forja Cristal',
    '',
    100,
    NULL,
    TRUE
  )
ON CONFLICT (block_key) DO UPDATE SET
  grid_row         = EXCLUDED.grid_row,
  grid_col         = EXCLUDED.grid_col,
  emoji            = EXCLUDED.emoji,
  title_en         = EXCLUDED.title_en,
  title_es         = EXCLUDED.title_es,
  answer_hash      = EXCLUDED.answer_hash,
  price_eur        = EXCLUDED.price_eur,
  short_url        = COALESCE(NULLIF(mm3_market_blocks.short_url, ''), EXCLUDED.short_url),
  is_active        = EXCLUDED.is_active,
  market_command   = EXCLUDED.market_command,
  formula_x        = EXCLUDED.formula_x,
  formula_result_5d = EXCLUDED.formula_result_5d,
  updated_at       = NOW();

INSERT INTO mm3_market_blocks (
  block_key,
  grid_row,
  grid_col,
  emoji,
  title_en,
  title_es,
  answer_hash,
  price_eur,
  short_url,
  is_active
)
VALUES
  ('mm3-01d', 1,  1,  '🛸', 'Orbit Siphon',    'Sifón Orbital',      '', 1,   NULL, TRUE),
  ('mm3-04a', 2,  18, '🗝️', 'Key Vault',       'Bóveda Llave',       '', 3,   NULL, TRUE),
  ('mm3-091', 5,  5,  '🛡️', 'Shield Fork',     'Bifurcación Escudo', '', 5,   NULL, TRUE),
  ('mm3-0f8', 8,  24, '🧨', 'Fuse Packet',     'Paquete Mecha',      '', 7,   NULL, TRUE),
  ('mm3-15c', 12, 12, '🪙', 'Coin Kernel',     'Kernel Moneda',      '', 10,  NULL, TRUE),
  ('mm3-1a6', 15, 2,  '🧰', 'Toolchain Cache', 'Caché Toolchain',    '', 15,  NULL, TRUE),
  ('mm3-20b', 18, 19, '🪬', 'Mirror Charm',    'Amuleto Espejo',     '', 25,  NULL, TRUE),
  ('mm3-29b', 23, 23, '🪞', 'Reflector Gate',  'Puerta Reflector',   '', 50,  NULL, TRUE),
  ('mm3-2da', 26, 2,  '🔋', 'Battery Node',    'Nodo Batería',       '', 75,  NULL, TRUE),
  ('mm3-2f9', 27, 5,  '🎛️', 'Mixer Console',   'Consola Mixer',      '', 100, NULL, TRUE)
ON CONFLICT (block_key) DO UPDATE SET
  grid_row             = EXCLUDED.grid_row,
  grid_col             = EXCLUDED.grid_col,
  emoji                = EXCLUDED.emoji,
  title_en             = EXCLUDED.title_en,
  title_es             = EXCLUDED.title_es,
  answer_hash          = EXCLUDED.answer_hash,
  price_eur            = EXCLUDED.price_eur,
  short_url            = COALESCE(mm3_market_blocks.short_url, EXCLUDED.short_url),
  is_active            = EXCLUDED.is_active,
  updated_at           = NOW();

UPDATE mm3_market_blocks AS b
SET market_command = v.market_command,
    formula_x = 123,
    formula_result_5d = v.formula_result_5d,
    updated_at = NOW()
FROM (
  VALUES
    ('mm3-023', '/ping -c 4 gateway.mainframe', '27814'),
    ('mm3-05c', '/nmcli connection reload', '10215'),
    ('mm3-0b9', '/netstat -tulpn', '11184'),
    ('mm3-11b', '/git cherry-pick a1b2c3d', '14303'),
    ('mm3-184', '/kubectl rollout restart deploy/fractal-core', '15115'),
    ('mm3-1e7', '/uptime', '18853'),
    ('mm3-244', '/journalctl -n 50', '22590'),
    ('mm3-26d', '/whoami', '29884'),
    ('mm3-2ca', '/hostnamectl status', '31184'),
    ('mm3-30e', '/sha256sum /etc/hosts', '37829'),
    ('mm3-01d', '/lsblk', '42865'),
    ('mm3-04a', '/passwd', '48592'),
    ('mm3-091', '/ufw status verbose', '49849'),
    ('mm3-0f8', '/ss -lntp', '55863'),
    ('mm3-15c', '/uname -r', '59063'),
    ('mm3-1a6', '/gcc --version', '63063'),
    ('mm3-20b', '/scp file.txt backup:/tmp/', '67799'),
    ('mm3-29b', '/curl -I http://localhost', '75630'),
    ('mm3-2da', '/acpi -V', '81281'),
    ('mm3-2f9', '/alsamixer', '87485')
) AS v(block_key, market_command, formula_result_5d)
WHERE b.block_key = v.block_key;

-- Mining question seeds intentionally live outside the tracked repository.
-- To keep answers out of GitHub, execute the private local seed file after
-- running this canonical schema:
--   .private/mining-problems.seed.sql
--
-- That private script should contain the INSERTs for public.math_problems.

-- ==============================================
-- PHASE 10: GRANT PERMISSIONS
-- ==============================================

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON games TO anon;
GRANT INSERT, UPDATE ON player_progress TO anon;
GRANT SELECT, INSERT, UPDATE ON mm3_market_state TO anon;
GRANT SELECT ON mm3_macro_state TO anon;
GRANT SELECT, INSERT, UPDATE ON mm3_wallet_presence TO anon;
GRANT SELECT, INSERT ON mm3_sell_transactions TO anon;
GRANT SELECT, INSERT ON mm3_market_events TO anon;
GRANT INSERT ON api_requests TO anon;
GRANT SELECT, UPDATE ON mm3_market_blocks TO anon;
GRANT SELECT, INSERT ON mm3_market_commands TO anon;
GRANT SELECT, INSERT, UPDATE ON mm3_command_penalties TO anon;
GRANT SELECT, INSERT ON mm3_hidden_cmd_executions TO anon;
GRANT SELECT, INSERT ON mm3_irc_messages TO anon;
GRANT DELETE ON mm3_irc_messages TO anon;
GRANT UPDATE ON mm3_visual_state TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

GRANT SELECT ON top_positive_miner TO anon;
GRANT SELECT ON token_value TO anon;
GRANT SELECT ON token_value_timeseries TO anon;
-- ==============================================
-- PHASE 11: INITIAL LEADERBOARD POPULATION
-- ==============================================

SELECT update_leaderboard();

COMMIT;
