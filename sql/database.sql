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
DROP FUNCTION IF EXISTS mm3_leave_wallet_pool(text);
DROP FUNCTION IF EXISTS mm3_pool_rank_from_level(integer);

-- Drop tables
DROP TABLE IF EXISTS mm3_command_penalties CASCADE;
DROP TABLE IF EXISTS mm3_hidden_cmd_executions CASCADE;
DROP TABLE IF EXISTS mm3_market_commands CASCADE;
DROP TABLE IF EXISTS mm3_sell_transactions CASCADE;
DROP TABLE IF EXISTS mm3_market_events CASCADE;
DROP TABLE IF EXISTS mm3_market_state CASCADE;
DROP TABLE IF EXISTS mm3_macro_state CASCADE;
DROP TABLE IF EXISTS mm3_wallet_presence CASCADE;
DROP TABLE IF EXISTS mm3_pool_dispute_wallets CASCADE;
DROP TABLE IF EXISTS mm3_pool_dispute_votes CASCADE;
DROP TABLE IF EXISTS mm3_pool_disputes CASCADE;
DROP TABLE IF EXISTS mm3_wallet_pool_cooldowns CASCADE;
DROP TABLE IF EXISTS mm3_wallet_pool_members CASCADE;
DROP TABLE IF EXISTS mm3_wallet_pool_invitations CASCADE;
DROP TABLE IF EXISTS mm3_wallet_pools CASCADE;
DROP FUNCTION IF EXISTS mm3_dispute_vote(text, text, text);
DROP FUNCTION IF EXISTS mm3_dispute_join(bigint, text);
DROP FUNCTION IF EXISTS mm3_dispute_start_battle(bigint);
DROP FUNCTION IF EXISTS mm3_dispute_resolve(bigint);
DROP FUNCTION IF EXISTS mm3_dispute_can_leave(text);
DROP FUNCTION IF EXISTS mm3_dispute_cancel(bigint);
DROP FUNCTION IF EXISTS mm3_pool_max_wallets(integer);
DROP TABLE IF EXISTS mm3_squeeze_nftji CASCADE;
DROP FUNCTION IF EXISTS mm3_squeeze_nftji_take(bigint, text);
DROP TABLE IF EXISTS player_progress CASCADE;
DROP TABLE IF EXISTS daily_task_claims CASCADE;
DROP TABLE IF EXISTS leaderboard_data CASCADE;
DROP TABLE IF EXISTS math_problems CASCADE;
DROP TABLE IF EXISTS api_requests CASCADE;
DROP TABLE IF EXISTS mm3_visual_state CASCADE;
DROP TABLE IF EXISTS mm3_market_blocks CASCADE;
DROP TABLE IF EXISTS mm3_irc_messages CASCADE;
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
  lucky_50_level INTEGER NOT NULL DEFAULT -1,
  lucky_100_level INTEGER NOT NULL DEFAULT -1,
  lucky_500_level INTEGER NOT NULL DEFAULT -1,
  lucky_1000_level INTEGER NOT NULL DEFAULT -1,
  market_nftji_levels JSONB NOT NULL DEFAULT '{}',
  sell_rate_cny NUMERIC NOT NULL DEFAULT 0,
  sell_quote_cny NUMERIC NOT NULL DEFAULT 0,
  sell_quote_eur NUMERIC NOT NULL DEFAULT 0,
  sell_quote_usd NUMERIC NOT NULL DEFAULT 0,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_task_claims (
  wallet TEXT NOT NULL,
  day TEXT NOT NULL,
  task_key TEXT NOT NULL,
  reward_claimed BOOLEAN NOT NULL DEFAULT TRUE,
  reward_eur NUMERIC NOT NULL DEFAULT 0,
  reward_usd NUMERIC NOT NULL DEFAULT 0,
  reward_cny NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet, day, task_key)
);

CREATE TABLE mm3_wallet_pools (
  pool_code TEXT PRIMARY KEY CHECK (pool_code ~ '^[A-Z0-9]{5}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_wallet_pool_members (
  wallet TEXT PRIMARY KEY,
  pool_code TEXT NOT NULL REFERENCES mm3_wallet_pools(pool_code) ON DELETE CASCADE,
  added_by TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mm3_wallet_pool_invitations (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  pool_code TEXT NOT NULL REFERENCES mm3_wallet_pools(pool_code) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE mm3_wallet_pool_cooldowns (
  wallet      TEXT        PRIMARY KEY,
  left_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE mm3_pool_disputes (
  id                    BIGSERIAL PRIMARY KEY,
  challenger_pool_code  TEXT NOT NULL,
  defender_pool_code    TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'proposing'
                          CHECK (status IN ('proposing', 'registering', 'battle_start', 'resolved', 'cancelled')),
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  battle_start_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  war_percent           NUMERIC,
  nature_percent        NUMERIC,
  dice_modifier         NUMERIC,
  ch_wallet_count       INT NOT NULL DEFAULT 0,
  ch_level_sum          NUMERIC NOT NULL DEFAULT 0,
  ch_mm3_sum            NUMERIC NOT NULL DEFAULT 0,
  ch_eur_sum            NUMERIC NOT NULL DEFAULT 0,
  ch_nftji_count           INT NOT NULL DEFAULT 0,
  ch_market_nftji_count    INT NOT NULL DEFAULT 0,
  ch_penalty_count         INT NOT NULL DEFAULT 0,
  ch_exec_count            INT NOT NULL DEFAULT 0,
  ch_score                 NUMERIC,
  df_wallet_count          INT NOT NULL DEFAULT 0,
  df_level_sum             NUMERIC NOT NULL DEFAULT 0,
  df_mm3_sum               NUMERIC NOT NULL DEFAULT 0,
  df_eur_sum               NUMERIC NOT NULL DEFAULT 0,
  df_nftji_count           INT NOT NULL DEFAULT 0,
  df_market_nftji_count    INT NOT NULL DEFAULT 0,
  df_penalty_count         INT NOT NULL DEFAULT 0,
  df_exec_count         INT NOT NULL DEFAULT 0,
  df_score              NUMERIC,
  winner                TEXT CHECK (winner IN ('challenger', 'defender', 'draw')),
  result_summary        JSONB,
  drop_type             TEXT CHECK (drop_type IN ('attack', 'defense')),
  ch_squeeze_atk_sum    INT NOT NULL DEFAULT 0,
  df_squeeze_atk_sum    INT NOT NULL DEFAULT 0
);

CREATE TABLE mm3_pool_dispute_votes (
  id                    BIGSERIAL PRIMARY KEY,
  challenger_pool_code  TEXT NOT NULL,
  defender_pool_code    TEXT NOT NULL,
  wallet                TEXT NOT NULL,
  voted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispute_id            BIGINT REFERENCES mm3_pool_disputes(id),
  UNIQUE (challenger_pool_code, defender_pool_code, wallet)
);

CREATE TABLE mm3_pool_dispute_wallets (
  id              BIGSERIAL PRIMARY KEY,
  dispute_id      BIGINT NOT NULL REFERENCES mm3_pool_disputes(id) ON DELETE CASCADE,
  wallet          TEXT NOT NULL,
  pool_code       TEXT NOT NULL,
  side            TEXT NOT NULL CHECK (side IN ('challenger', 'defender')),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level_snap      INT     NOT NULL DEFAULT 0,
  mm3_snap        NUMERIC NOT NULL DEFAULT 0,
  eur_snap        NUMERIC NOT NULL DEFAULT 0,
  usd_snap        NUMERIC NOT NULL DEFAULT 0,
  cny_snap        NUMERIC NOT NULL DEFAULT 0,
  exec_snap       INT     NOT NULL DEFAULT 0,
  nftji_snap      INT     NOT NULL DEFAULT 0,
  market_nftji_snap TEXT,
  market_nftji_level_snap INTEGER NOT NULL DEFAULT 0,
  has_penalty     BOOLEAN NOT NULL DEFAULT FALSE,
  eur_stake       NUMERIC NOT NULL DEFAULT 0,
  mm3_stake       NUMERIC NOT NULL DEFAULT 0,
  delta_eur              NUMERIC NOT NULL DEFAULT 0,
  delta_mm3              NUMERIC NOT NULL DEFAULT 0,
  squeeze_nftji_equipped TEXT CHECK (squeeze_nftji_equipped IN ('attack', 'defense')),
  squeeze_nftji_level    SMALLINT NOT NULL DEFAULT -1,
  squeeze_nftji_claimed  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (dispute_id, wallet)
);

CREATE TABLE mm3_squeeze_nftji (
  wallet         TEXT PRIMARY KEY,
  equipped       TEXT CHECK (equipped IN ('attack', 'defense')),
  attack_level   SMALLINT NOT NULL DEFAULT -1,
  defense_level  SMALLINT NOT NULL DEFAULT -1,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX idx_mm3_wallet_pool_members_pool_code ON mm3_wallet_pool_members(pool_code);
CREATE INDEX idx_mm3_wallet_pool_invitations_pool_code ON mm3_wallet_pool_invitations(pool_code);
CREATE INDEX idx_mm3_wallet_pool_invitations_wallet ON mm3_wallet_pool_invitations(wallet);
CREATE INDEX idx_mm3_wallet_pool_cooldowns_expires ON mm3_wallet_pool_cooldowns(wallet, expires_at);
CREATE INDEX idx_mm3_pool_disputes_status         ON mm3_pool_disputes(status);
CREATE INDEX idx_mm3_pool_disputes_pools          ON mm3_pool_disputes(challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_dispute_votes_pairing   ON mm3_pool_dispute_votes(challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_dispute_wallets_dispute ON mm3_pool_dispute_wallets(dispute_id, side);
CREATE INDEX idx_mm3_pool_dispute_wallets_wallet  ON mm3_pool_dispute_wallets(wallet);
CREATE INDEX idx_mm3_squeeze_nftji_wallet          ON mm3_squeeze_nftji(wallet);
CREATE INDEX idx_mm3_squeeze_nftji_equipped        ON mm3_squeeze_nftji(equipped) WHERE equipped IS NOT NULL;
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
ALTER TABLE mm3_irc_messages REPLICA IDENTITY FULL;

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

-- Pool helper: remove a wallet from its pool
CREATE OR REPLACE FUNCTION public.mm3_leave_wallet_pool(p_wallet text)
RETURNS TABLE(wallet text, pool_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  DELETE FROM public.mm3_wallet_pool_members m
  WHERE lower(trim(m.wallet)) = lower(trim(p_wallet))
  RETURNING m.wallet, m.pool_code;
END;
$$;

-- Pool rank tier derived from the combined level sum of all members
CREATE OR REPLACE FUNCTION public.mm3_pool_rank_from_level(p_level integer)
RETURNS TABLE(
  rank_key text,
  emoji text,
  rank_name text,
  rank_desc text,
  min_level integer,
  max_level integer
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT *
  FROM (
    VALUES
      ('node_swarm',     '🧟',  'NODE SWARM',     'Pool recién sincronizado; muchas wallets, poca potencia.', 0,   199),
      ('hash_coven',     '🕳️', 'HASH COVEN',     'Grupo estable que empieza a deformar el ranking.',        200, 3999),
      ('signal_cartel',  '🧲',  'SIGNAL CARTEL',  'Pool coordinado con fuerza real de ejecución.',           400, 599),
      ('void_syndicate', '🏴‍☠️','VOID SYNDICATE', 'Alianza peligrosa capaz de mover el mainframe.',         600, 799),
      ('dragon_mainnet', '🐉',  'DRAGON MAINNET', 'Pool élite; entidad dominante del ecosistema MM3.',       800, 9999)
  ) AS r(rank_key, emoji, rank_name, rank_desc, min_level, max_level)
  WHERE p_level BETWEEN r.min_level AND r.max_level
  LIMIT 1;
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
-- POOL DISPUTE FUNCTIONS
-- ==============================================

-- ==============================================
-- HELPER: pool max wallets by avg level
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_pool_max_wallets(p_avg_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_avg_level >= 800 THEN 25
    WHEN p_avg_level >= 600 THEN 20
    WHEN p_avg_level >= 400 THEN 15
    WHEN p_avg_level >= 200 THEN 10
    ELSE 5
  END;
$$;

-- ==============================================
-- FUNCTION: cast dispute vote / propose dispute
-- ==============================================
-- 1st caller → creates 'proposing' dispute (waiting for 2nd wallet)
-- 2nd caller  → transitions 'proposing' → 'registering', enrolls members
-- Returns: {dispute_id, created, proposing, vote_count, error}

CREATE OR REPLACE FUNCTION public.mm3_dispute_vote(
  p_challenger_pool text,
  p_defender_pool   text,
  p_wallet          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_in_pool           BOOLEAN;
  v_already_voted     BOOLEAN;
  v_active_dispute    BIGINT;
  v_proposing_dispute BIGINT;
  v_dispute_id        BIGINT;
  v_vote_count        INT;
  v_defender_members  TEXT[];
  v_challenger_members TEXT[];
  v_member            TEXT;
  v_exec_count        INT;
  v_has_penalty       BOOLEAN;
BEGIN
  IF p_challenger_pool = p_defender_pool THEN
    RETURN jsonb_build_object('error', 'same_pool');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM mm3_wallet_pool_members
    WHERE wallet = p_wallet AND pool_code = p_challenger_pool
  ) INTO v_in_pool;

  IF NOT v_in_pool THEN
    RETURN jsonb_build_object('error', 'not_in_challenger_pool');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM mm3_pool_dispute_votes v
    LEFT JOIN mm3_pool_disputes d ON d.id = v.dispute_id
    WHERE v.challenger_pool_code = p_challenger_pool
      AND v.defender_pool_code = p_defender_pool
      AND v.wallet = p_wallet
      AND (v.dispute_id IS NULL OR d.status IN ('proposing', 'registering', 'battle_start'))
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  -- Check whether a proposing dispute already exists for THIS pair (2nd wallet joining)
  SELECT id INTO v_proposing_dispute
  FROM mm3_pool_disputes
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND status = 'proposing'
  LIMIT 1;

  -- If NOT joining an existing proposal, block if the challenger pool has any active dispute
  IF v_proposing_dispute IS NULL THEN
    SELECT id INTO v_active_dispute
    FROM mm3_pool_disputes
    WHERE challenger_pool_code = p_challenger_pool
      AND status IN ('proposing', 'registering', 'battle_start')
    LIMIT 1;

    IF v_active_dispute IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'dispute_already_active', 'dispute_id', v_active_dispute);
    END IF;
  END IF;

  -- Record this wallet's intent
  INSERT INTO mm3_pool_dispute_votes(challenger_pool_code, defender_pool_code, wallet)
  VALUES (p_challenger_pool, p_defender_pool, p_wallet);

  -- ── 2nd wallet: transition proposing → registering ───────────────────────
  IF v_proposing_dispute IS NOT NULL THEN
    v_dispute_id := v_proposing_dispute;

    UPDATE mm3_pool_dispute_votes
    SET dispute_id = v_dispute_id
    WHERE challenger_pool_code = p_challenger_pool
      AND defender_pool_code = p_defender_pool
      AND dispute_id IS NULL;

    SELECT COUNT(*) INTO v_vote_count
    FROM mm3_pool_dispute_votes
    WHERE dispute_id = v_dispute_id;

    -- Reset registered_at so the 5-min join window starts fresh now
    UPDATE mm3_pool_disputes
    SET status = 'registering', registered_at = NOW()
    WHERE id = v_dispute_id;

    -- Enroll challenger voters (snapshot Squeeze NFTJI at registration time)
    SELECT ARRAY_AGG(wallet) INTO v_challenger_members
    FROM mm3_pool_dispute_votes
    WHERE dispute_id = v_dispute_id;

    IF v_challenger_members IS NOT NULL THEN
      FOREACH v_member IN ARRAY v_challenger_members LOOP
        SELECT COUNT(*) INTO v_exec_count
        FROM mm3_hidden_cmd_executions WHERE wallet = v_member;

        SELECT EXISTS(
          SELECT 1 FROM mm3_command_penalties
          WHERE wallet = v_member AND redeemed_at IS NULL
        ) INTO v_has_penalty;

        INSERT INTO mm3_pool_dispute_wallets(
          dispute_id, wallet, pool_code, side,
          level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
          exec_snap, nftji_snap, market_nftji_snap, market_nftji_level_snap, has_penalty,
          eur_stake, mm3_stake,
          squeeze_nftji_equipped, squeeze_nftji_level
        )
        SELECT
          v_dispute_id, v_member, p_challenger_pool, 'challenger',
          COALESCE(pp.level, 0), COALESCE(pp.mm3_sold, 0),
          COALESCE(pp.eur_earned, 0), COALESCE(pp.usd_earned, 0), COALESCE(pp.cny_earned, 0),
          v_exec_count,
          (CASE WHEN pp.lucky_50_level >= 0 THEN pp.lucky_50_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_100_level >= 0 THEN pp.lucky_100_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_500_level >= 0 THEN pp.lucky_500_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_1000_level >= 0 THEN pp.lucky_1000_level + 1 ELSE 0 END +
           CASE WHEN pp.life_used THEN 1 ELSE 0 END),
          pp.market_nftji_key,
          CASE WHEN pp.market_nftji_key IS NOT NULL
            THEN GREATEST(0, COALESCE((pp.market_nftji_levels->>pp.market_nftji_key)::integer, 0))
            ELSE 0 END,
          v_has_penalty,
          ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
          ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
          sn.equipped,
          CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
               WHEN sn.equipped = 'defense' THEN sn.defense_level
               ELSE -1 END
        FROM player_progress pp
        LEFT JOIN mm3_squeeze_nftji sn ON sn.wallet = v_member
        WHERE pp.wallet = v_member
        ON CONFLICT (dispute_id, wallet) DO NOTHING;
      END LOOP;
    END IF;

    -- Auto-enroll all defender pool members (snapshot Squeeze NFTJI)
    SELECT ARRAY_AGG(wallet) INTO v_defender_members
    FROM mm3_wallet_pool_members WHERE pool_code = p_defender_pool;

    IF v_defender_members IS NOT NULL THEN
      FOREACH v_member IN ARRAY v_defender_members LOOP
        SELECT COUNT(*) INTO v_exec_count
        FROM mm3_hidden_cmd_executions WHERE wallet = v_member;

        SELECT EXISTS(
          SELECT 1 FROM mm3_command_penalties
          WHERE wallet = v_member AND redeemed_at IS NULL
        ) INTO v_has_penalty;

        INSERT INTO mm3_pool_dispute_wallets(
          dispute_id, wallet, pool_code, side,
          level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
          exec_snap, nftji_snap, market_nftji_snap, market_nftji_level_snap, has_penalty,
          eur_stake, mm3_stake,
          squeeze_nftji_equipped, squeeze_nftji_level
        )
        SELECT
          v_dispute_id, v_member, p_defender_pool, 'defender',
          COALESCE(pp.level, 0), COALESCE(pp.mm3_sold, 0),
          COALESCE(pp.eur_earned, 0), COALESCE(pp.usd_earned, 0), COALESCE(pp.cny_earned, 0),
          v_exec_count,
          (CASE WHEN pp.lucky_50_level >= 0 THEN pp.lucky_50_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_100_level >= 0 THEN pp.lucky_100_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_500_level >= 0 THEN pp.lucky_500_level + 1 ELSE 0 END +
           CASE WHEN pp.lucky_1000_level >= 0 THEN pp.lucky_1000_level + 1 ELSE 0 END +
           CASE WHEN pp.life_used THEN 1 ELSE 0 END),
          pp.market_nftji_key,
          CASE WHEN pp.market_nftji_key IS NOT NULL
            THEN GREATEST(0, COALESCE((pp.market_nftji_levels->>pp.market_nftji_key)::integer, 0))
            ELSE 0 END,
          v_has_penalty,
          ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
          ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
          sn.equipped,
          CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
               WHEN sn.equipped = 'defense' THEN sn.defense_level
               ELSE -1 END
        FROM player_progress pp
        LEFT JOIN mm3_squeeze_nftji sn ON sn.wallet = v_member
        WHERE pp.wallet = v_member
        ON CONFLICT (dispute_id, wallet) DO NOTHING;
      END LOOP;
    END IF;

    RETURN jsonb_build_object('created', true, 'dispute_id', v_dispute_id, 'vote_count', v_vote_count);

  -- ── 1st wallet: create proposing dispute ─────────────────────────────────
  ELSE
    INSERT INTO mm3_pool_disputes(challenger_pool_code, defender_pool_code, status)
    VALUES (p_challenger_pool, p_defender_pool, 'proposing')
    RETURNING id INTO v_dispute_id;

    UPDATE mm3_pool_dispute_votes
    SET dispute_id = v_dispute_id
    WHERE challenger_pool_code = p_challenger_pool
      AND defender_pool_code = p_defender_pool
      AND dispute_id IS NULL;

    RETURN jsonb_build_object('created', false, 'proposing', true, 'dispute_id', v_dispute_id, 'vote_count', 1);
  END IF;
END;
$$;

-- ==============================================
-- FUNCTION: additional challenger joins dispute
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_join(
  p_dispute_id bigint,
  p_wallet     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute RECORD;
  v_in_pool BOOLEAN;
  v_exec_count INT;
  v_has_penalty BOOLEAN;
BEGIN
  SELECT * INTO v_dispute FROM mm3_pool_disputes WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'dispute_not_found');
  END IF;

  IF v_dispute.status <> 'registering' THEN
    RETURN jsonb_build_object('error', 'registration_closed');
  END IF;

  -- 5-minute window
  IF NOW() > v_dispute.registered_at + INTERVAL '5 minutes' THEN
    RETURN jsonb_build_object('error', 'registration_expired');
  END IF;

  -- Must be in challenger pool
  SELECT EXISTS(
    SELECT 1 FROM mm3_wallet_pool_members
    WHERE wallet = p_wallet AND pool_code = v_dispute.challenger_pool_code
  ) INTO v_in_pool;

  IF NOT v_in_pool THEN
    RETURN jsonb_build_object('error', 'not_in_challenger_pool');
  END IF;

  SELECT COUNT(*) INTO v_exec_count
  FROM mm3_hidden_cmd_executions WHERE wallet = p_wallet;

  SELECT EXISTS(
    SELECT 1 FROM mm3_command_penalties
    WHERE wallet = p_wallet AND redeemed_at IS NULL
  ) INTO v_has_penalty;

  INSERT INTO mm3_pool_dispute_wallets(
    dispute_id, wallet, pool_code, side,
    level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
    exec_snap, nftji_snap, market_nftji_snap, market_nftji_level_snap, has_penalty,
    eur_stake, mm3_stake,
    squeeze_nftji_equipped, squeeze_nftji_level
  )
  SELECT
    p_dispute_id, p_wallet, v_dispute.challenger_pool_code, 'challenger',
    COALESCE(pp.level, 0),
    COALESCE(pp.mm3_sold, 0),
    COALESCE(pp.eur_earned, 0),
    COALESCE(pp.usd_earned, 0),
    COALESCE(pp.cny_earned, 0),
    v_exec_count,
    (CASE WHEN pp.lucky_50_level >= 0 THEN pp.lucky_50_level + 1 ELSE 0 END +
     CASE WHEN pp.lucky_100_level >= 0 THEN pp.lucky_100_level + 1 ELSE 0 END +
     CASE WHEN pp.lucky_500_level >= 0 THEN pp.lucky_500_level + 1 ELSE 0 END +
     CASE WHEN pp.lucky_1000_level >= 0 THEN pp.lucky_1000_level + 1 ELSE 0 END +
     CASE WHEN pp.life_used THEN 1 ELSE 0 END),
    pp.market_nftji_key,
    CASE WHEN pp.market_nftji_key IS NOT NULL
      THEN GREATEST(0, COALESCE((pp.market_nftji_levels->>pp.market_nftji_key)::integer, 0))
      ELSE 0 END,
    v_has_penalty,
    ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
    ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
    sn.equipped,
    CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
         WHEN sn.equipped = 'defense' THEN sn.defense_level
         ELSE -1 END
  FROM player_progress pp
  LEFT JOIN mm3_squeeze_nftji sn ON sn.wallet = p_wallet
  WHERE pp.wallet = p_wallet
  ON CONFLICT (dispute_id, wallet) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ==============================================
-- FUNCTION: start battle (called after 5 min, or earlier when challenger pool is fully registered)
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_start_battle(p_dispute_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute       RECORD;
  v_war           NUMERIC;
  v_nature        NUMERIC;
  v_dice          NUMERIC;
  v_ch            RECORD;
  v_df            RECORD;
  v_ch_base       NUMERIC;
  v_df_base       NUMERIC;
  v_ch_score      NUMERIC;
  v_df_score      NUMERIC;
BEGIN
  SELECT * INTO v_dispute FROM mm3_pool_disputes WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'dispute_not_found');
  END IF;

  IF v_dispute.status <> 'registering' THEN
    RETURN jsonb_build_object('error', 'wrong_status', 'status', v_dispute.status);
  END IF;

  -- Snapshot world state
  SELECT war_percent, nature_percent INTO v_war, v_nature
  FROM mm3_macro_state WHERE id = 1;

  -- Dice: deterministic from dispute id, range -1..1
  v_dice := ((hashtext(p_dispute_id::text || 'dice')::bigint & 2147483647)::numeric / 2147483647.0) * 2 - 1;

  -- Challenger aggregates
  -- squeeze_atk_sum: sum of (level+1) for wallets with ⚔️ equipped — contributes to base score
  SELECT
    COUNT(*)                          AS wallet_count,
    COALESCE(SUM(level_snap), 0)     AS level_sum,
    COALESCE(SUM(mm3_snap), 0)       AS mm3_sum,
    COALESCE(SUM(eur_snap), 0)       AS eur_sum,
    COALESCE(SUM(nftji_snap), 0)     AS nftji_count,
    COALESCE(SUM(market_nftji_level_snap + 1) FILTER (WHERE market_nftji_snap IS NOT NULL), 0) AS market_nftji_count,
    COUNT(*) FILTER (WHERE has_penalty)  AS penalty_count,
    COALESCE(SUM(exec_snap), 0)      AS exec_count,
    COALESCE(SUM(CASE WHEN squeeze_nftji_equipped = 'attack' AND squeeze_nftji_level >= 0
                      THEN squeeze_nftji_level + 1 ELSE 0 END), 0) AS squeeze_atk_sum
  INTO v_ch
  FROM mm3_pool_dispute_wallets
  WHERE dispute_id = p_dispute_id AND side = 'challenger';

  -- Defender aggregates
  SELECT
    COUNT(*)                          AS wallet_count,
    COALESCE(SUM(level_snap), 0)     AS level_sum,
    COALESCE(SUM(mm3_snap), 0)       AS mm3_sum,
    COALESCE(SUM(eur_snap), 0)       AS eur_sum,
    COALESCE(SUM(nftji_snap), 0)     AS nftji_count,
    COALESCE(SUM(market_nftji_level_snap + 1) FILTER (WHERE market_nftji_snap IS NOT NULL), 0) AS market_nftji_count,
    COUNT(*) FILTER (WHERE has_penalty)  AS penalty_count,
    COALESCE(SUM(exec_snap), 0)      AS exec_count,
    COALESCE(SUM(CASE WHEN squeeze_nftji_equipped = 'attack' AND squeeze_nftji_level >= 0
                      THEN squeeze_nftji_level + 1 ELSE 0 END), 0) AS squeeze_atk_sum
  INTO v_df
  FROM mm3_pool_dispute_wallets
  WHERE dispute_id = p_dispute_id AND side = 'defender';

  -- Base scores (per-wallet averages to normalize pool size differences)
  -- Formula:
  --   base = (level/n)*40 + ln(mm3/n+1)*20 + (execs/n)*12 + (nftjis/n)*8
  --          + (market/n)*15 + (sqz_atk_sum/n)*20 - (penalties/n)*20
  -- War favors challenger (+30%), nature favors defender (+20%), dice adds variance (±30%)
  IF v_ch.wallet_count > 0 THEN
    v_ch_base :=
      (v_ch.level_sum::numeric / v_ch.wallet_count) * 40
      + LN(v_ch.mm3_sum / v_ch.wallet_count + 1) * 20
      + (v_ch.exec_count::numeric / v_ch.wallet_count) * 12
      + (v_ch.nftji_count::numeric / v_ch.wallet_count) * 8
      + (v_ch.market_nftji_count::numeric / v_ch.wallet_count) * 15
      + (v_ch.squeeze_atk_sum::numeric / v_ch.wallet_count) * 20
      - (v_ch.penalty_count::numeric / v_ch.wallet_count) * 20;
  ELSE
    v_ch_base := 0;
  END IF;

  IF v_df.wallet_count > 0 THEN
    v_df_base :=
      (v_df.level_sum::numeric / v_df.wallet_count) * 40
      + LN(v_df.mm3_sum / v_df.wallet_count + 1) * 20
      + (v_df.exec_count::numeric / v_df.wallet_count) * 12
      + (v_df.nftji_count::numeric / v_df.wallet_count) * 8
      + (v_df.market_nftji_count::numeric / v_df.wallet_count) * 15
      + (v_df.squeeze_atk_sum::numeric / v_df.wallet_count) * 20
      - (v_df.penalty_count::numeric / v_df.wallet_count) * 20;
  ELSE
    v_df_base := 0;
  END IF;

  -- Apply world modifiers
  v_ch_score := GREATEST(0.01, v_ch_base)
    * (1 + (v_war - 50) / 100.0 * 0.30)
    * (1 + (50 - v_nature) / 100.0 * 0.20)
    * (1 + v_dice * 0.30);

  v_df_score := GREATEST(0.01, v_df_base)
    * (1 + (50 - v_war) / 100.0 * 0.30)
    * (1 + (v_nature - 50) / 100.0 * 0.20)
    * (1 - v_dice * 0.30);

  -- Update dispute
  UPDATE mm3_pool_disputes SET
    status               = 'battle_start',
    battle_start_at      = NOW(),
    war_percent          = v_war,
    nature_percent       = v_nature,
    dice_modifier        = ROUND(v_dice, 4),
    ch_wallet_count      = v_ch.wallet_count,
    ch_level_sum         = v_ch.level_sum,
    ch_mm3_sum           = v_ch.mm3_sum,
    ch_eur_sum           = v_ch.eur_sum,
    ch_nftji_count       = v_ch.nftji_count,
    ch_market_nftji_count = v_ch.market_nftji_count,
    ch_penalty_count     = v_ch.penalty_count,
    ch_exec_count        = v_ch.exec_count,
    ch_score             = ROUND(v_ch_score, 4),
    ch_squeeze_atk_sum   = v_ch.squeeze_atk_sum,
    df_wallet_count      = v_df.wallet_count,
    df_level_sum         = v_df.level_sum,
    df_mm3_sum           = v_df.mm3_sum,
    df_eur_sum           = v_df.eur_sum,
    df_nftji_count       = v_df.nftji_count,
    df_market_nftji_count = v_df.market_nftji_count,
    df_penalty_count     = v_df.penalty_count,
    df_exec_count        = v_df.exec_count,
    df_score             = ROUND(v_df_score, 4),
    df_squeeze_atk_sum   = v_df.squeeze_atk_sum
  WHERE id = p_dispute_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ch_score', ROUND(v_ch_score, 4),
    'df_score', ROUND(v_df_score, 4),
    'war_percent', v_war,
    'nature_percent', v_nature,
    'dice_modifier', ROUND(v_dice, 4)
  );
END;
$$;

-- ==============================================
-- ==============================================
-- FUNCTION: resolve dispute (called 5s after battle_start)
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_resolve(p_dispute_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute      RECORD;
  v_winner       TEXT;
  v_loser_side   TEXT;
  v_winner_side  TEXT;
  v_winner_n     INT;
  v_transfer_eur NUMERIC;
  v_per_eur      NUMERIC;
  v_summary      JSONB;
  v_drop_type    TEXT;
BEGIN
  SELECT * INTO v_dispute FROM mm3_pool_disputes WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'dispute_not_found');
  END IF;

  IF v_dispute.status <> 'battle_start' THEN
    RETURN jsonb_build_object('error', 'wrong_status', 'status', v_dispute.status);
  END IF;

  -- Determine winner
  IF v_dispute.ch_score > v_dispute.df_score THEN
    v_winner      := 'challenger';
    v_winner_side := 'challenger';
    v_loser_side  := 'defender';
  ELSIF v_dispute.df_score > v_dispute.ch_score THEN
    v_winner      := 'defender';
    v_winner_side := 'defender';
    v_loser_side  := 'challenger';
  ELSE
    v_winner := 'draw';
  END IF;

  IF v_winner <> 'draw' THEN
    -- 55% of loser money stakes transferred to winner pool (based on raw stakes)
    SELECT COALESCE(SUM(eur_stake), 0) * 0.55
    INTO v_transfer_eur
    FROM mm3_pool_dispute_wallets
    WHERE dispute_id = p_dispute_id AND side = v_loser_side;

    -- 🛡️ Defense NFTJI: losers with defense equipped recover min(50%, (level+1)*5%) of their stake
    UPDATE mm3_pool_dispute_wallets SET
      delta_eur = -ROUND(eur_stake * (1 - LEAST(0.50, (squeeze_nftji_level + 1)::numeric * 0.05)), 6),
      delta_mm3 = 0
    WHERE dispute_id = p_dispute_id
      AND side = v_loser_side
      AND squeeze_nftji_equipped = 'defense'
      AND squeeze_nftji_level >= 0;

    -- Losers without defense: full loss
    UPDATE mm3_pool_dispute_wallets SET
      delta_eur = -eur_stake,
      delta_mm3 = 0
    WHERE dispute_id = p_dispute_id
      AND side = v_loser_side
      AND (squeeze_nftji_equipped IS DISTINCT FROM 'defense' OR squeeze_nftji_level < 0);

    -- Winner wallets gain proportional share of transferred money
    SELECT COUNT(*) INTO v_winner_n
    FROM mm3_pool_dispute_wallets
    WHERE dispute_id = p_dispute_id AND side = v_winner_side;

    IF v_winner_n > 0 THEN
      v_per_eur := ROUND(v_transfer_eur / v_winner_n, 6);

      UPDATE mm3_pool_dispute_wallets SET
        delta_eur = v_per_eur,
        delta_mm3 = 0
      WHERE dispute_id = p_dispute_id AND side = v_winner_side;
    END IF;

    -- Apply money deltas to player_progress (MM3 never changes via squeeze)
    UPDATE player_progress pp SET
      eur_earned = GREATEST(0, pp.eur_earned + dw.delta_eur),
      updated_at = NOW()
    FROM mm3_pool_dispute_wallets dw
    WHERE dw.dispute_id = p_dispute_id
      AND dw.wallet = pp.wallet
      AND dw.delta_eur <> 0;

  END IF;

  -- NFTJI drop roll: 1/25 chance, deterministic per dispute
  -- Type: 50/50 attack/defense. Winners can claim it voluntarily.
  v_drop_type := NULL;
  IF (hashtext(p_dispute_id::text || 'nftdrop')::bigint & 2147483647) % 25 = 0 THEN
    IF (hashtext(p_dispute_id::text || 'nftdroptype')::bigint & 1) = 0 THEN
      v_drop_type := 'attack';
    ELSE
      v_drop_type := 'defense';
    END IF;
  END IF;

  -- Build result summary
  v_summary := jsonb_build_object(
    'winner',          v_winner,
    'ch_score',        v_dispute.ch_score,
    'df_score',        v_dispute.df_score,
    'war_percent',     v_dispute.war_percent,
    'nature_percent',  v_dispute.nature_percent,
    'dice_modifier',   v_dispute.dice_modifier,
    'ch_wallet_count', v_dispute.ch_wallet_count,
    'df_wallet_count', v_dispute.df_wallet_count,
    'transfer_eur',    COALESCE(v_transfer_eur, 0),
    'transfer_mm3',    0,
    'drop_type',       v_drop_type
  );

  -- Clean up votes so participants can propose again later
  DELETE FROM mm3_pool_dispute_votes WHERE dispute_id = p_dispute_id;

  -- Finalize dispute
  UPDATE mm3_pool_disputes SET
    status         = 'resolved',
    resolved_at    = NOW(),
    winner         = v_winner,
    result_summary = v_summary,
    drop_type      = v_drop_type
  WHERE id = p_dispute_id;

  RETURN v_summary;
END;
$$;

-- ==============================================
-- FUNCTION: cancel proposing dispute after 5-min timeout
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_cancel(p_dispute_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute RECORD;
BEGIN
  SELECT * INTO v_dispute FROM mm3_pool_disputes WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'dispute_not_found');
  END IF;

  IF v_dispute.status <> 'proposing' THEN
    RETURN jsonb_build_object('error', 'wrong_status', 'status', v_dispute.status);
  END IF;

  IF NOW() < v_dispute.registered_at + INTERVAL '5 minutes' THEN
    RETURN jsonb_build_object('error', 'not_expired_yet');
  END IF;

  UPDATE mm3_pool_disputes
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_dispute_id;

  -- Clean up votes so participants can propose again later
  DELETE FROM mm3_pool_dispute_votes WHERE dispute_id = p_dispute_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ==============================================
-- FUNCTION: claim Squeeze NFTJI drop
-- ==============================================
-- Winners of a resolved Squeeze with a drop can call this once.
-- Same type = level +1. Different type = swap equipped, level +1 for new type.
-- Level starts at 0 on first acquisition.

CREATE OR REPLACE FUNCTION public.mm3_squeeze_nftji_take(
  p_dispute_id BIGINT,
  p_wallet     TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute     RECORD;
  v_wallet_dw   RECORD;
  v_drop_type   TEXT;
  v_cur_atk     SMALLINT;
  v_cur_def     SMALLINT;
  v_new_atk     SMALLINT;
  v_new_def     SMALLINT;
BEGIN
  SELECT status, drop_type, winner INTO v_dispute
  FROM mm3_pool_disputes WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'dispute_not_found');
  END IF;

  IF v_dispute.status <> 'resolved' THEN
    RETURN jsonb_build_object('error', 'not_resolved');
  END IF;

  IF v_dispute.drop_type IS NULL THEN
    RETURN jsonb_build_object('error', 'no_drop');
  END IF;

  SELECT side, squeeze_nftji_claimed INTO v_wallet_dw
  FROM mm3_pool_dispute_wallets
  WHERE dispute_id = p_dispute_id AND wallet = p_wallet;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'wallet_not_in_dispute');
  END IF;

  IF v_dispute.winner <> 'draw' AND v_wallet_dw.side <> v_dispute.winner THEN
    RETURN jsonb_build_object('error', 'not_winner');
  END IF;

  IF v_wallet_dw.squeeze_nftji_claimed THEN
    RETURN jsonb_build_object('error', 'already_claimed');
  END IF;

  -- Mark this wallet as having responded to the drop
  UPDATE mm3_pool_dispute_wallets
  SET squeeze_nftji_claimed = TRUE
  WHERE dispute_id = p_dispute_id AND wallet = p_wallet;

  v_drop_type := v_dispute.drop_type;

  -- Get current NFTJI state for this wallet
  SELECT attack_level, defense_level INTO v_cur_atk, v_cur_def
  FROM mm3_squeeze_nftji WHERE wallet = p_wallet;

  IF NOT FOUND THEN
    -- First ever drop for this wallet
    v_new_atk := CASE WHEN v_drop_type = 'attack'  THEN 0 ELSE -1 END;
    v_new_def := CASE WHEN v_drop_type = 'defense' THEN 0 ELSE -1 END;
    INSERT INTO mm3_squeeze_nftji(wallet, equipped, attack_level, defense_level)
    VALUES (p_wallet, v_drop_type, v_new_atk, v_new_def);
  ELSE
    IF v_drop_type = 'attack' THEN
      v_new_atk := CASE WHEN v_cur_atk < 0 THEN 0 ELSE v_cur_atk + 1 END;
      v_new_def := v_cur_def;
    ELSE
      v_new_atk := v_cur_atk;
      v_new_def := CASE WHEN v_cur_def < 0 THEN 0 ELSE v_cur_def + 1 END;
    END IF;
    UPDATE mm3_squeeze_nftji SET
      equipped      = v_drop_type,
      attack_level  = v_new_atk,
      defense_level = v_new_def,
      updated_at    = NOW()
    WHERE wallet = p_wallet;
  END IF;

  RETURN jsonb_build_object(
    'ok',            true,
    'drop_type',     v_drop_type,
    'attack_level',  v_new_atk,
    'defense_level', v_new_def,
    'equipped',      v_drop_type
  );
END;
$$;

-- ==============================================
-- FUNCTION: check if wallet can leave pool
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_can_leave(p_wallet text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS(
    SELECT 1
    FROM mm3_pool_dispute_wallets dw
    JOIN mm3_pool_disputes d ON d.id = dw.dispute_id
    WHERE dw.wallet = p_wallet
      AND d.status IN ('proposing', 'registering', 'battle_start')
  );
$$;

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
ALTER TABLE mm3_wallet_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_wallet_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_wallet_pool_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_sell_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_visual_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_market_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_command_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_hidden_cmd_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_irc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_wallet_pool_cooldowns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_pool_disputes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_pool_dispute_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_pool_dispute_wallets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_squeeze_nftji            ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "public_read_mm3_wallet_pools" ON mm3_wallet_pools;
CREATE POLICY "public_read_mm3_wallet_pools" ON mm3_wallet_pools FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_wallet_pools" ON mm3_wallet_pools;
CREATE POLICY "public_insert_mm3_wallet_pools" ON mm3_wallet_pools FOR INSERT TO public WITH CHECK (pool_code <> '' AND created_by <> '');

DROP POLICY IF EXISTS "public_update_mm3_wallet_pools" ON mm3_wallet_pools;
CREATE POLICY "public_update_mm3_wallet_pools" ON mm3_wallet_pools FOR UPDATE TO public USING (true) WITH CHECK (pool_code <> '' AND created_by <> '');

DROP POLICY IF EXISTS "public_read_mm3_wallet_pool_members" ON mm3_wallet_pool_members;
CREATE POLICY "public_read_mm3_wallet_pool_members" ON mm3_wallet_pool_members FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_members" ON mm3_wallet_pool_members;
CREATE POLICY "public_insert_mm3_wallet_pool_members" ON mm3_wallet_pool_members FOR INSERT TO public WITH CHECK (wallet <> '' AND pool_code <> '' AND added_by <> '');

DROP POLICY IF EXISTS "public_read_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations;
CREATE POLICY "public_read_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations FOR SELECT TO public USING (true);
CREATE POLICY "public_insert_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations FOR INSERT TO public WITH CHECK (wallet <> '' AND invited_by <> '' AND pool_code <> '');
CREATE POLICY "public_update_mm3_wallet_pool_invitations" ON mm3_wallet_pool_invitations FOR UPDATE TO public USING (true) WITH CHECK (wallet <> '' AND invited_by <> '' AND pool_code <> '');

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

DROP POLICY IF EXISTS "public_read_mm3_wallet_pool_cooldowns" ON mm3_wallet_pool_cooldowns;
CREATE POLICY "public_read_mm3_wallet_pool_cooldowns" ON mm3_wallet_pool_cooldowns FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_pool_disputes"        ON mm3_pool_disputes;
CREATE POLICY "public_read_mm3_pool_disputes" ON mm3_pool_disputes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_pool_dispute_votes"   ON mm3_pool_dispute_votes;
CREATE POLICY "public_read_mm3_pool_dispute_votes" ON mm3_pool_dispute_votes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_pool_dispute_wallets" ON mm3_pool_dispute_wallets;
CREATE POLICY "public_read_mm3_pool_dispute_wallets" ON mm3_pool_dispute_wallets FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_mm3_squeeze_nftji" ON mm3_squeeze_nftji;
CREATE POLICY "public_read_mm3_squeeze_nftji" ON mm3_squeeze_nftji FOR SELECT TO public USING (true);

-- daily_task_claims
DROP POLICY IF EXISTS "public_read_daily_task_claims" ON daily_task_claims;
DROP POLICY IF EXISTS "public_insert_daily_task_claims" ON daily_task_claims;
CREATE POLICY "public_read_daily_task_claims" ON daily_task_claims FOR SELECT TO public USING (true);
CREATE POLICY "public_insert_daily_task_claims" ON daily_task_claims FOR INSERT TO public WITH CHECK (wallet <> '' AND day <> '' AND task_key <> '');

-- mm3_macro_state write policies
DROP POLICY IF EXISTS "public_insert_mm3_macro_state" ON mm3_macro_state;
DROP POLICY IF EXISTS "public_update_mm3_macro_state" ON mm3_macro_state;
CREATE POLICY "public_insert_mm3_macro_state" ON mm3_macro_state FOR INSERT TO public WITH CHECK (id = 1);
CREATE POLICY "public_update_mm3_macro_state" ON mm3_macro_state FOR UPDATE TO public USING (id = 1) WITH CHECK (id = 1);

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
  75,
  65,
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
    ('mm3-023', '/ping -c 4 gateway.mainframe => 5*(4000+x) + 12*(300+x) + (6000+3*x)/3 = ?', '27814'),
    ('mm3-05c', '/nmcli connection reload => (7000+x) + 13*200 + x*4 = ?', '10215'),
    ('mm3-0b9', '/netstat -tulpn => 9000 + 8*x + 3600/3 = ?', '11184'),
    ('mm3-11b', '/git cherry-pick a1b2c3d => 11000 + 21*x + 1440/2 = ?', '14303'),
    ('mm3-184', '/kubectl rollout restart deploy/fractal-core => 12000 + x*17 + 4096/4 = ?', '15115'),
    ('mm3-1e7', '/uptime => 15000 + x*23 + 2048/2 = ?', '18853'),
    ('mm3-244', '/journalctl -n 50 => 18000 + x*31 + 7777%1000 = ?', '22590'),
    ('mm3-26d', '/whoami => 22000 + x*37 + 9999/3 = ?', '29884'),
    ('mm3-2ca', '/hostnamectl status => 26000 + x*41 + 12345%678 = ?', '31184'),
    ('mm3-30e', '/sha256sum /etc/hosts => 30000 + x*47 + 8192/4 = ?', '37829'),
    ('mm3-01d', '/lsblk => 41000 + x*11 + 2048/4 = ?', '42865'),
    ('mm3-04a', '/passwd => (43000+x) + 17*300 + x*3 = ?', '48592'),
    ('mm3-091', '/ufw status verbose => 47000 + 19*x + 4096/8 = ?', '49849'),
    ('mm3-0f8', '/ss -lntp => 51000 + x*29 + 7776/6 = ?', '55863'),
    ('mm3-15c', '/uname -r => 54000 + x*31 + 10000/8 = ?', '59063'),
    ('mm3-1a6', '/gcc --version => 58000 + x*37 + 8192/16 = ?', '63063'),
    ('mm3-20b', '/scp file.txt backup:/tmp/ => 62000 + x*43 + 12345%789 = ?', '67799'),
    ('mm3-29b', '/curl -I http://localhost => 68000 + x*38 + 9999/9 = ?', '75630'),
    ('mm3-2da', '/acpi -V => 73000 + x*32 + 16384/16 = ?', '81281'),
    ('mm3-2f9', '/alsamixer => 79000 + x*25 + 22222%999 = ?', '87485')
) AS v(block_key, market_command, formula_result_5d)
WHERE b.block_key = v.block_key;

-- Mining question seeds intentionally live outside the tracked repository.
-- To keep answers out of GitHub, execute the private local seed file after
-- running this canonical schema:
--   .private/mining-problems.seed.sql
--
-- That private script should contain the INSERTs for public.math_problems.

-- Bot wallets: ensure is_bot flag is set
INSERT INTO player_progress (wallet, is_bot, updated_at)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE, NOW()),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', TRUE, NOW())
ON CONFLICT (wallet) DO UPDATE SET is_bot = TRUE, updated_at = NOW();

-- ==============================================
-- PHASE 10: GRANT PERMISSIONS
-- ==============================================

-- Tables
GRANT SELECT, INSERT           ON games                        TO anon;
GRANT SELECT                   ON math_problems                TO anon;
GRANT SELECT                   ON leaderboard_data             TO anon;
GRANT SELECT, INSERT, UPDATE   ON player_progress              TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_market_state             TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_macro_state              TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_wallet_presence          TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_wallet_pools             TO anon;
GRANT SELECT, INSERT           ON mm3_wallet_pool_members      TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_wallet_pool_invitations  TO anon;
GRANT SELECT, INSERT           ON mm3_sell_transactions        TO anon;
GRANT SELECT, INSERT           ON mm3_market_events            TO anon;
GRANT SELECT, INSERT           ON api_requests                 TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_visual_state             TO anon;
GRANT SELECT, UPDATE           ON mm3_market_blocks            TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_market_commands          TO anon;
GRANT SELECT, INSERT, UPDATE   ON mm3_command_penalties        TO anon;
GRANT SELECT, INSERT           ON mm3_hidden_cmd_executions    TO anon;
GRANT SELECT, INSERT           ON mm3_irc_messages             TO anon;
GRANT DELETE                   ON mm3_irc_messages             TO anon;
GRANT SELECT, INSERT           ON daily_task_claims            TO anon;
GRANT SELECT                   ON mm3_squeeze_nftji            TO anon;

-- Views
GRANT SELECT ON top_positive_miner       TO anon;
GRANT SELECT ON token_value              TO anon;
GRANT SELECT ON token_value_timeseries   TO anon;

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Functions
GRANT EXECUTE ON FUNCTION public.update_leaderboard()              TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn()   TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text)       TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) TO authenticated;
-- ==============================================
-- PHASE 11: INITIAL LEADERBOARD POPULATION
-- ==============================================

SELECT update_leaderboard();

COMMIT;

-- ============================================================
-- FULL RESET  (operational script — NOT part of fresh install)
-- Resets all game state: mining, drills, market, trade, IRC.
-- Run manually in Supabase SQL editor when needed.
-- ============================================================

-- BEGIN;
--
-- -- 0. Disable triggers to avoid side-effects during reset
-- SET session_replication_role = replica;
--
-- -- 1. Reset mining and drill slots (games drive the drill count)
-- DELETE FROM games;
--
-- -- Re-enable triggers
-- SET session_replication_role = DEFAULT;
--
-- -- 2. Mining stats per wallet
-- UPDATE leaderboard_data
-- SET    total_eth      = 0,
--        total_correct  = 0,
--        total_games    = 0,
--        highest_streak = 0,
--        current_streak = 0,
--        rank           = NULL,
--        updated_at     = now();
--
-- -- 3. Wallet progress: level, funds, NFTJIs
-- UPDATE player_progress
-- SET    level                = 0,
--        mm3_sold             = 0,
--        eur_earned           = 0,
--        usd_earned           = 0,
--        cny_earned           = 0,
--        wallet_emojis        = '{}'::text[],
--        market_nftji_key     = NULL,
--        market_nftji_price   = 0,
--        market_nftji_since   = NULL,
--        life_used            = false,
--        lucky_50_claimed     = false,
--        lucky_100_claimed    = false,
--        lucky_500_claimed    = false,
--        lucky_1000_claimed   = false,
--        sell_rate_cny        = 0,
--        sell_quote_cny       = 0,
--        sell_quote_eur       = 0,
--        sell_quote_usd       = 0,
--        updated_at           = now();
--
-- -- 4. Active market commands
-- DELETE FROM mm3_market_commands;
--
-- -- 5. Penalties, hidden executions, daily claims
-- DELETE FROM mm3_command_penalties;
-- DELETE FROM mm3_hidden_cmd_executions;
-- DELETE FROM daily_task_claims;
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_dispute_wallets' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_pool_dispute_wallets';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_dispute_votes' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_pool_dispute_votes';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_disputes' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_pool_disputes';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_members' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_wallet_pool_members';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_invitations' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_wallet_pool_invitations';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pools' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_wallet_pools';
--   END IF;
--   IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_cooldowns' AND relnamespace = 'public'::regnamespace) THEN
--     EXECUTE 'DELETE FROM mm3_wallet_pool_cooldowns';
--   END IF;
-- END$$;
--
-- -- 6. Sell transaction history
-- DELETE FROM mm3_sell_transactions;
--
-- -- 7. Market events
-- DELETE FROM mm3_market_events;
--
-- -- 8. IRC messages: donations/realchain traces preserved
-- -- DELETE FROM mm3_irc_messages;
--
-- -- 9. Trade commissions
-- UPDATE mm3_market_state
-- SET    commission_mm3 = 0,
--        commission_cny = 0,
--        commission_eur = 0,
--        commission_usd = 0,
--        updated_at     = now()
-- WHERE  id = 1;
--
-- -- 9b. World modifiers: war & weather
-- UPDATE mm3_macro_state
-- SET    war_percent    = 75,
--        nature_percent = 65,
--        updated_at     = now()
-- WHERE  id = 1;
--
-- -- 10. Market NFTJI blocks: reset ownership
-- UPDATE mm3_market_blocks
-- SET    first_purchased_at = NULL,
--        claimed_by         = NULL,
--        claimed_source     = NULL,
--        claimed_at         = NULL,
--        paid_eur           = 0,
--        paid_usd           = 0,
--        paid_cny           = 0,
--        updated_at         = now();
--
-- -- 11. Presence: force all wallets offline
-- UPDATE mm3_wallet_presence
-- SET    last_seen  = now() - interval '1 hour',
--        updated_at = now();
--
-- COMMIT;
