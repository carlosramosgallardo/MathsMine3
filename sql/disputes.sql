-- ==============================================
-- POOL DISPUTE SYSTEM
-- ==============================================

-- DROP (safe re-run)
DROP TABLE IF EXISTS mm3_pool_dispute_wallets CASCADE;
DROP TABLE IF EXISTS mm3_pool_dispute_votes   CASCADE;
DROP TABLE IF EXISTS mm3_pool_disputes        CASCADE;

DROP FUNCTION IF EXISTS mm3_dispute_vote(text, text, text);
DROP FUNCTION IF EXISTS mm3_dispute_join(bigint, text);
DROP FUNCTION IF EXISTS mm3_dispute_start_battle(bigint);
DROP FUNCTION IF EXISTS mm3_dispute_resolve(bigint);
DROP FUNCTION IF EXISTS mm3_dispute_can_leave(text);
DROP FUNCTION IF EXISTS mm3_pool_max_wallets(integer);

-- ==============================================
-- TABLES
-- ==============================================

CREATE TABLE mm3_pool_disputes (
  id                    BIGSERIAL PRIMARY KEY,
  challenger_pool_code  TEXT NOT NULL,
  defender_pool_code    TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'registering'
                          CHECK (status IN ('registering', 'battle_start', 'resolved')),
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  battle_start_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  -- world state snapshot (set at battle_start)
  war_percent           NUMERIC,
  nature_percent        NUMERIC,
  dice_modifier         NUMERIC,
  -- challenger aggregates
  ch_wallet_count       INT NOT NULL DEFAULT 0,
  ch_level_sum          NUMERIC NOT NULL DEFAULT 0,
  ch_mm3_sum            NUMERIC NOT NULL DEFAULT 0,
  ch_eur_sum            NUMERIC NOT NULL DEFAULT 0,
  ch_nftji_count        INT NOT NULL DEFAULT 0,
  ch_market_nftji_count INT NOT NULL DEFAULT 0,
  ch_penalty_count      INT NOT NULL DEFAULT 0,
  ch_exec_count         INT NOT NULL DEFAULT 0,
  ch_score              NUMERIC,
  -- defender aggregates
  df_wallet_count       INT NOT NULL DEFAULT 0,
  df_level_sum          NUMERIC NOT NULL DEFAULT 0,
  df_mm3_sum            NUMERIC NOT NULL DEFAULT 0,
  df_eur_sum            NUMERIC NOT NULL DEFAULT 0,
  df_nftji_count        INT NOT NULL DEFAULT 0,
  df_market_nftji_count INT NOT NULL DEFAULT 0,
  df_penalty_count      INT NOT NULL DEFAULT 0,
  df_exec_count         INT NOT NULL DEFAULT 0,
  df_score              NUMERIC,
  -- resolution
  winner                TEXT CHECK (winner IN ('challenger', 'defender', 'draw')),
  result_summary        JSONB
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
  -- stat snapshots
  level_snap      INT     NOT NULL DEFAULT 0,
  mm3_snap        NUMERIC NOT NULL DEFAULT 0,
  eur_snap        NUMERIC NOT NULL DEFAULT 0,
  usd_snap        NUMERIC NOT NULL DEFAULT 0,
  cny_snap        NUMERIC NOT NULL DEFAULT 0,
  exec_snap       INT     NOT NULL DEFAULT 0,
  nftji_snap      INT     NOT NULL DEFAULT 0,
  market_nftji_snap TEXT,
  has_penalty     BOOLEAN NOT NULL DEFAULT FALSE,
  -- stakes & resolution deltas
  eur_stake       NUMERIC NOT NULL DEFAULT 0,
  mm3_stake       NUMERIC NOT NULL DEFAULT 0,
  delta_eur       NUMERIC NOT NULL DEFAULT 0,
  delta_mm3       NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (dispute_id, wallet)
);

CREATE INDEX idx_mm3_pool_disputes_status         ON mm3_pool_disputes(status);
CREATE INDEX idx_mm3_pool_disputes_pools          ON mm3_pool_disputes(challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_dispute_votes_pairing   ON mm3_pool_dispute_votes(challenger_pool_code, defender_pool_code);
CREATE INDEX idx_mm3_pool_dispute_wallets_dispute ON mm3_pool_dispute_wallets(dispute_id, side);
CREATE INDEX idx_mm3_pool_dispute_wallets_wallet  ON mm3_pool_dispute_wallets(wallet);

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
-- FUNCTION: cast dispute vote
-- ==============================================
-- Returns: {dispute_id, created, vote_count, error}

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
  v_in_pool         BOOLEAN;
  v_already_voted   BOOLEAN;
  v_active_dispute  BIGINT;
  v_dispute_id      BIGINT;
  v_vote_count      INT;
  v_defender_members TEXT[];
  v_challenger_members TEXT[];
  v_member          TEXT;
  v_pp              RECORD;
  v_exec_count      INT;
  v_nftji_count     INT;
  v_has_penalty     BOOLEAN;
BEGIN
  -- Validate pools differ
  IF p_challenger_pool = p_defender_pool THEN
    RETURN jsonb_build_object('error', 'same_pool');
  END IF;

  -- Validate wallet is in challenger pool
  SELECT EXISTS(
    SELECT 1 FROM mm3_wallet_pool_members
    WHERE wallet = p_wallet AND pool_code = p_challenger_pool
  ) INTO v_in_pool;

  IF NOT v_in_pool THEN
    RETURN jsonb_build_object('error', 'not_in_challenger_pool');
  END IF;

  -- Check already voted for this pairing
  SELECT EXISTS(
    SELECT 1 FROM mm3_pool_dispute_votes
    WHERE challenger_pool_code = p_challenger_pool
      AND defender_pool_code = p_defender_pool
      AND wallet = p_wallet
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  -- Check no active dispute between same pools
  SELECT id INTO v_active_dispute
  FROM mm3_pool_disputes
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND status IN ('registering', 'battle_start')
  LIMIT 1;

  IF v_active_dispute IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'dispute_already_active', 'dispute_id', v_active_dispute);
  END IF;

  -- Insert vote
  INSERT INTO mm3_pool_dispute_votes(challenger_pool_code, defender_pool_code, wallet)
  VALUES (p_challenger_pool, p_defender_pool, p_wallet);

  -- Count votes for this pairing (pending, no dispute yet)
  SELECT COUNT(*) INTO v_vote_count
  FROM mm3_pool_dispute_votes
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND dispute_id IS NULL;

  -- Need at least 2 votes to open dispute
  IF v_vote_count < 2 THEN
    RETURN jsonb_build_object('created', false, 'vote_count', v_vote_count);
  END IF;

  -- Create dispute
  INSERT INTO mm3_pool_disputes(challenger_pool_code, defender_pool_code)
  VALUES (p_challenger_pool, p_defender_pool)
  RETURNING id INTO v_dispute_id;

  -- Link votes to this dispute
  UPDATE mm3_pool_dispute_votes
  SET dispute_id = v_dispute_id
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND dispute_id IS NULL;

  -- Enroll all challenger pool members
  SELECT ARRAY_AGG(wallet) INTO v_challenger_members
  FROM mm3_wallet_pool_members
  WHERE pool_code = p_challenger_pool;

  IF v_challenger_members IS NOT NULL THEN
    FOREACH v_member IN ARRAY v_challenger_members LOOP
      SELECT pp.level, pp.mm3_sold, pp.eur_earned, pp.usd_earned, pp.cny_earned,
             COALESCE(array_length(pp.wallet_emojis, 1), 0),
             pp.market_nftji_key
      INTO v_pp
      FROM player_progress pp
      WHERE pp.wallet = v_member;

      SELECT COUNT(*) INTO v_exec_count
      FROM mm3_hidden_cmd_executions
      WHERE wallet = v_member;

      v_nftji_count := COALESCE((SELECT array_length(wallet_emojis, 1) FROM player_progress WHERE wallet = v_member), 0);

      SELECT EXISTS(
        SELECT 1 FROM mm3_command_penalties
        WHERE wallet = v_member AND redeemed_at IS NULL
      ) INTO v_has_penalty;

      INSERT INTO mm3_pool_dispute_wallets(
        dispute_id, wallet, pool_code, side,
        level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
        exec_snap, nftji_snap, market_nftji_snap, has_penalty,
        eur_stake, mm3_stake
      )
      SELECT
        v_dispute_id, v_member, p_challenger_pool, 'challenger',
        COALESCE(pp.level, 0),
        COALESCE(pp.mm3_sold, 0),
        COALESCE(pp.eur_earned, 0),
        COALESCE(pp.usd_earned, 0),
        COALESCE(pp.cny_earned, 0),
        v_exec_count,
        COALESCE(array_length(pp.wallet_emojis, 1), 0),
        pp.market_nftji_key,
        v_has_penalty,
        ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
        ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4)
      FROM player_progress pp
      WHERE pp.wallet = v_member
      ON CONFLICT (dispute_id, wallet) DO NOTHING;
    END LOOP;
  END IF;

  -- Enroll ALL defender pool members (100% auto-enrolled)
  SELECT ARRAY_AGG(wallet) INTO v_defender_members
  FROM mm3_wallet_pool_members
  WHERE pool_code = p_defender_pool;

  IF v_defender_members IS NOT NULL THEN
    FOREACH v_member IN ARRAY v_defender_members LOOP
      SELECT COUNT(*) INTO v_exec_count
      FROM mm3_hidden_cmd_executions
      WHERE wallet = v_member;

      SELECT EXISTS(
        SELECT 1 FROM mm3_command_penalties
        WHERE wallet = v_member AND redeemed_at IS NULL
      ) INTO v_has_penalty;

      INSERT INTO mm3_pool_dispute_wallets(
        dispute_id, wallet, pool_code, side,
        level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
        exec_snap, nftji_snap, market_nftji_snap, has_penalty,
        eur_stake, mm3_stake
      )
      SELECT
        v_dispute_id, v_member, p_defender_pool, 'defender',
        COALESCE(pp.level, 0),
        COALESCE(pp.mm3_sold, 0),
        COALESCE(pp.eur_earned, 0),
        COALESCE(pp.usd_earned, 0),
        COALESCE(pp.cny_earned, 0),
        v_exec_count,
        COALESCE(array_length(pp.wallet_emojis, 1), 0),
        pp.market_nftji_key,
        v_has_penalty,
        ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
        ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4)
      FROM player_progress pp
      WHERE pp.wallet = v_member
      ON CONFLICT (dispute_id, wallet) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('created', true, 'dispute_id', v_dispute_id, 'vote_count', v_vote_count);
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
    exec_snap, nftji_snap, market_nftji_snap, has_penalty,
    eur_stake, mm3_stake
  )
  SELECT
    p_dispute_id, p_wallet, v_dispute.challenger_pool_code, 'challenger',
    COALESCE(pp.level, 0),
    COALESCE(pp.mm3_sold, 0),
    COALESCE(pp.eur_earned, 0),
    COALESCE(pp.usd_earned, 0),
    COALESCE(pp.cny_earned, 0),
    v_exec_count,
    COALESCE(array_length(pp.wallet_emojis, 1), 0),
    pp.market_nftji_key,
    v_has_penalty,
    ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
    ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4)
  FROM player_progress pp
  WHERE pp.wallet = p_wallet
  ON CONFLICT (dispute_id, wallet) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ==============================================
-- FUNCTION: start battle (called after 5 min)
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

  -- Challenger aggregates (all registered wallets)
  SELECT
    COUNT(*)                          AS wallet_count,
    COALESCE(SUM(level_snap), 0)     AS level_sum,
    COALESCE(SUM(mm3_snap), 0)       AS mm3_sum,
    COALESCE(SUM(eur_snap), 0)       AS eur_sum,
    COALESCE(SUM(nftji_snap), 0)     AS nftji_count,
    COUNT(*) FILTER (WHERE market_nftji_snap IS NOT NULL) AS market_nftji_count,
    COUNT(*) FILTER (WHERE has_penalty)  AS penalty_count,
    COALESCE(SUM(exec_snap), 0)      AS exec_count
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
    COUNT(*) FILTER (WHERE market_nftji_snap IS NOT NULL) AS market_nftji_count,
    COUNT(*) FILTER (WHERE has_penalty)  AS penalty_count,
    COALESCE(SUM(exec_snap), 0)      AS exec_count
  INTO v_df
  FROM mm3_pool_dispute_wallets
  WHERE dispute_id = p_dispute_id AND side = 'defender';

  -- Base scores (per-wallet averages to normalize pool size differences)
  -- Formula:
  --   base = (level_sum/n)*40 + LN(mm3/n+1)*20 + (execs/n)*12 + (nftjis/n)*8
  --          + (market_nftjis/n)*15 - (penalties/n)*20
  -- War favors challenger (+30%), nature favors defender (+20%), dice adds variance (±30%)
  IF v_ch.wallet_count > 0 THEN
    v_ch_base :=
      (v_ch.level_sum::numeric / v_ch.wallet_count) * 40
      + LN(v_ch.mm3_sum / v_ch.wallet_count + 1) * 20
      + (v_ch.exec_count::numeric / v_ch.wallet_count) * 12
      + (v_ch.nftji_count::numeric / v_ch.wallet_count) * 8
      + (v_ch.market_nftji_count::numeric / v_ch.wallet_count) * 15
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
      - (v_df.penalty_count::numeric / v_df.wallet_count) * 20;
  ELSE
    v_df_base := 0;
  END IF;

  -- Apply world modifiers
  -- war: high war → challenger boost (+30% at 100%), low war → defender boost
  -- nature: high nature → defender boost (+20% at 100%), low nature → challenger boost
  -- dice: challenger gets +dice*30%, defender gets -dice*30%
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
    status          = 'battle_start',
    battle_start_at = NOW(),
    war_percent     = v_war,
    nature_percent  = v_nature,
    dice_modifier   = ROUND(v_dice, 4),
    ch_wallet_count = v_ch.wallet_count,
    ch_level_sum    = v_ch.level_sum,
    ch_mm3_sum      = v_ch.mm3_sum,
    ch_eur_sum      = v_ch.eur_sum,
    ch_nftji_count  = v_ch.nftji_count,
    ch_market_nftji_count = v_ch.market_nftji_count,
    ch_penalty_count = v_ch.penalty_count,
    ch_exec_count   = v_ch.exec_count,
    ch_score        = ROUND(v_ch_score, 4),
    df_wallet_count = v_df.wallet_count,
    df_level_sum    = v_df.level_sum,
    df_mm3_sum      = v_df.mm3_sum,
    df_eur_sum      = v_df.eur_sum,
    df_nftji_count  = v_df.nftji_count,
    df_market_nftji_count = v_df.market_nftji_count,
    df_penalty_count = v_df.penalty_count,
    df_exec_count   = v_df.exec_count,
    df_score        = ROUND(v_df_score, 4)
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
-- FUNCTION: resolve dispute (called 5s after battle_start)
-- ==============================================

CREATE OR REPLACE FUNCTION public.mm3_dispute_resolve(p_dispute_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute         RECORD;
  v_winner          TEXT;
  v_loser_side      TEXT;
  v_winner_side     TEXT;
  v_loser_eur_total NUMERIC;
  v_loser_mm3_total NUMERIC;
  v_winner_n        INT;
  v_transfer_eur    NUMERIC;
  v_transfer_mm3    NUMERIC;
  v_per_eur         NUMERIC;
  v_per_mm3         NUMERIC;
  v_summary         JSONB;
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
    -- 55% of loser stakes transferred to winner pool
    SELECT
      COALESCE(SUM(eur_stake), 0) * 0.55,
      COALESCE(SUM(mm3_stake), 0) * 0.55
    INTO v_transfer_eur, v_transfer_mm3
    FROM mm3_pool_dispute_wallets
    WHERE dispute_id = p_dispute_id AND side = v_loser_side;

    -- Loser wallets lose 100% of their stake
    UPDATE mm3_pool_dispute_wallets SET
      delta_eur = -eur_stake,
      delta_mm3 = -mm3_stake
    WHERE dispute_id = p_dispute_id AND side = v_loser_side;

    -- Winner wallets gain proportional share of transferred stakes
    SELECT COUNT(*) INTO v_winner_n
    FROM mm3_pool_dispute_wallets
    WHERE dispute_id = p_dispute_id AND side = v_winner_side;

    IF v_winner_n > 0 THEN
      v_per_eur := ROUND(v_transfer_eur / v_winner_n, 6);
      v_per_mm3 := ROUND(v_transfer_mm3 / v_winner_n, 6);

      UPDATE mm3_pool_dispute_wallets SET
        delta_eur = v_per_eur,
        delta_mm3 = v_per_mm3
      WHERE dispute_id = p_dispute_id AND side = v_winner_side;
    END IF;

    -- Apply deltas to player_progress
    UPDATE player_progress pp SET
      eur_earned = GREATEST(0, pp.eur_earned + dw.delta_eur),
      mm3_sold   = GREATEST(0, pp.mm3_sold   + dw.delta_mm3),
      updated_at = NOW()
    FROM mm3_pool_dispute_wallets dw
    WHERE dw.dispute_id = p_dispute_id
      AND dw.wallet = pp.wallet
      AND (dw.delta_eur <> 0 OR dw.delta_mm3 <> 0);
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
    'transfer_mm3',    COALESCE(v_transfer_mm3, 0)
  );

  -- Finalize dispute
  UPDATE mm3_pool_disputes SET
    status       = 'resolved',
    resolved_at  = NOW(),
    winner       = v_winner,
    result_summary = v_summary
  WHERE id = p_dispute_id;

  RETURN v_summary;
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
      AND d.status IN ('registering', 'battle_start')
  );
$$;

-- ==============================================
-- RLS
-- ==============================================

ALTER TABLE mm3_pool_disputes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_pool_dispute_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mm3_pool_dispute_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_mm3_pool_disputes"        ON mm3_pool_disputes;
DROP POLICY IF EXISTS "public_read_mm3_pool_dispute_votes"   ON mm3_pool_dispute_votes;
DROP POLICY IF EXISTS "public_read_mm3_pool_dispute_wallets" ON mm3_pool_dispute_wallets;

CREATE POLICY "public_read_mm3_pool_disputes"
  ON mm3_pool_disputes FOR SELECT TO public USING (true);

CREATE POLICY "public_read_mm3_pool_dispute_votes"
  ON mm3_pool_dispute_votes FOR SELECT TO public USING (true);

CREATE POLICY "public_read_mm3_pool_dispute_wallets"
  ON mm3_pool_dispute_wallets FOR SELECT TO public USING (true);

-- ==============================================
-- GRANTS
-- ==============================================

GRANT SELECT ON mm3_pool_disputes        TO anon;
GRANT SELECT ON mm3_pool_dispute_votes   TO anon;
GRANT SELECT ON mm3_pool_dispute_wallets TO anon;
GRANT USAGE  ON SEQUENCE mm3_pool_disputes_id_seq        TO anon;
GRANT USAGE  ON SEQUENCE mm3_pool_dispute_votes_id_seq   TO anon;
GRANT USAGE  ON SEQUENCE mm3_pool_dispute_wallets_id_seq TO anon;

GRANT EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text)  TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text)      TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint)    TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint)         TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text)         TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer)       TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer)       TO authenticated;
