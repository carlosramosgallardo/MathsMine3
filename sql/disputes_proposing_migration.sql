-- ==============================================
-- MIGRATION: add 'proposing' + 'cancelled' states
-- Run once on existing deployments that already have disputes tables
-- ==============================================

-- 1. Extend status constraint
ALTER TABLE mm3_pool_disputes
  DROP CONSTRAINT IF EXISTS mm3_pool_disputes_status_check;

ALTER TABLE mm3_pool_disputes
  ADD CONSTRAINT mm3_pool_disputes_status_check
  CHECK (status IN ('proposing', 'registering', 'battle_start', 'resolved', 'cancelled'));

-- 2. New column for cancellation timestamp
ALTER TABLE mm3_pool_disputes
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 3. Change default so new disputes start in proposing state
ALTER TABLE mm3_pool_disputes
  ALTER COLUMN status SET DEFAULT 'proposing';

-- 4. Drop functions that need updating
DROP FUNCTION IF EXISTS mm3_dispute_vote(text, text, text);
DROP FUNCTION IF EXISTS mm3_dispute_can_leave(text);
DROP FUNCTION IF EXISTS mm3_dispute_cancel(bigint);

-- ==============================================
-- UPDATED FUNCTION: mm3_dispute_vote
-- 1st proposal  → creates 'proposing' dispute
-- 2nd vote      → transitions 'proposing' → 'registering' + enrolls members
-- ==============================================

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
    SELECT 1 FROM mm3_pool_dispute_votes
    WHERE challenger_pool_code = p_challenger_pool
      AND defender_pool_code = p_defender_pool
      AND wallet = p_wallet
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  -- Block if an active (registering / battle_start) dispute already exists
  SELECT id INTO v_active_dispute
  FROM mm3_pool_disputes
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND status IN ('registering', 'battle_start')
  LIMIT 1;

  IF v_active_dispute IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'dispute_already_active', 'dispute_id', v_active_dispute);
  END IF;

  -- Check whether a proposing dispute already exists (2nd vote scenario)
  SELECT id INTO v_proposing_dispute
  FROM mm3_pool_disputes
  WHERE challenger_pool_code = p_challenger_pool
    AND defender_pool_code = p_defender_pool
    AND status = 'proposing'
  LIMIT 1;

  -- Record this vote
  INSERT INTO mm3_pool_dispute_votes(challenger_pool_code, defender_pool_code, wallet)
  VALUES (p_challenger_pool, p_defender_pool, p_wallet);

  -- ── 2nd vote: transition proposing → registering ──────────────────────────
  IF v_proposing_dispute IS NOT NULL THEN
    v_dispute_id := v_proposing_dispute;

    -- Link all pending votes to this dispute
    UPDATE mm3_pool_dispute_votes
    SET dispute_id = v_dispute_id
    WHERE challenger_pool_code = p_challenger_pool
      AND defender_pool_code = p_defender_pool
      AND dispute_id IS NULL;

    SELECT COUNT(*) INTO v_vote_count
    FROM mm3_pool_dispute_votes
    WHERE dispute_id = v_dispute_id;

    -- Transition; reset registered_at so the 5-min join window starts now
    UPDATE mm3_pool_disputes
    SET status = 'registering', registered_at = NOW()
    WHERE id = v_dispute_id;

    -- Enroll challenger voters as dispute wallets
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

    -- Auto-enroll all defender pool members
    SELECT ARRAY_AGG(wallet) INTO v_defender_members
    FROM mm3_wallet_pool_members
    WHERE pool_code = p_defender_pool;

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

  -- ── 1st proposal: create proposing dispute ────────────────────────────────
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
-- NEW FUNCTION: cancel proposing dispute after timeout
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

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ==============================================
-- UPDATED FUNCTION: mm3_dispute_can_leave
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
-- GRANTS
-- ==============================================

GRANT EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text)  TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint)          TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text)         TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text)         TO authenticated;
