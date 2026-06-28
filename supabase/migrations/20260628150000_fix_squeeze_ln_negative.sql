-- Fix: mm3_dispute_start_battle crashed with "cannot take logarithm of a negative number"
-- when a pool member had negative mm3_snap (sold more MM3 than mined).
-- Guard both LN() calls with GREATEST so the argument is always > 0.

CREATE OR REPLACE FUNCTION public.mm3_dispute_start_battle(p_dispute_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SELECT
    COUNT(*)                          AS wallet_count,
    COALESCE(SUM(level_snap), 0)     AS level_sum,
    COALESCE(SUM(mm3_snap), 0)       AS mm3_sum,
    COALESCE(SUM(eur_snap), 0)       AS eur_sum,
    COALESCE(SUM(nftji_snap), 0)     AS nftji_count,
    COALESCE(SUM(mining_nftji_level_snap + 1) FILTER (WHERE mining_nftji_snap IS NOT NULL), 0) AS mining_nftji_count,
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
    COALESCE(SUM(mining_nftji_level_snap + 1) FILTER (WHERE mining_nftji_snap IS NOT NULL), 0) AS mining_nftji_count,
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
  -- GREATEST(1e-9, ...) prevents LN crash when mm3_snap is negative (sold > mined)
  IF v_ch.wallet_count > 0 THEN
    v_ch_base :=
      (v_ch.level_sum::numeric / v_ch.wallet_count) * 40
      + LN(GREATEST(1e-9, v_ch.mm3_sum / v_ch.wallet_count + 1)) * 20
      + (v_ch.exec_count::numeric / v_ch.wallet_count) * 12
      + (v_ch.nftji_count::numeric / v_ch.wallet_count) * 8
      + (v_ch.mining_nftji_count::numeric / v_ch.wallet_count) * 15
      + (v_ch.squeeze_atk_sum::numeric / v_ch.wallet_count) * 20
      - (v_ch.penalty_count::numeric / v_ch.wallet_count) * 20;
  ELSE
    v_ch_base := 0;
  END IF;

  IF v_df.wallet_count > 0 THEN
    v_df_base :=
      (v_df.level_sum::numeric / v_df.wallet_count) * 40
      + LN(GREATEST(1e-9, v_df.mm3_sum / v_df.wallet_count + 1)) * 20
      + (v_df.exec_count::numeric / v_df.wallet_count) * 12
      + (v_df.nftji_count::numeric / v_df.wallet_count) * 8
      + (v_df.mining_nftji_count::numeric / v_df.wallet_count) * 15
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
    ch_mining_nftji_count = v_ch.mining_nftji_count,
    ch_penalty_count     = v_ch.penalty_count,
    ch_exec_count        = v_ch.exec_count,
    ch_score             = ROUND(v_ch_score, 4),
    ch_squeeze_atk_sum   = v_ch.squeeze_atk_sum,
    df_wallet_count      = v_df.wallet_count,
    df_level_sum         = v_df.level_sum,
    df_mm3_sum           = v_df.mm3_sum,
    df_eur_sum           = v_df.eur_sum,
    df_nftji_count       = v_df.nftji_count,
    df_mining_nftji_count = v_df.mining_nftji_count,
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
