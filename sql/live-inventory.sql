-- MathsMine3 public schema inventory (no function bodies, no view SQL, no ops scripts)
-- Matches live Supabase public schema captured 2026-08-22T17:17:09Z
-- Project: udarguklgjjlfnlsqdfw (eu-west-2)
--
-- This file is a GitHub-safe structural photo:
--   tables, columns, sequences, constraints, indexes, RLS policies, GRANT summary,
--   and RPC signatures only.
-- Full live dump (SECURITY DEFINER bodies, view definitions) lives in
--   .private/sql/schema.sql  (gitignored — never push)
-- Authoritative incremental history: supabase/migrations/
--
-- Do not apply this file blindly to production. Use migrations.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================================
-- Function signatures only (bodies omitted — see .private/sql/schema.sql)
-- Live ACL on every public function: EXECUTE for postgres + service_role; revoked from PUBLIC/anon/authenticated
-- ============================================================================

-- FUNCTION public.apply_mm3_boss_attack_player(p_wallet text, p_damage integer, p_boss_gx numeric, p_boss_gy numeric, p_player_gx numeric, p_player_gy numeric, p_boss_id text, p_storm_active boolean)
-- FUNCTION public.apply_mm3_boss_player_hit(p_wallet text, p_damage integer, p_boss_id text)
-- FUNCTION public.apply_mm3_pvp_hit(p_attacker text, p_victim text, p_victim_is_anon boolean, p_damage integer, p_eur_per_hit numeric)
-- FUNCTION public.mm3_bump_account_creation(p_ip text)
-- FUNCTION public.mm3_dispute_can_leave(p_wallet text)
-- FUNCTION public.mm3_dispute_cancel(p_dispute_id bigint)
-- FUNCTION public.mm3_dispute_join(p_dispute_id bigint, p_wallet text)
-- FUNCTION public.mm3_dispute_resolve(p_dispute_id bigint)
-- FUNCTION public.mm3_dispute_start_battle(p_dispute_id bigint)
-- FUNCTION public.mm3_dispute_vote(p_challenger_pool text, p_defender_pool text, p_wallet text)
-- FUNCTION public.mm3_leave_wallet_pool(p_wallet text)
-- FUNCTION public.mm3_pool_max_wallets(p_avg_level integer)
-- FUNCTION public.mm3_pool_rank_from_level(p_level integer)
-- FUNCTION public.mm3_refresh_all_pool_ranks()
-- FUNCTION public.mm3_refresh_pool_rank(p_pool_code text)
-- FUNCTION public.mm3_squeeze_nftji_take(p_dispute_id bigint, p_wallet text)
-- FUNCTION public.mm3_squeezing_nftji_take(p_dispute_id bigint, p_wallet text)
-- FUNCTION public.set_mm3_boss_idle_if_requested(p_map_id text)
-- FUNCTION public.trigger_update_leaderboard_fn()
-- FUNCTION public.update_leaderboard()

-- ============================================================================
-- Sequences
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.games_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.math_problems_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_chain_reset_log_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_chain_solve_attempts_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_command_penalties_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_hidden_cmd_executions_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_mined_blocks_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_mining_blocks_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_mining_commands_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_mining_events_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_pool_dispute_votes_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_pool_dispute_wallets_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_pool_disputes_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_relay_exec_log_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_relaying_messages_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_sell_transactions_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_squeezing_launches_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.mm3_wallet_pool_invitations_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.security_scans_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  CACHE 1;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE public.api_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ip text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daily_task_claims (
  wallet text NOT NULL,
  day text NOT NULL,
  task_key text NOT NULL,
  reward_claimed boolean DEFAULT true NOT NULL,
  reward_eur numeric DEFAULT 0 NOT NULL,
  reward_usd numeric DEFAULT 0 NOT NULL,
  reward_cny numeric DEFAULT 0 NOT NULL,
  claimed_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.daily_task_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.games (
  id integer DEFAULT nextval('games_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  problem text NOT NULL,
  user_answer text NOT NULL,
  is_correct boolean NOT NULL,
  time_ms integer NOT NULL,
  mining_reward numeric DEFAULT 0,
  problem_id bigint,
  difficulty integer,
  problem_type text,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leaderboard_data (
  wallet text NOT NULL,
  total_eth numeric DEFAULT 0,
  total_correct integer DEFAULT 0,
  total_games integer DEFAULT 0,
  highest_streak integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  rank integer,
  updated_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.leaderboard_data ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.math_problems (
  id bigint DEFAULT nextval('math_problems_id_seq'::regclass) NOT NULL,
  problem_type text NOT NULL,
  difficulty integer NOT NULL,
  question text NOT NULL,
  correct_answer text NOT NULL,
  answer_options text[],
  is_definition_type boolean DEFAULT false,
  language text DEFAULT 'en'::text NOT NULL,
  base_points numeric DEFAULT 0.00001 NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.math_problems ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_account_creation_log (
  ip text NOT NULL,
  day date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
  count integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_account_creation_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_chain_reset_log (
  id bigint DEFAULT nextval('mm3_chain_reset_log_id_seq'::regclass) NOT NULL,
  chip integer NOT NULL,
  wallet text DEFAULT 'anon'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_chain_reset_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_chain_solve_attempts (
  id bigint DEFAULT nextval('mm3_chain_solve_attempts_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  day text NOT NULL,
  attempted_at timestamp with time zone DEFAULT now() NOT NULL,
  is_correct boolean DEFAULT false NOT NULL
);

ALTER TABLE public.mm3_chain_solve_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_chain_solvers (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  wallet text NOT NULL,
  solved_at timestamp with time zone DEFAULT now() NOT NULL,
  formula_solved boolean DEFAULT false NOT NULL
);

ALTER TABLE public.mm3_chain_solvers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_command_penalties (
  id bigint DEFAULT nextval('mm3_command_penalties_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  command_id bigint,
  nftji_key text DEFAULT ''::text NOT NULL,
  penalty_code text NOT NULL,
  penalty_effect text DEFAULT 'money'::text NOT NULL,
  penalty_value numeric DEFAULT 0 NOT NULL,
  penalty_eur numeric DEFAULT 0 NOT NULL,
  reason text,
  reset_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
  attempted_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_command_penalties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_hidden_cmd_executions (
  id bigint DEFAULT nextval('mm3_hidden_cmd_executions_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  block_key text NOT NULL,
  amount_eur numeric DEFAULT 0 NOT NULL,
  amount_mm3 numeric DEFAULT 0 NOT NULL,
  executed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_hidden_cmd_executions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_macro_state (
  id smallint DEFAULT 1 NOT NULL,
  war_percent numeric DEFAULT 0 NOT NULL,
  nature_percent numeric DEFAULT 0 NOT NULL,
  ticker_message text DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##'::text NOT NULL,
  ticker_message_en text DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##'::text NOT NULL,
  ticker_message_es text DEFAULT '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  chain_demine_active boolean DEFAULT false NOT NULL,
  chain_demine_hits_remaining integer DEFAULT 100 NOT NULL,
  node_dice_wallet text,
  node_dice_started_at timestamp with time zone,
  node_dice_expires_at timestamp with time zone,
  node_dice_mode text,
  node_dice_hour_start bigint DEFAULT 0 NOT NULL,
  node_dice_war_percent numeric DEFAULT 0 NOT NULL,
  node_dice_nature_percent numeric DEFAULT 0 NOT NULL,
  formula_chain_index_start integer,
  ticker_message_expires_at timestamp with time zone
);

ALTER TABLE public.mm3_macro_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_map_boss (
  id text NOT NULL,
  map_id text NOT NULL,
  name text NOT NULL,
  max_health integer DEFAULT 5000 NOT NULL,
  health integer DEFAULT 5000 NOT NULL,
  state text DEFAULT 'idle'::text NOT NULL,
  damage_totals jsonb DEFAULT '{}'::jsonb NOT NULL,
  defeated_at timestamp with time zone,
  respawn_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_map_boss ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_mined_blocks (
  id bigint DEFAULT nextval('mm3_mined_blocks_id_seq'::regclass) NOT NULL,
  block_hex text NOT NULL,
  grid_row integer NOT NULL,
  grid_col integer NOT NULL,
  wallet text NOT NULL,
  wallet_level integer DEFAULT 0 NOT NULL,
  mm3_value numeric DEFAULT 0 NOT NULL,
  mm3_value_hex text DEFAULT '0'::text NOT NULL,
  chain_index integer NOT NULL,
  mined_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_mined_blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_mining_blocks (
  id bigint DEFAULT nextval('mm3_mining_blocks_id_seq'::regclass) NOT NULL,
  block_key text NOT NULL,
  grid_row integer NOT NULL,
  grid_col integer NOT NULL,
  emoji text NOT NULL,
  title_en text DEFAULT ''::text NOT NULL,
  title_es text DEFAULT ''::text NOT NULL,
  answer_hash text NOT NULL,
  price_eur numeric DEFAULT 1 NOT NULL,
  short_url text,
  is_active boolean DEFAULT true NOT NULL,
  claimed_by text,
  claimed_source text,
  claimed_at timestamp with time zone,
  first_purchased_at timestamp with time zone,
  paid_eur numeric DEFAULT 0 NOT NULL,
  paid_usd numeric DEFAULT 0 NOT NULL,
  paid_cny numeric DEFAULT 0 NOT NULL,
  market_command text DEFAULT ''::text NOT NULL,
  formula_x integer DEFAULT 123 NOT NULL,
  formula_result_5d text DEFAULT ''::text NOT NULL,
  hidden_command text DEFAULT ''::text NOT NULL,
  hidden_cmd_min_level integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_mining_blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_mining_commands (
  id bigint DEFAULT nextval('mm3_mining_commands_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  nftji_key text NOT NULL,
  command text NOT NULL,
  numeric_code text DEFAULT ''::text NOT NULL,
  formula_x integer DEFAULT 0 NOT NULL,
  reset_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
  executed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_mining_commands ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_mining_events (
  id bigint DEFAULT nextval('mm3_mining_events_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  event_type text NOT NULL,
  delta_mm3 numeric DEFAULT 0 NOT NULL,
  emoji text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_mining_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_mining_state (
  id smallint DEFAULT 1 NOT NULL,
  commission_mm3 numeric DEFAULT 0 NOT NULL,
  commission_cny numeric DEFAULT 0 NOT NULL,
  commission_eur numeric DEFAULT 0 NOT NULL,
  commission_usd numeric DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_mining_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_pool_dispute_votes (
  id bigint DEFAULT nextval('mm3_pool_dispute_votes_id_seq'::regclass) NOT NULL,
  challenger_pool_code text NOT NULL,
  defender_pool_code text NOT NULL,
  wallet text NOT NULL,
  voted_at timestamp with time zone DEFAULT now() NOT NULL,
  dispute_id bigint
);

ALTER TABLE public.mm3_pool_dispute_votes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_pool_dispute_wallets (
  id bigint DEFAULT nextval('mm3_pool_dispute_wallets_id_seq'::regclass) NOT NULL,
  dispute_id bigint NOT NULL,
  wallet text NOT NULL,
  pool_code text NOT NULL,
  side text NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  level_snap integer DEFAULT 0 NOT NULL,
  mm3_snap numeric DEFAULT 0 NOT NULL,
  eur_snap numeric DEFAULT 0 NOT NULL,
  usd_snap numeric DEFAULT 0 NOT NULL,
  cny_snap numeric DEFAULT 0 NOT NULL,
  exec_snap integer DEFAULT 0 NOT NULL,
  nftji_snap integer DEFAULT 0 NOT NULL,
  mining_nftji_snap text,
  mining_nftji_level_snap integer DEFAULT 0 NOT NULL,
  has_penalty boolean DEFAULT false NOT NULL,
  eur_stake numeric DEFAULT 0 NOT NULL,
  mm3_stake numeric DEFAULT 0 NOT NULL,
  delta_eur numeric DEFAULT 0 NOT NULL,
  delta_mm3 numeric DEFAULT 0 NOT NULL,
  squeeze_nftji_equipped text,
  squeeze_nftji_level smallint DEFAULT '-1'::integer NOT NULL,
  squeeze_nftji_claimed boolean DEFAULT false NOT NULL
);

ALTER TABLE public.mm3_pool_dispute_wallets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_pool_disputes (
  id bigint DEFAULT nextval('mm3_pool_disputes_id_seq'::regclass) NOT NULL,
  challenger_pool_code text NOT NULL,
  defender_pool_code text NOT NULL,
  status text DEFAULT 'proposing'::text NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  battle_start_at timestamp with time zone,
  resolved_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  war_percent numeric,
  nature_percent numeric,
  dice_modifier numeric,
  ch_wallet_count integer DEFAULT 0 NOT NULL,
  ch_level_sum numeric DEFAULT 0 NOT NULL,
  ch_mm3_sum numeric DEFAULT 0 NOT NULL,
  ch_eur_sum numeric DEFAULT 0 NOT NULL,
  ch_nftji_count integer DEFAULT 0 NOT NULL,
  ch_mining_nftji_count integer DEFAULT 0 NOT NULL,
  ch_penalty_count integer DEFAULT 0 NOT NULL,
  ch_exec_count integer DEFAULT 0 NOT NULL,
  ch_score numeric,
  df_wallet_count integer DEFAULT 0 NOT NULL,
  df_level_sum numeric DEFAULT 0 NOT NULL,
  df_mm3_sum numeric DEFAULT 0 NOT NULL,
  df_eur_sum numeric DEFAULT 0 NOT NULL,
  df_nftji_count integer DEFAULT 0 NOT NULL,
  df_mining_nftji_count integer DEFAULT 0 NOT NULL,
  df_penalty_count integer DEFAULT 0 NOT NULL,
  df_exec_count integer DEFAULT 0 NOT NULL,
  df_score numeric,
  winner text,
  result_summary jsonb,
  drop_type text,
  ch_squeeze_atk_sum integer DEFAULT 0 NOT NULL,
  df_squeeze_atk_sum integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.mm3_pool_disputes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_pvp_health (
  wallet text NOT NULL,
  health integer DEFAULT 100 NOT NULL,
  deaths integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  pvp_dead_until timestamp with time zone,
  pvp_dead_gx double precision,
  pvp_dead_gy double precision,
  last_pos_row integer,
  last_pos_col integer,
  pos_updated_at timestamp with time zone,
  last_pos_z numeric DEFAULT 0,
  last_pos_map_id text
);

ALTER TABLE public.mm3_pvp_health ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_pvp_hits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  attacker_wallet text NOT NULL,
  victim_wallet text NOT NULL,
  day_key text NOT NULL,
  hit_count integer DEFAULT 0 NOT NULL,
  eur_stolen numeric(12,6) DEFAULT 0 NOT NULL,
  first_hit_at timestamp with time zone DEFAULT now() NOT NULL,
  last_hit_at timestamp with time zone DEFAULT now() NOT NULL,
  elim_count integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.mm3_pvp_hits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_relay_exec_log (
  id bigint DEFAULT nextval('mm3_relay_exec_log_id_seq'::regclass) NOT NULL,
  wallet_origin text NOT NULL,
  wallet_target text NOT NULL,
  delta_origin integer DEFAULT 1 NOT NULL,
  delta_target integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_relay_exec_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_relaying_messages (
  id bigint DEFAULT nextval('mm3_relaying_messages_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  "text" text NOT NULL,
  ts bigint NOT NULL,
  kind text DEFAULT 'chat'::text NOT NULL,
  tone text DEFAULT 'neutral'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_relaying_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_sell_transactions (
  id bigint DEFAULT nextval('mm3_sell_transactions_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  source text DEFAULT 'wallet'::text NOT NULL,
  level integer DEFAULT 0 NOT NULL,
  mm3_amount numeric DEFAULT 0 NOT NULL,
  mm3_commission numeric DEFAULT 0 NOT NULL,
  rate_cny numeric DEFAULT 0 NOT NULL,
  gross_cny numeric DEFAULT 0 NOT NULL,
  gross_eur numeric DEFAULT 0 NOT NULL,
  gross_usd numeric DEFAULT 0 NOT NULL,
  commission_rate numeric DEFAULT 0 NOT NULL,
  commission_cny numeric DEFAULT 0 NOT NULL,
  commission_eur numeric DEFAULT 0 NOT NULL,
  commission_usd numeric DEFAULT 0 NOT NULL,
  net_cny numeric DEFAULT 0 NOT NULL,
  net_eur numeric DEFAULT 0 NOT NULL,
  net_usd numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_sell_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_squeezing_launches (
  id bigint DEFAULT nextval('mm3_squeezing_launches_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  challenger_pool_code text NOT NULL,
  defender_pool_code text NOT NULL,
  dispute_id bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_squeezing_launches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_squeezing_nftji (
  wallet text NOT NULL,
  equipped text,
  attack_level smallint DEFAULT '-1'::integer NOT NULL,
  defense_level smallint DEFAULT '-1'::integer NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_squeezing_nftji ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_wallet_pool_cooldowns (
  wallet text NOT NULL,
  left_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL
);

ALTER TABLE public.mm3_wallet_pool_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_wallet_pool_invitations (
  id bigint DEFAULT nextval('mm3_wallet_pool_invitations_id_seq'::regclass) NOT NULL,
  wallet text NOT NULL,
  invited_by text NOT NULL,
  pool_code text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  accepted_at timestamp with time zone
);

ALTER TABLE public.mm3_wallet_pool_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_wallet_pool_members (
  wallet text NOT NULL,
  pool_code text NOT NULL,
  added_by text NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_wallet_pool_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_wallet_pools (
  pool_code text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_wallet_pools ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm3_wallet_presence (
  wallet text NOT NULL,
  source text DEFAULT 'wallet'::text NOT NULL,
  last_seen timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.mm3_wallet_presence ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.player_progress (
  wallet text NOT NULL,
  level integer DEFAULT 0 NOT NULL,
  block_chain_percent numeric DEFAULT 0 NOT NULL,
  mm3_sold numeric DEFAULT 0 NOT NULL,
  cny_earned numeric DEFAULT 0 NOT NULL,
  eur_earned numeric DEFAULT 0 NOT NULL,
  usd_earned numeric DEFAULT 0 NOT NULL,
  wallet_emojis text[] DEFAULT '{}'::text[] NOT NULL,
  mining_nftji_key text,
  mining_nftji_price numeric DEFAULT 0 NOT NULL,
  mining_nftji_since timestamp with time zone,
  life_used boolean DEFAULT false NOT NULL,
  lucky_50_claimed boolean DEFAULT false NOT NULL,
  lucky_100_claimed boolean DEFAULT false NOT NULL,
  lucky_500_claimed boolean DEFAULT false NOT NULL,
  lucky_1000_claimed boolean DEFAULT false NOT NULL,
  lucky_50_level integer DEFAULT '-1'::integer NOT NULL,
  lucky_100_level integer DEFAULT '-1'::integer NOT NULL,
  lucky_500_level integer DEFAULT '-1'::integer NOT NULL,
  lucky_1000_level integer DEFAULT '-1'::integer NOT NULL,
  mining_nftji_levels jsonb DEFAULT '{}'::jsonb NOT NULL,
  sell_rate_cny numeric DEFAULT 0 NOT NULL,
  sell_quote_cny numeric DEFAULT 0 NOT NULL,
  sell_quote_eur numeric DEFAULT 0 NOT NULL,
  sell_quote_usd numeric DEFAULT 0 NOT NULL,
  is_bot boolean DEFAULT false NOT NULL,
  relay_exec_count integer DEFAULT 0 NOT NULL,
  relay_nftji_acquired_at timestamp with time zone,
  relay_nftji_partner text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  rl_mount_active boolean DEFAULT false NOT NULL,
  zero_day_level integer DEFAULT '-1'::integer NOT NULL
);

ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.security_scans (
  id integer DEFAULT nextval('security_scans_id_seq'::regclass) NOT NULL,
  triggered_by text NOT NULL,
  triggered_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  duration_ms integer,
  status text DEFAULT 'running'::text NOT NULL,
  score integer,
  results jsonb,
  summary text
);

ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;
ALTER SEQUENCE public.math_problems_id_seq OWNED BY public.math_problems.id;
ALTER SEQUENCE public.mm3_chain_reset_log_id_seq OWNED BY public.mm3_chain_reset_log.id;
ALTER SEQUENCE public.mm3_chain_solve_attempts_id_seq OWNED BY public.mm3_chain_solve_attempts.id;
ALTER SEQUENCE public.mm3_command_penalties_id_seq OWNED BY public.mm3_command_penalties.id;
ALTER SEQUENCE public.mm3_hidden_cmd_executions_id_seq OWNED BY public.mm3_hidden_cmd_executions.id;
ALTER SEQUENCE public.mm3_mined_blocks_id_seq OWNED BY public.mm3_mined_blocks.id;
ALTER SEQUENCE public.mm3_mining_blocks_id_seq OWNED BY public.mm3_mining_blocks.id;
ALTER SEQUENCE public.mm3_mining_commands_id_seq OWNED BY public.mm3_mining_commands.id;
ALTER SEQUENCE public.mm3_mining_events_id_seq OWNED BY public.mm3_mining_events.id;
ALTER SEQUENCE public.mm3_pool_dispute_votes_id_seq OWNED BY public.mm3_pool_dispute_votes.id;
ALTER SEQUENCE public.mm3_pool_dispute_wallets_id_seq OWNED BY public.mm3_pool_dispute_wallets.id;
ALTER SEQUENCE public.mm3_pool_disputes_id_seq OWNED BY public.mm3_pool_disputes.id;
ALTER SEQUENCE public.mm3_relay_exec_log_id_seq OWNED BY public.mm3_relay_exec_log.id;
ALTER SEQUENCE public.mm3_relaying_messages_id_seq OWNED BY public.mm3_relaying_messages.id;
ALTER SEQUENCE public.mm3_sell_transactions_id_seq OWNED BY public.mm3_sell_transactions.id;
ALTER SEQUENCE public.mm3_squeezing_launches_id_seq OWNED BY public.mm3_squeezing_launches.id;
ALTER SEQUENCE public.mm3_wallet_pool_invitations_id_seq OWNED BY public.mm3_wallet_pool_invitations.id;
ALTER SEQUENCE public.security_scans_id_seq OWNED BY public.security_scans.id;

-- ============================================================================
-- Constraints
-- ============================================================================

ALTER TABLE public.api_requests ADD CONSTRAINT api_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_task_claims ADD CONSTRAINT daily_task_claims_pkey PRIMARY KEY (wallet, day, task_key);
ALTER TABLE public.games ADD CONSTRAINT games_pkey PRIMARY KEY (id);
ALTER TABLE public.leaderboard_data ADD CONSTRAINT leaderboard_data_pkey PRIMARY KEY (wallet);
ALTER TABLE public.math_problems ADD CONSTRAINT math_problems_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_account_creation_log ADD CONSTRAINT mm3_account_creation_log_pkey PRIMARY KEY (ip, day);
ALTER TABLE public.mm3_chain_reset_log ADD CONSTRAINT mm3_chain_reset_log_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_chain_solve_attempts ADD CONSTRAINT mm3_chain_solve_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_chain_solvers ADD CONSTRAINT mm3_chain_solvers_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_command_penalties ADD CONSTRAINT mm3_command_penalties_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_hidden_cmd_executions ADD CONSTRAINT mm3_hidden_cmd_executions_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_map_boss ADD CONSTRAINT mm3_map_boss_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_mined_blocks ADD CONSTRAINT mm3_mined_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_mining_blocks ADD CONSTRAINT mm3_mining_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_mining_commands ADD CONSTRAINT mm3_mining_commands_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_mining_events ADD CONSTRAINT mm3_mining_events_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_mining_state ADD CONSTRAINT mm3_mining_state_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_pool_dispute_votes ADD CONSTRAINT mm3_pool_dispute_votes_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_pool_dispute_wallets ADD CONSTRAINT mm3_pool_dispute_wallets_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_pool_disputes ADD CONSTRAINT mm3_pool_disputes_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_pvp_health ADD CONSTRAINT mm3_pvp_health_pkey PRIMARY KEY (wallet);
ALTER TABLE public.mm3_pvp_hits ADD CONSTRAINT mm3_pvp_hits_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_relay_exec_log ADD CONSTRAINT mm3_relay_exec_log_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_relaying_messages ADD CONSTRAINT mm3_relaying_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_sell_transactions ADD CONSTRAINT mm3_sell_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_squeezing_launches ADD CONSTRAINT mm3_squeezing_launches_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_squeezing_nftji ADD CONSTRAINT mm3_squeezing_nftji_pkey PRIMARY KEY (wallet);
ALTER TABLE public.mm3_wallet_pool_cooldowns ADD CONSTRAINT mm3_wallet_pool_cooldowns_pkey PRIMARY KEY (wallet);
ALTER TABLE public.mm3_wallet_pool_invitations ADD CONSTRAINT mm3_wallet_pool_invitations_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_wallet_pool_members ADD CONSTRAINT mm3_wallet_pool_members_pkey PRIMARY KEY (wallet);
ALTER TABLE public.mm3_wallet_pools ADD CONSTRAINT mm3_wallet_pools_pkey PRIMARY KEY (pool_code);
ALTER TABLE public.mm3_wallet_presence ADD CONSTRAINT mm3_wallet_presence_pkey PRIMARY KEY (wallet);
ALTER TABLE public.player_progress ADD CONSTRAINT player_progress_pkey PRIMARY KEY (wallet);
ALTER TABLE public.security_scans ADD CONSTRAINT security_scans_pkey PRIMARY KEY (id);
ALTER TABLE public.mm3_chain_solve_attempts ADD CONSTRAINT mm3_chain_solve_attempts_wallet_day_key UNIQUE (wallet, day);
ALTER TABLE public.mm3_chain_solvers ADD CONSTRAINT mm3_chain_solvers_wallet_key UNIQUE (wallet);
ALTER TABLE public.mm3_mined_blocks ADD CONSTRAINT mm3_mined_blocks_block_hex_key UNIQUE (block_hex);
ALTER TABLE public.mm3_mined_blocks ADD CONSTRAINT mm3_mined_blocks_chain_index_key UNIQUE (chain_index);
ALTER TABLE public.mm3_mining_blocks ADD CONSTRAINT mm3_mining_blocks_block_key_key UNIQUE (block_key);
ALTER TABLE public.mm3_pool_dispute_votes ADD CONSTRAINT mm3_pool_dispute_votes_challenger_pool_code_defender_pool_c_key UNIQUE (challenger_pool_code, defender_pool_code, wallet);
ALTER TABLE public.mm3_pool_dispute_wallets ADD CONSTRAINT mm3_pool_dispute_wallets_dispute_id_wallet_key UNIQUE (dispute_id, wallet);
ALTER TABLE public.mm3_pvp_hits ADD CONSTRAINT mm3_pvp_hits_attacker_wallet_victim_wallet_day_key_key UNIQUE (attacker_wallet, victim_wallet, day_key);
ALTER TABLE public.games ADD CONSTRAINT games_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5);
ALTER TABLE public.games ADD CONSTRAINT games_problem_type_check CHECK (problem_type = ANY (ARRAY['arithmetic'::text, 'operator_fix'::text, 'digit_fix'::text, 'powers'::text, 'sequence'::text, 'definition'::text, 'modulo'::text, 'logic'::text, 'fractions'::text, 'primes'::text, 'geometry'::text, 'percentage'::text, 'algebra'::text]));
ALTER TABLE public.games ADD CONSTRAINT games_wallet_is_eth_address CHECK (lower(btrim(wallet)) ~ '^0x[0-9a-f]{40}$'::text);
ALTER TABLE public.leaderboard_data ADD CONSTRAINT leaderboard_wallet_is_eth_address CHECK (lower(btrim(wallet)) ~ '^0x[0-9a-f]{40}$'::text);
ALTER TABLE public.leaderboard_data ADD CONSTRAINT leaderboard_wallet_not_anonymous CHECK (lower(btrim(wallet)) !~ '^anon($|[-:])'::text);
ALTER TABLE public.math_problems ADD CONSTRAINT math_problems_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5);
ALTER TABLE public.math_problems ADD CONSTRAINT math_problems_language_check CHECK (language = ANY (ARRAY['en'::text, 'es'::text]));
ALTER TABLE public.math_problems ADD CONSTRAINT math_problems_problem_type_check CHECK (problem_type = ANY (ARRAY['arithmetic'::text, 'operator_fix'::text, 'digit_fix'::text, 'powers'::text, 'sequence'::text, 'definition'::text, 'modulo'::text, 'logic'::text, 'fractions'::text, 'primes'::text, 'geometry'::text, 'percentage'::text, 'algebra'::text]));
ALTER TABLE public.mm3_chain_reset_log ADD CONSTRAINT mm3_chain_reset_log_chip_check CHECK (chip = ANY (ARRAY[1, 2]));
ALTER TABLE public.mm3_command_penalties ADD CONSTRAINT mm3_command_penalties_penalty_effect_check CHECK (penalty_effect = ANY (ARRAY['money'::text, 'mm3'::text]));
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_id_check CHECK (id = 1);
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_nature_percent_check CHECK (nature_percent >= 0::numeric AND nature_percent <= 100::numeric);
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_node_dice_mode_check CHECK (node_dice_mode IS NULL OR (node_dice_mode = ANY (ARRAY['war'::text, 'meteo'::text])));
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_node_dice_nature_percent_check CHECK (node_dice_nature_percent >= 0::numeric AND node_dice_nature_percent <= 100::numeric);
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_node_dice_war_percent_check CHECK (node_dice_war_percent >= 0::numeric AND node_dice_war_percent <= 100::numeric);
ALTER TABLE public.mm3_macro_state ADD CONSTRAINT mm3_macro_state_war_percent_check CHECK (war_percent >= 0::numeric AND war_percent <= 100::numeric);
ALTER TABLE public.mm3_map_boss ADD CONSTRAINT mm3_map_boss_state_check CHECK (state = ANY (ARRAY['idle'::text, 'active'::text, 'dead'::text]));
ALTER TABLE public.mm3_mined_blocks ADD CONSTRAINT mm3_mined_blocks_block_hex_check CHECK (block_hex ~ '^#[0-9A-F]{3}$'::text);
ALTER TABLE public.mm3_mined_blocks ADD CONSTRAINT mm3_mined_blocks_wallet_level_check CHECK (wallet_level >= 0 AND wallet_level <= 100);
ALTER TABLE public.mm3_mining_blocks ADD CONSTRAINT mm3_mining_blocks_claimed_source_check CHECK (claimed_source = ANY (ARRAY['wallet'::text, 'google'::text]));
ALTER TABLE public.mm3_mining_blocks ADD CONSTRAINT mm3_mining_blocks_price_eur_check CHECK (price_eur >= 0::numeric);
ALTER TABLE public.mm3_mining_events ADD CONSTRAINT mm3_mining_events_event_type_check CHECK (event_type = ANY (ARRAY['life_continue'::text, 'nftji_claim'::text, 'mining_buy'::text, 'mining_resell'::text, 'nftji_level_up'::text, 'node_stormroll'::text, 'rl_mount_buy'::text, 'relaying'::text]));
ALTER TABLE public.mm3_mining_state ADD CONSTRAINT mm3_mining_state_id_check CHECK (id = 1);
ALTER TABLE public.mm3_pool_dispute_wallets ADD CONSTRAINT mm3_pool_dispute_wallets_side_check CHECK (side = ANY (ARRAY['challenger'::text, 'defender'::text]));
ALTER TABLE public.mm3_pool_dispute_wallets ADD CONSTRAINT mm3_pool_dispute_wallets_squeeze_nftji_equipped_check CHECK (squeeze_nftji_equipped = ANY (ARRAY['attack'::text, 'defense'::text]));
ALTER TABLE public.mm3_pool_disputes ADD CONSTRAINT mm3_pool_disputes_drop_type_check CHECK (drop_type = ANY (ARRAY['attack'::text, 'defense'::text]));
ALTER TABLE public.mm3_pool_disputes ADD CONSTRAINT mm3_pool_disputes_status_check CHECK (status = ANY (ARRAY['proposing'::text, 'registering'::text, 'battle_start'::text, 'resolved'::text, 'cancelled'::text]));
ALTER TABLE public.mm3_pool_disputes ADD CONSTRAINT mm3_pool_disputes_winner_check CHECK (winner = ANY (ARRAY['challenger'::text, 'defender'::text, 'draw'::text]));
ALTER TABLE public.mm3_pvp_health ADD CONSTRAINT mm3_pvp_health_health_check CHECK (health >= 0 AND health <= 100);
ALTER TABLE public.mm3_relaying_messages ADD CONSTRAINT mm3_relaying_messages_kind_check CHECK (kind = ANY (ARRAY['chat'::text, 'system'::text]));
ALTER TABLE public.mm3_sell_transactions ADD CONSTRAINT mm3_sell_transactions_level_check CHECK (level >= 0 AND level <= 100);
ALTER TABLE public.mm3_sell_transactions ADD CONSTRAINT mm3_sell_transactions_source_check CHECK (source = ANY (ARRAY['wallet'::text, 'google'::text]));
ALTER TABLE public.mm3_squeezing_nftji ADD CONSTRAINT mm3_squeezing_nftji_equipped_check CHECK (equipped = ANY (ARRAY['attack'::text, 'defense'::text]));
ALTER TABLE public.mm3_wallet_pool_invitations ADD CONSTRAINT mm3_wallet_pool_invitations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));
ALTER TABLE public.mm3_wallet_pools ADD CONSTRAINT mm3_wallet_pools_pool_code_check CHECK (pool_code ~ '^[A-Z0-9]{5}$'::text);
ALTER TABLE public.mm3_wallet_presence ADD CONSTRAINT mm3_wallet_presence_source_check CHECK (source = ANY (ARRAY['wallet'::text, 'google'::text]));
ALTER TABLE public.player_progress ADD CONSTRAINT player_progress_block_chain_percent_check CHECK (block_chain_percent >= 0::numeric AND block_chain_percent <= 100::numeric);
ALTER TABLE public.player_progress ADD CONSTRAINT player_progress_level_check CHECK (level >= 0 AND level <= 100);
ALTER TABLE public.player_progress ADD CONSTRAINT player_progress_wallet_is_eth_address CHECK (lower(btrim(wallet)) ~ '^0x[0-9a-f]{40}$'::text);
ALTER TABLE public.player_progress ADD CONSTRAINT player_progress_wallet_not_anonymous CHECK (lower(btrim(wallet)) !~ '^anon($|[-:])'::text);
ALTER TABLE public.security_scans ADD CONSTRAINT security_scans_score_check CHECK (score >= 0 AND score <= 100);
ALTER TABLE public.security_scans ADD CONSTRAINT security_scans_status_check CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text]));
ALTER TABLE public.security_scans ADD CONSTRAINT security_scans_triggered_by_check CHECK (triggered_by = ANY (ARRAY['manual'::text, 'cron'::text]));
ALTER TABLE public.mm3_command_penalties ADD CONSTRAINT mm3_command_penalties_command_id_fkey FOREIGN KEY (command_id) REFERENCES mm3_mining_commands(id) ON DELETE CASCADE;
ALTER TABLE public.mm3_pool_dispute_votes ADD CONSTRAINT mm3_pool_dispute_votes_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES mm3_pool_disputes(id);
ALTER TABLE public.mm3_pool_dispute_wallets ADD CONSTRAINT mm3_pool_dispute_wallets_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES mm3_pool_disputes(id) ON DELETE CASCADE;
ALTER TABLE public.mm3_squeezing_launches ADD CONSTRAINT mm3_squeezing_launches_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES mm3_pool_disputes(id) ON DELETE SET NULL;
ALTER TABLE public.mm3_wallet_pool_invitations ADD CONSTRAINT mm3_wallet_pool_invitations_pool_code_fkey FOREIGN KEY (pool_code) REFERENCES mm3_wallet_pools(pool_code) ON DELETE CASCADE;
ALTER TABLE public.mm3_wallet_pool_members ADD CONSTRAINT mm3_wallet_pool_members_pool_code_fkey FOREIGN KEY (pool_code) REFERENCES mm3_wallet_pools(pool_code) ON DELETE CASCADE;

-- ============================================================================
-- Indexes (excluding PK / UNIQUE constraint indexes)
-- ============================================================================

CREATE INDEX idx_games_created_at ON public.games USING btree (created_at);
CREATE INDEX idx_games_wallet ON public.games USING btree (wallet);
CREATE INDEX idx_games_wallet_correct ON public.games USING btree (wallet, is_correct);
CREATE INDEX idx_leaderboard_data_total_eth ON public.leaderboard_data USING btree (total_eth DESC);
CREATE INDEX idx_problems_difficulty ON public.math_problems USING btree (difficulty);
CREATE INDEX idx_problems_language_difficulty ON public.math_problems USING btree (language, difficulty);
CREATE INDEX idx_problems_type ON public.math_problems USING btree (problem_type);
CREATE INDEX idx_problems_type_difficulty ON public.math_problems USING btree (problem_type, difficulty);
CREATE INDEX idx_mm3_command_penalties_active ON public.mm3_command_penalties USING btree (wallet, reset_at DESC) WHERE (redeemed_at IS NULL);
CREATE INDEX idx_mm3_command_penalties_command_id ON public.mm3_command_penalties USING btree (command_id);
CREATE INDEX idx_mm3_command_penalties_wallet ON public.mm3_command_penalties USING btree (wallet);
CREATE INDEX idx_mm3_hidden_cmd_executions_wallet_block ON public.mm3_hidden_cmd_executions USING btree (wallet, block_key, executed_at DESC);
CREATE INDEX idx_mm3_mined_blocks_chain_index ON public.mm3_mined_blocks USING btree (chain_index);
CREATE INDEX idx_mm3_mined_blocks_wallet ON public.mm3_mined_blocks USING btree (wallet);
CREATE INDEX idx_mm3_mining_blocks_claimed_by ON public.mm3_mining_blocks USING btree (claimed_by);
CREATE INDEX idx_mm3_mining_commands_nftji_key_reset ON public.mm3_mining_commands USING btree (nftji_key, reset_at DESC);
CREATE INDEX idx_mm3_mining_commands_wallet ON public.mm3_mining_commands USING btree (wallet);
CREATE INDEX idx_mm3_mining_events_created_at ON public.mm3_mining_events USING btree (created_at DESC);
CREATE INDEX idx_mm3_mining_events_wallet ON public.mm3_mining_events USING btree (wallet);
CREATE INDEX idx_mm3_pool_dispute_votes_dispute_id ON public.mm3_pool_dispute_votes USING btree (dispute_id);
CREATE INDEX idx_mm3_pool_dispute_votes_pairing ON public.mm3_pool_dispute_votes USING btree (challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_dispute_wallets_dispute ON public.mm3_pool_dispute_wallets USING btree (dispute_id, side);
CREATE INDEX idx_mm3_pool_dispute_wallets_wallet ON public.mm3_pool_dispute_wallets USING btree (wallet);
CREATE INDEX idx_mm3_pool_disputes_pools ON public.mm3_pool_disputes USING btree (challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_disputes_status ON public.mm3_pool_disputes USING btree (status);
CREATE INDEX mm3_pvp_hits_attacker_idx ON public.mm3_pvp_hits USING btree (attacker_wallet, day_key);
CREATE INDEX mm3_pvp_hits_victim_idx ON public.mm3_pvp_hits USING btree (victim_wallet, day_key);
CREATE INDEX idx_relay_exec_log_created ON public.mm3_relay_exec_log USING btree (created_at DESC);
CREATE INDEX idx_relay_exec_log_origin ON public.mm3_relay_exec_log USING btree (wallet_origin);
CREATE INDEX idx_relay_exec_log_target ON public.mm3_relay_exec_log USING btree (wallet_target);
CREATE INDEX idx_mm3_relaying_messages_created_at ON public.mm3_relaying_messages USING btree (created_at DESC);
CREATE INDEX idx_mm3_relaying_messages_ts ON public.mm3_relaying_messages USING btree (ts DESC);
CREATE INDEX idx_mm3_relaying_messages_wallet ON public.mm3_relaying_messages USING btree (wallet);
CREATE INDEX idx_mm3_sell_transactions_created_at ON public.mm3_sell_transactions USING btree (created_at DESC);
CREATE INDEX idx_mm3_sell_transactions_wallet ON public.mm3_sell_transactions USING btree (wallet);
CREATE INDEX idx_mm3_squeezing_launches_dispute_id ON public.mm3_squeezing_launches USING btree (dispute_id);
CREATE INDEX idx_mm3_squeezing_launches_wallet_created ON public.mm3_squeezing_launches USING btree (wallet, created_at DESC);
CREATE INDEX idx_mm3_squeezing_nftji_equipped ON public.mm3_squeezing_nftji USING btree (equipped) WHERE (equipped IS NOT NULL);
CREATE INDEX idx_mm3_squeezing_nftji_wallet ON public.mm3_squeezing_nftji USING btree (wallet);
CREATE INDEX idx_mm3_wallet_pool_cooldowns_expires ON public.mm3_wallet_pool_cooldowns USING btree (wallet, expires_at);
CREATE INDEX idx_mm3_wallet_pool_invitations_pool_code ON public.mm3_wallet_pool_invitations USING btree (pool_code);
CREATE INDEX idx_mm3_wallet_pool_invitations_wallet ON public.mm3_wallet_pool_invitations USING btree (wallet);
CREATE INDEX idx_mm3_wallet_pool_members_pool_code ON public.mm3_wallet_pool_members USING btree (pool_code);
CREATE INDEX idx_mm3_wallet_presence_last_seen ON public.mm3_wallet_presence USING btree (last_seen DESC);
CREATE INDEX idx_player_progress_block_chain_percent ON public.player_progress USING btree (block_chain_percent DESC);
CREATE INDEX idx_player_progress_level ON public.player_progress USING btree (level DESC);
CREATE INDEX idx_player_progress_mining_nftji_key ON public.player_progress USING btree (mining_nftji_key) WHERE (mining_nftji_key IS NOT NULL);

-- ============================================================================
-- Views (definitions omitted — they encode economy formulas)
-- ============================================================================
-- public.token_value              WITH (security_invoker = true)
-- public.token_value_timeseries   WITH (security_invoker = true)
-- public.top_positive_miner       WITH (security_invoker = true)

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER trigger_update_leaderboard AFTER INSERT ON public.games FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_leaderboard_fn();

-- ============================================================================
-- Row Level Security policies (exact live names / cmds / roles / quals)
-- ============================================================================

CREATE POLICY public_insert_api_requests ON public.api_requests FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY public_read_api_requests ON public.api_requests FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_daily_task_claims ON public.daily_task_claims FOR INSERT TO PUBLIC WITH CHECK (((wallet <> ''::text) AND (day <> ''::text) AND (task_key <> ''::text)));
CREATE POLICY public_read_daily_task_claims ON public.daily_task_claims FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_games ON public.games FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_leaderboard_data ON public.leaderboard_data FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_math_problems ON public.math_problems FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_chain_solve_attempts ON public.mm3_chain_solve_attempts FOR INSERT TO PUBLIC WITH CHECK (((wallet <> ''::text) AND (day <> ''::text)));
CREATE POLICY public_read_chain_solve_attempts ON public.mm3_chain_solve_attempts FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_command_penalties ON public.mm3_command_penalties FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_mm3_hidden_cmd_executions ON public.mm3_hidden_cmd_executions FOR INSERT TO PUBLIC WITH CHECK (((wallet <> ''::text) AND (block_key <> ''::text)));
CREATE POLICY public_read_mm3_hidden_cmd_executions ON public.mm3_hidden_cmd_executions FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_mm3_macro_state ON public.mm3_macro_state FOR INSERT TO PUBLIC WITH CHECK ((id = 1));
CREATE POLICY public_read_mm3_macro_state ON public.mm3_macro_state FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_update_mm3_macro_state ON public.mm3_macro_state FOR UPDATE TO PUBLIC USING ((id = 1)) WITH CHECK ((id = 1));
CREATE POLICY public_read_mm3_mined_blocks ON public.mm3_mined_blocks FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_mining_blocks ON public.mm3_mining_blocks FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_mining_commands ON public.mm3_mining_commands FOR SELECT TO anon USING (true);
CREATE POLICY public_read_mm3_mining_events ON public.mm3_mining_events FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_mm3_mining_state ON public.mm3_mining_state FOR INSERT TO PUBLIC WITH CHECK ((id = 1));
CREATE POLICY public_read_mm3_mining_state ON public.mm3_mining_state FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_update_mm3_mining_state ON public.mm3_mining_state FOR UPDATE TO PUBLIC USING ((id = 1)) WITH CHECK ((id = 1));
CREATE POLICY public_read_mm3_pool_dispute_votes ON public.mm3_pool_dispute_votes FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_pool_dispute_wallets ON public.mm3_pool_dispute_wallets FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_pool_disputes ON public.mm3_pool_disputes FOR SELECT TO PUBLIC USING (true);
CREATE POLICY pvp_health_read ON public.mm3_pvp_health FOR SELECT TO PUBLIC USING (true);
CREATE POLICY pvp_hits_select ON public.mm3_pvp_hits FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_insert_relay_exec_log ON public.mm3_relay_exec_log FOR INSERT TO PUBLIC WITH CHECK (((wallet_origin <> ''::text) AND (wallet_target <> ''::text)));
CREATE POLICY public_read_relay_exec_log ON public.mm3_relay_exec_log FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_relaying_messages ON public.mm3_relaying_messages FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_sell_transactions ON public.mm3_sell_transactions FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_squeezing_launches ON public.mm3_squeezing_launches FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_squeezing_nftji ON public.mm3_squeezing_nftji FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_wallet_pool_cooldowns ON public.mm3_wallet_pool_cooldowns FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_wallet_pool_invitations ON public.mm3_wallet_pool_invitations FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_wallet_pool_members ON public.mm3_wallet_pool_members FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_wallet_pools ON public.mm3_wallet_pools FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_mm3_wallet_presence ON public.mm3_wallet_presence FOR SELECT TO PUBLIC USING (true);
CREATE POLICY public_read_player_progress ON public.player_progress FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "public read" ON public.security_scans FOR SELECT TO PUBLIC USING (true);

-- ============================================================================
-- Privileges (exact live GRANT photo)
-- ============================================================================

-- Every public function: REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO postgres, service_role;

-- Tables / views
REVOKE ALL ON TABLE public.api_requests FROM PUBLIC;
GRANT ALL ON TABLE public.api_requests TO anon;
GRANT ALL ON TABLE public.api_requests TO authenticated;
GRANT ALL ON TABLE public.api_requests TO service_role;
GRANT ALL ON TABLE public.api_requests TO postgres;

REVOKE ALL ON TABLE public.daily_task_claims FROM PUBLIC;
GRANT ALL ON TABLE public.daily_task_claims TO anon;
GRANT ALL ON TABLE public.daily_task_claims TO authenticated;
GRANT ALL ON TABLE public.daily_task_claims TO service_role;
GRANT ALL ON TABLE public.daily_task_claims TO postgres;

REVOKE ALL ON TABLE public.games FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.games TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.games TO authenticated;
GRANT ALL ON TABLE public.games TO service_role;
GRANT ALL ON TABLE public.games TO postgres;

REVOKE ALL ON TABLE public.leaderboard_data FROM PUBLIC;
GRANT ALL ON TABLE public.leaderboard_data TO anon;
GRANT ALL ON TABLE public.leaderboard_data TO authenticated;
GRANT ALL ON TABLE public.leaderboard_data TO service_role;
GRANT ALL ON TABLE public.leaderboard_data TO postgres;

REVOKE ALL ON TABLE public.math_problems FROM PUBLIC;
GRANT ALL ON TABLE public.math_problems TO anon;
GRANT ALL ON TABLE public.math_problems TO authenticated;
GRANT ALL ON TABLE public.math_problems TO service_role;
GRANT ALL ON TABLE public.math_problems TO postgres;

REVOKE ALL ON TABLE public.mm3_account_creation_log FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_account_creation_log TO service_role;
GRANT ALL ON TABLE public.mm3_account_creation_log TO postgres;

REVOKE ALL ON TABLE public.mm3_chain_reset_log FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_chain_reset_log TO anon;
GRANT ALL ON TABLE public.mm3_chain_reset_log TO authenticated;
GRANT ALL ON TABLE public.mm3_chain_reset_log TO service_role;
GRANT ALL ON TABLE public.mm3_chain_reset_log TO postgres;

REVOKE ALL ON TABLE public.mm3_chain_solve_attempts FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_chain_solve_attempts TO anon;
GRANT ALL ON TABLE public.mm3_chain_solve_attempts TO authenticated;
GRANT ALL ON TABLE public.mm3_chain_solve_attempts TO service_role;
GRANT ALL ON TABLE public.mm3_chain_solve_attempts TO postgres;

REVOKE ALL ON TABLE public.mm3_chain_solvers FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_chain_solvers TO anon;
GRANT ALL ON TABLE public.mm3_chain_solvers TO authenticated;
GRANT ALL ON TABLE public.mm3_chain_solvers TO service_role;
GRANT ALL ON TABLE public.mm3_chain_solvers TO postgres;

REVOKE ALL ON TABLE public.mm3_command_penalties FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_command_penalties TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_command_penalties TO authenticated;
GRANT ALL ON TABLE public.mm3_command_penalties TO service_role;
GRANT ALL ON TABLE public.mm3_command_penalties TO postgres;

REVOKE ALL ON TABLE public.mm3_hidden_cmd_executions FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_hidden_cmd_executions TO anon;
GRANT ALL ON TABLE public.mm3_hidden_cmd_executions TO authenticated;
GRANT ALL ON TABLE public.mm3_hidden_cmd_executions TO service_role;
GRANT ALL ON TABLE public.mm3_hidden_cmd_executions TO postgres;

REVOKE ALL ON TABLE public.mm3_macro_state FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_macro_state TO anon;
GRANT ALL ON TABLE public.mm3_macro_state TO authenticated;
GRANT ALL ON TABLE public.mm3_macro_state TO service_role;
GRANT ALL ON TABLE public.mm3_macro_state TO postgres;

REVOKE ALL ON TABLE public.mm3_map_boss FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_map_boss TO anon;
GRANT ALL ON TABLE public.mm3_map_boss TO authenticated;
GRANT ALL ON TABLE public.mm3_map_boss TO service_role;
GRANT ALL ON TABLE public.mm3_map_boss TO postgres;

REVOKE ALL ON TABLE public.mm3_mined_blocks FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_mined_blocks TO anon;
GRANT ALL ON TABLE public.mm3_mined_blocks TO authenticated;
GRANT ALL ON TABLE public.mm3_mined_blocks TO service_role;
GRANT ALL ON TABLE public.mm3_mined_blocks TO postgres;

REVOKE ALL ON TABLE public.mm3_mining_blocks FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_mining_blocks TO anon;
GRANT ALL ON TABLE public.mm3_mining_blocks TO authenticated;
GRANT ALL ON TABLE public.mm3_mining_blocks TO service_role;
GRANT ALL ON TABLE public.mm3_mining_blocks TO postgres;

REVOKE ALL ON TABLE public.mm3_mining_commands FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_mining_commands TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_mining_commands TO authenticated;
GRANT ALL ON TABLE public.mm3_mining_commands TO service_role;
GRANT ALL ON TABLE public.mm3_mining_commands TO postgres;

REVOKE ALL ON TABLE public.mm3_mining_events FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_mining_events TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_mining_events TO authenticated;
GRANT ALL ON TABLE public.mm3_mining_events TO service_role;
GRANT ALL ON TABLE public.mm3_mining_events TO postgres;

REVOKE ALL ON TABLE public.mm3_mining_state FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_mining_state TO anon;
GRANT ALL ON TABLE public.mm3_mining_state TO authenticated;
GRANT ALL ON TABLE public.mm3_mining_state TO service_role;
GRANT ALL ON TABLE public.mm3_mining_state TO postgres;

REVOKE ALL ON TABLE public.mm3_pool_dispute_votes FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_pool_dispute_votes TO anon;
GRANT ALL ON TABLE public.mm3_pool_dispute_votes TO authenticated;
GRANT ALL ON TABLE public.mm3_pool_dispute_votes TO service_role;
GRANT ALL ON TABLE public.mm3_pool_dispute_votes TO postgres;

REVOKE ALL ON TABLE public.mm3_pool_dispute_wallets FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_pool_dispute_wallets TO anon;
GRANT ALL ON TABLE public.mm3_pool_dispute_wallets TO authenticated;
GRANT ALL ON TABLE public.mm3_pool_dispute_wallets TO service_role;
GRANT ALL ON TABLE public.mm3_pool_dispute_wallets TO postgres;

REVOKE ALL ON TABLE public.mm3_pool_disputes FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_pool_disputes TO anon;
GRANT ALL ON TABLE public.mm3_pool_disputes TO authenticated;
GRANT ALL ON TABLE public.mm3_pool_disputes TO service_role;
GRANT ALL ON TABLE public.mm3_pool_disputes TO postgres;

REVOKE ALL ON TABLE public.mm3_pvp_health FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_pvp_health TO anon;
GRANT ALL ON TABLE public.mm3_pvp_health TO authenticated;
GRANT ALL ON TABLE public.mm3_pvp_health TO service_role;
GRANT ALL ON TABLE public.mm3_pvp_health TO postgres;

REVOKE ALL ON TABLE public.mm3_pvp_hits FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_pvp_hits TO anon;
GRANT ALL ON TABLE public.mm3_pvp_hits TO authenticated;
GRANT ALL ON TABLE public.mm3_pvp_hits TO service_role;
GRANT ALL ON TABLE public.mm3_pvp_hits TO postgres;

REVOKE ALL ON TABLE public.mm3_relay_exec_log FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_relay_exec_log TO anon;
GRANT ALL ON TABLE public.mm3_relay_exec_log TO authenticated;
GRANT ALL ON TABLE public.mm3_relay_exec_log TO service_role;
GRANT ALL ON TABLE public.mm3_relay_exec_log TO postgres;

REVOKE ALL ON TABLE public.mm3_relaying_messages FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_relaying_messages TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_relaying_messages TO authenticated;
GRANT ALL ON TABLE public.mm3_relaying_messages TO service_role;
GRANT ALL ON TABLE public.mm3_relaying_messages TO postgres;

REVOKE ALL ON TABLE public.mm3_sell_transactions FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_sell_transactions TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_sell_transactions TO authenticated;
GRANT ALL ON TABLE public.mm3_sell_transactions TO service_role;
GRANT ALL ON TABLE public.mm3_sell_transactions TO postgres;

REVOKE ALL ON TABLE public.mm3_squeezing_launches FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_squeezing_launches TO anon;
GRANT ALL ON TABLE public.mm3_squeezing_launches TO authenticated;
GRANT ALL ON TABLE public.mm3_squeezing_launches TO service_role;
GRANT ALL ON TABLE public.mm3_squeezing_launches TO postgres;

REVOKE ALL ON TABLE public.mm3_squeezing_nftji FROM PUBLIC;
GRANT ALL ON TABLE public.mm3_squeezing_nftji TO anon;
GRANT ALL ON TABLE public.mm3_squeezing_nftji TO authenticated;
GRANT ALL ON TABLE public.mm3_squeezing_nftji TO service_role;
GRANT ALL ON TABLE public.mm3_squeezing_nftji TO postgres;

REVOKE ALL ON TABLE public.mm3_wallet_pool_cooldowns FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_cooldowns TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_cooldowns TO authenticated;
GRANT ALL ON TABLE public.mm3_wallet_pool_cooldowns TO service_role;
GRANT ALL ON TABLE public.mm3_wallet_pool_cooldowns TO postgres;

REVOKE ALL ON TABLE public.mm3_wallet_pool_invitations FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_invitations TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_invitations TO authenticated;
GRANT ALL ON TABLE public.mm3_wallet_pool_invitations TO service_role;
GRANT ALL ON TABLE public.mm3_wallet_pool_invitations TO postgres;

REVOKE ALL ON TABLE public.mm3_wallet_pool_members FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_members TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pool_members TO authenticated;
GRANT ALL ON TABLE public.mm3_wallet_pool_members TO service_role;
GRANT ALL ON TABLE public.mm3_wallet_pool_members TO postgres;

REVOKE ALL ON TABLE public.mm3_wallet_pools FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pools TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_pools TO authenticated;
GRANT ALL ON TABLE public.mm3_wallet_pools TO service_role;
GRANT ALL ON TABLE public.mm3_wallet_pools TO postgres;

REVOKE ALL ON TABLE public.mm3_wallet_presence FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_presence TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.mm3_wallet_presence TO authenticated;
GRANT ALL ON TABLE public.mm3_wallet_presence TO service_role;
GRANT ALL ON TABLE public.mm3_wallet_presence TO postgres;

REVOKE ALL ON TABLE public.player_progress FROM PUBLIC;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.player_progress TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON TABLE public.player_progress TO authenticated;
GRANT ALL ON TABLE public.player_progress TO service_role;
GRANT ALL ON TABLE public.player_progress TO postgres;

REVOKE ALL ON TABLE public.security_scans FROM PUBLIC;
GRANT ALL ON TABLE public.security_scans TO anon;
GRANT ALL ON TABLE public.security_scans TO authenticated;
GRANT ALL ON TABLE public.security_scans TO service_role;
GRANT ALL ON TABLE public.security_scans TO postgres;

REVOKE ALL ON TABLE public.token_value FROM PUBLIC;
GRANT ALL ON TABLE public.token_value TO anon;
GRANT ALL ON TABLE public.token_value TO authenticated;
GRANT ALL ON TABLE public.token_value TO service_role;
GRANT ALL ON TABLE public.token_value TO postgres;

REVOKE ALL ON TABLE public.token_value_timeseries FROM PUBLIC;
GRANT ALL ON TABLE public.token_value_timeseries TO anon;
GRANT ALL ON TABLE public.token_value_timeseries TO authenticated;
GRANT ALL ON TABLE public.token_value_timeseries TO service_role;
GRANT ALL ON TABLE public.token_value_timeseries TO postgres;

REVOKE ALL ON TABLE public.top_positive_miner FROM PUBLIC;
GRANT ALL ON TABLE public.top_positive_miner TO anon;
GRANT ALL ON TABLE public.top_positive_miner TO authenticated;
GRANT ALL ON TABLE public.top_positive_miner TO service_role;
GRANT ALL ON TABLE public.top_positive_miner TO postgres;

-- Sequences
REVOKE ALL ON SEQUENCE public.games_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.games_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.math_problems_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.math_problems_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_chain_reset_log_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_chain_reset_log_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_chain_solve_attempts_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_chain_solve_attempts_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_command_penalties_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_command_penalties_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_hidden_cmd_executions_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_hidden_cmd_executions_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_mined_blocks_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_mined_blocks_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_mining_blocks_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_mining_blocks_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_mining_commands_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_mining_commands_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_mining_events_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_mining_events_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_pool_dispute_votes_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_pool_dispute_votes_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_pool_dispute_wallets_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_pool_dispute_wallets_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_pool_disputes_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_pool_disputes_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_relay_exec_log_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_relay_exec_log_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_relaying_messages_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_relaying_messages_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_sell_transactions_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_sell_transactions_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_squeezing_launches_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_squeezing_launches_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_wallet_pool_invitations_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_wallet_pool_invitations_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.security_scans_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.security_scans_id_seq TO anon, authenticated, postgres, service_role;

REVOKE ALL ON SEQUENCE public.mm3_chain_solvers_id_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.mm3_chain_solvers_id_seq TO anon, authenticated, postgres, service_role;

SET row_security = on;
-- snapshot end
