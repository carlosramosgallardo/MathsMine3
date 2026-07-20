

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apply_mm3_boss_attack_player"("p_wallet" "text", "p_damage" integer DEFAULT 20, "p_boss_gx" numeric DEFAULT NULL::numeric, "p_boss_gy" numeric DEFAULT NULL::numeric, "p_player_gx" numeric DEFAULT NULL::numeric, "p_player_gy" numeric DEFAULT NULL::numeric, "p_boss_id" "text" DEFAULT 'm5_trump'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_boss mm3_map_boss%ROWTYPE;
  v_health INTEGER;
  v_killed BOOLEAN := FALSE;
  v_wallet TEXT := LOWER(TRIM(p_wallet));
  v_damage INTEGER := LEAST(100, GREATEST(1, COALESCE(p_damage, 20)));
  v_spawn_gx NUMERIC;
  v_spawn_gy NUMERIC;
  v_max_wander NUMERIC := 28;
  v_attack_range NUMERIC := 5.35;
  v_dead_until TIMESTAMPTZ;
BEGIN
  IF v_wallet = '' OR v_wallet LIKE 'anon-%' THEN
    RAISE EXCEPTION 'wallet_required';
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = p_boss_id;
  IF NOT FOUND OR v_boss.state <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'boss_not_active');
  END IF;

  v_spawn_gx := CASE p_boss_id
    WHEN 'm3_putin' THEN 27.0
    WHEN 'm4_kim' THEN 28.0
    ELSE 28.0
  END;
  v_spawn_gy := CASE p_boss_id
    WHEN 'm3_putin' THEN 35.0
    WHEN 'm4_kim' THEN 28.0
    ELSE 28.0
  END;

  IF p_boss_gx IS NOT NULL AND p_boss_gy IS NOT NULL THEN
    IF sqrt(power(p_boss_gx - v_spawn_gx, 2) + power(p_boss_gy - v_spawn_gy, 2)) > v_max_wander THEN
      RETURN jsonb_build_object('ok', false, 'error', 'boss_position_invalid');
    END IF;
    IF p_player_gx IS NOT NULL AND p_player_gy IS NOT NULL THEN
      IF sqrt(power(p_player_gx - p_boss_gx, 2) + power(p_player_gy - p_boss_gy, 2)) > v_attack_range THEN
        RETURN jsonb_build_object('ok', false, 'error', 'out_of_range');
      END IF;
    END IF;
  END IF;

  INSERT INTO mm3_pvp_health(wallet, health) VALUES (v_wallet, 100)
  ON CONFLICT (wallet) DO NOTHING;

  SELECT health, pvp_dead_until INTO v_health, v_dead_until
  FROM mm3_pvp_health WHERE wallet = v_wallet FOR UPDATE;

  IF v_dead_until IS NOT NULL AND v_dead_until > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'victim_is_dead');
  END IF;

  IF v_health IS NULL THEN v_health := 100; END IF;

  v_health := GREATEST(0, v_health - v_damage);
  v_killed := v_health = 0;

  UPDATE mm3_pvp_health SET
    health = CASE WHEN v_killed THEN 100 ELSE v_health END,
    deaths = deaths + CASE WHEN v_killed THEN 1 ELSE 0 END,
    pvp_dead_until = CASE WHEN v_killed THEN NOW() + INTERVAL '5 minutes' ELSE pvp_dead_until END,
    pvp_dead_gx = CASE WHEN v_killed THEN COALESCE(p_player_gx, pvp_dead_gx) ELSE pvp_dead_gx END,
    pvp_dead_gy = CASE WHEN v_killed THEN COALESCE(p_player_gy, pvp_dead_gy) ELSE pvp_dead_gy END,
    updated_at = NOW()
  WHERE wallet = v_wallet;

  RETURN jsonb_build_object(
    'ok', true,
    'health', CASE WHEN v_killed THEN 0 ELSE v_health END,
    'respawn_health', CASE WHEN v_killed THEN 100 ELSE v_health END,
    'killed', v_killed,
    'damage', v_damage
  );
END;
$$;


ALTER FUNCTION "public"."apply_mm3_boss_attack_player"("p_wallet" "text", "p_damage" integer, "p_boss_gx" numeric, "p_boss_gy" numeric, "p_player_gx" numeric, "p_player_gy" numeric, "p_boss_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_mm3_boss_player_hit"("p_wallet" "text", "p_damage" integer DEFAULT 1, "p_boss_id" "text" DEFAULT 'm5_trump'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_boss mm3_map_boss%ROWTYPE;
  v_health INTEGER;
  v_killed BOOLEAN := FALSE;
  v_totals JSONB;
  v_wallet TEXT := LOWER(TRIM(p_wallet));
  v_damage INTEGER := LEAST(500, GREATEST(1, COALESCE(p_damage, 1)));
BEGIN
  IF v_wallet = '' OR v_wallet LIKE 'anon-%' THEN
    RAISE EXCEPTION 'wallet_required';
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = p_boss_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'boss_not_found'; END IF;

  IF v_boss.state = 'dead' THEN
    IF v_boss.respawn_at IS NOT NULL AND v_boss.respawn_at <= NOW() THEN
      UPDATE mm3_map_boss SET
        state = 'idle', health = max_health, damage_totals = '{}'::jsonb,
        defeated_at = NULL, respawn_at = NULL, updated_at = NOW()
      WHERE id = p_boss_id
      RETURNING * INTO v_boss;
    ELSE
      RETURN jsonb_build_object('ok', true, 'state', 'dead', 'health', 0, 'killed', false, 'already_dead', true);
    END IF;
  END IF;

  v_health := GREATEST(0, v_boss.health - v_damage);
  v_killed := v_health = 0;
  v_totals := COALESCE(v_boss.damage_totals, '{}'::jsonb);
  v_totals := jsonb_set(
    v_totals,
    ARRAY[v_wallet],
    to_jsonb(COALESCE((v_totals->>v_wallet)::numeric, 0) + v_damage),
    true
  );

  IF v_killed THEN
    UPDATE mm3_map_boss SET
      state = 'dead', health = 0, damage_totals = v_totals,
      defeated_at = NOW(), respawn_at = NOW() + INTERVAL '24 hours',
      updated_at = NOW()
    WHERE id = p_boss_id;
  ELSE
    UPDATE mm3_map_boss SET
      state = 'active', health = v_health, damage_totals = v_totals, updated_at = NOW()
    WHERE id = p_boss_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'state', CASE WHEN v_killed THEN 'dead' ELSE 'active' END,
    'health', v_health,
    'max_health', v_boss.max_health,
    'damage', v_damage,
    'killed', v_killed,
    'activated', v_boss.state = 'idle',
    'damage_totals', v_totals
  );
END;
$$;


ALTER FUNCTION "public"."apply_mm3_boss_player_hit"("p_wallet" "text", "p_damage" integer, "p_boss_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean DEFAULT false, "p_damage" integer DEFAULT 1, "p_eur_per_hit" numeric DEFAULT 0.10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_health INTEGER; v_killed BOOLEAN := FALSE;
  v_stolen_eur NUMERIC := 0; v_stolen_usd NUMERIC := 0; v_stolen_cny NUMERIC := 0;
  v_attacker_eur NUMERIC := 0; v_attacker_usd NUMERIC := 0; v_attacker_cny NUMERIC := 0;
  v_victim_eur NUMERIC := 0; v_victim_usd NUMERIC := 0; v_victim_cny NUMERIC := 0;
  v_same_pool BOOLEAN := FALSE;
  v_day_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  p_attacker := LOWER(TRIM(p_attacker)); p_victim := LOWER(TRIM(p_victim));
  p_damage := LEAST(100, GREATEST(1, p_damage));
  IF p_attacker = '' OR p_victim = '' OR p_attacker = p_victim THEN RAISE EXCEPTION 'invalid_params'; END IF;
  IF p_attacker LIKE 'anon-%' AND NOT p_victim_is_anon THEN RAISE EXCEPTION 'anon_cannot_attack'; END IF;
  IF NOT p_victim_is_anon THEN
    SELECT EXISTS (SELECT 1 FROM mm3_wallet_pool_members a JOIN mm3_wallet_pool_members v ON v.pool_code=a.pool_code WHERE a.wallet=p_attacker AND v.wallet=p_victim) INTO v_same_pool;
    IF v_same_pool THEN RAISE EXCEPTION 'same_pool'; END IF;
  END IF;

  INSERT INTO mm3_pvp_health(wallet,health) VALUES(p_victim,100) ON CONFLICT(wallet) DO NOTHING;
  SELECT health INTO v_health FROM mm3_pvp_health WHERE wallet=p_victim FOR UPDATE;
  v_health := GREATEST(0,v_health-p_damage); v_killed := v_health=0;
  UPDATE mm3_pvp_health SET health=CASE WHEN v_killed THEN 100 ELSE v_health END,
    deaths=deaths+CASE WHEN v_killed THEN 1 ELSE 0 END, updated_at=NOW() WHERE wallet=p_victim;

  IF NOT p_victim_is_anon THEN
    SELECT COALESCE(eur_earned,0),COALESCE(usd_earned,0),COALESCE(cny_earned,0)
      INTO v_victim_eur,v_victim_usd,v_victim_cny FROM player_progress WHERE wallet=p_victim FOR UPDATE;
    v_stolen_eur:=LEAST(p_eur_per_hit,GREATEST(0,v_victim_eur));
    v_stolen_usd:=LEAST(p_eur_per_hit*(0.139/0.128),GREATEST(0,v_victim_usd));
    v_stolen_cny:=LEAST(p_eur_per_hit/0.128,GREATEST(0,v_victim_cny));
    IF v_stolen_eur>0 OR v_stolen_usd>0 OR v_stolen_cny>0 THEN
      UPDATE player_progress SET eur_earned=GREATEST(0,eur_earned-v_stolen_eur),usd_earned=GREATEST(0,usd_earned-v_stolen_usd),cny_earned=GREATEST(0,cny_earned-v_stolen_cny),updated_at=NOW() WHERE wallet=p_victim;
      UPDATE player_progress SET eur_earned=eur_earned+v_stolen_eur,usd_earned=usd_earned+v_stolen_usd,cny_earned=cny_earned+v_stolen_cny,updated_at=NOW() WHERE wallet=p_attacker;
    END IF;
  END IF;

  INSERT INTO mm3_pvp_hits(attacker_wallet,victim_wallet,day_key,hit_count,eur_stolen,first_hit_at,last_hit_at)
  VALUES(p_attacker,p_victim,v_day_key,1,v_stolen_eur,NOW(),NOW())
  ON CONFLICT(attacker_wallet,victim_wallet,day_key) DO UPDATE SET
    hit_count=mm3_pvp_hits.hit_count+1,eur_stolen=mm3_pvp_hits.eur_stolen+EXCLUDED.eur_stolen,last_hit_at=NOW();
  IF v_killed AND NOT p_victim_is_anon THEN
    UPDATE mm3_pvp_hits SET elim_count=elim_count+1
      WHERE attacker_wallet=p_attacker AND victim_wallet=p_victim AND day_key=v_day_key;
    UPDATE mm3_pvp_hits SET elim_count=elim_count+1
      WHERE victim_wallet=p_victim AND day_key=v_day_key AND attacker_wallet!=p_attacker
        AND hit_count=(SELECT MAX(hit_count) FROM mm3_pvp_hits WHERE victim_wallet=p_victim AND day_key=v_day_key AND attacker_wallet!=p_attacker);
  END IF;
  SELECT COALESCE(eur_earned,0),COALESCE(usd_earned,0),COALESCE(cny_earned,0) INTO v_attacker_eur,v_attacker_usd,v_attacker_cny FROM player_progress WHERE wallet=p_attacker;
  IF NOT p_victim_is_anon THEN SELECT COALESCE(eur_earned,0),COALESCE(usd_earned,0),COALESCE(cny_earned,0) INTO v_victim_eur,v_victim_usd,v_victim_cny FROM player_progress WHERE wallet=p_victim; END IF;
  RETURN jsonb_build_object('health',CASE WHEN v_killed THEN 0 ELSE v_health END,'respawn_health',CASE WHEN v_killed THEN 100 ELSE v_health END,'killed',v_killed,'damage',p_damage,'stolen_eur',v_stolen_eur,'stolen_usd',v_stolen_usd,'stolen_cny',v_stolen_cny,'attacker_balances',jsonb_build_object('EUR',v_attacker_eur,'USD',v_attacker_usd,'CNY',v_attacker_cny),'victim_balances',CASE WHEN p_victim_is_anon THEN NULL ELSE jsonb_build_object('EUR',v_victim_eur,'USD',v_victim_usd,'CNY',v_victim_cny) END);
END;
$$;


ALTER FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean, "p_damage" integer, "p_eur_per_hit" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_can_leave"("p_wallet" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pool_code text;
BEGIN
  SELECT pool_code INTO v_pool_code
  FROM mm3_wallet_pool_members
  WHERE wallet = p_wallet;

  IF v_pool_code IS NULL THEN
    RETURN true;
  END IF;

  RETURN NOT EXISTS(
    SELECT 1
    FROM mm3_pool_disputes d
    WHERE (d.challenger_pool_code = v_pool_code OR d.defender_pool_code = v_pool_code)
      AND d.status IN ('proposing', 'registering', 'battle_start')
  );
END;
$$;


ALTER FUNCTION "public"."mm3_dispute_can_leave"("p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_cancel"("p_dispute_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mm3_dispute_cancel"("p_dispute_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_join"("p_dispute_id" bigint, "p_wallet" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM mm3_sell_transactions WHERE wallet = p_wallet;

  SELECT EXISTS(
    SELECT 1 FROM mm3_command_penalties
    WHERE wallet = p_wallet AND redeemed_at IS NULL
  ) INTO v_has_penalty;

  INSERT INTO mm3_pool_dispute_wallets(
    dispute_id, wallet, pool_code, side,
    level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
    exec_snap, nftji_snap, mining_nftji_snap, mining_nftji_level_snap, has_penalty,
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
    pp.mining_nftji_key,
    CASE WHEN pp.mining_nftji_key IS NOT NULL
      THEN GREATEST(0, COALESCE((pp.mining_nftji_levels->>pp.mining_nftji_key)::integer, 0))
      ELSE 0 END,
    v_has_penalty,
    ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
    ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
    sn.equipped,
    CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
         WHEN sn.equipped = 'defense' THEN sn.defense_level
         ELSE -1 END
  FROM player_progress pp
  LEFT JOIN mm3_squeezing_nftji sn ON sn.wallet = p_wallet
  WHERE pp.wallet = p_wallet
  ON CONFLICT (dispute_id, wallet) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."mm3_dispute_join"("p_dispute_id" bigint, "p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_resolve"("p_dispute_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- NFTJI drop roll: 1/5 chance, deterministic per dispute
  -- Type: 50/50 attack/defense. Winners can claim it voluntarily.
  v_drop_type := NULL;
  IF (hashtext(p_dispute_id::text || 'nftdrop')::bigint & 2147483647) % 5 = 0 THEN
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


ALTER FUNCTION "public"."mm3_dispute_resolve"("p_dispute_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_start_battle"("p_dispute_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mm3_dispute_start_battle"("p_dispute_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_dispute_vote"("p_challenger_pool" "text", "p_defender_pool" "text", "p_wallet" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
        FROM mm3_sell_transactions WHERE wallet = v_member;

        SELECT EXISTS(
          SELECT 1 FROM mm3_command_penalties
          WHERE wallet = v_member AND redeemed_at IS NULL
        ) INTO v_has_penalty;

        INSERT INTO mm3_pool_dispute_wallets(
          dispute_id, wallet, pool_code, side,
          level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
          exec_snap, nftji_snap, mining_nftji_snap, mining_nftji_level_snap, has_penalty,
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
          pp.mining_nftji_key,
          CASE WHEN pp.mining_nftji_key IS NOT NULL
            THEN GREATEST(0, COALESCE((pp.mining_nftji_levels->>pp.mining_nftji_key)::integer, 0))
            ELSE 0 END,
          v_has_penalty,
          ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
          ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
          sn.equipped,
          CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
               WHEN sn.equipped = 'defense' THEN sn.defense_level
               ELSE -1 END
        FROM player_progress pp
        LEFT JOIN mm3_squeezing_nftji sn ON sn.wallet = v_member
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
        FROM mm3_sell_transactions WHERE wallet = v_member;

        SELECT EXISTS(
          SELECT 1 FROM mm3_command_penalties
          WHERE wallet = v_member AND redeemed_at IS NULL
        ) INTO v_has_penalty;

        INSERT INTO mm3_pool_dispute_wallets(
          dispute_id, wallet, pool_code, side,
          level_snap, mm3_snap, eur_snap, usd_snap, cny_snap,
          exec_snap, nftji_snap, mining_nftji_snap, mining_nftji_level_snap, has_penalty,
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
          pp.mining_nftji_key,
          CASE WHEN pp.mining_nftji_key IS NOT NULL
            THEN GREATEST(0, COALESCE((pp.mining_nftji_levels->>pp.mining_nftji_key)::integer, 0))
            ELSE 0 END,
          v_has_penalty,
          ROUND(COALESCE(pp.eur_earned, 0) * 0.05, 4),
          ROUND(COALESCE(pp.mm3_sold, 0) * 0.03, 4),
          sn.equipped,
          CASE WHEN sn.equipped = 'attack'  THEN sn.attack_level
               WHEN sn.equipped = 'defense' THEN sn.defense_level
               ELSE -1 END
        FROM player_progress pp
        LEFT JOIN mm3_squeezing_nftji sn ON sn.wallet = v_member
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


ALTER FUNCTION "public"."mm3_dispute_vote"("p_challenger_pool" "text", "p_defender_pool" "text", "p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_leave_wallet_pool"("p_wallet" "text") RETURNS TABLE("wallet" "text", "pool_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  DELETE FROM public.mm3_wallet_pool_members m
  WHERE lower(trim(m.wallet)) = lower(trim(p_wallet))
  RETURNING m.wallet, m.pool_code;
END;
$$;


ALTER FUNCTION "public"."mm3_leave_wallet_pool"("p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_pool_max_wallets"("p_avg_level" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_avg_level >= 800 THEN 25
    WHEN p_avg_level >= 600 THEN 20
    WHEN p_avg_level >= 400 THEN 15
    WHEN p_avg_level >= 200 THEN 10
    ELSE 5
  END;
$$;


ALTER FUNCTION "public"."mm3_pool_max_wallets"("p_avg_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_pool_rank_from_level"("p_level" integer) RETURNS TABLE("rank_key" "text", "emoji" "text", "rank_name" "text", "rank_desc" "text", "min_level" integer, "max_level" integer)
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mm3_pool_rank_from_level"("p_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_refresh_all_pool_ranks"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT pool_code FROM public.mm3_wallet_pools LOOP
    PERFORM public.mm3_refresh_pool_rank(r.pool_code);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."mm3_refresh_all_pool_ranks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_refresh_pool_rank"("p_pool_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_level integer;
  v_rank record;
BEGIN
  SELECT COALESCE(SUM(pp.level), 0)::integer
  INTO v_level
  FROM public.mm3_wallet_pool_members m
  LEFT JOIN public.player_progress pp
    ON lower(trim(pp.wallet)) = lower(trim(m.wallet))
  WHERE m.pool_code = p_pool_code;

  SELECT *
  INTO v_rank
  FROM public.mm3_pool_rank_from_level(v_level);

  UPDATE public.mm3_wallet_pools
  SET
    pool_rank_key       = COALESCE(v_rank.rank_key, ''),
    pool_rank_emoji     = COALESCE(v_rank.emoji, ''),
    pool_rank_name      = COALESCE(v_rank.rank_name, ''),
    pool_rank_desc      = COALESCE(v_rank.rank_desc, ''),
    pool_rank_min_level = v_rank.min_level,
    pool_rank_max_level = v_rank.max_level,
    updated_at          = now()
  WHERE pool_code = p_pool_code;
END;
$$;


ALTER FUNCTION "public"."mm3_refresh_pool_rank"("p_pool_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_squeeze_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mm3_squeeze_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mm3_squeezing_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM mm3_squeezing_nftji WHERE wallet = p_wallet;

  IF NOT FOUND THEN
    -- First ever drop for this wallet
    v_new_atk := CASE WHEN v_drop_type = 'attack'  THEN 0 ELSE -1 END;
    v_new_def := CASE WHEN v_drop_type = 'defense' THEN 0 ELSE -1 END;
    INSERT INTO mm3_squeezing_nftji(wallet, equipped, attack_level, defense_level)
    VALUES (p_wallet, v_drop_type, v_new_atk, v_new_def);
  ELSE
    IF v_drop_type = 'attack' THEN
      v_new_atk := CASE WHEN v_cur_atk < 0 THEN 0 ELSE v_cur_atk + 1 END;
      v_new_def := v_cur_def;
    ELSE
      v_new_atk := v_cur_atk;
      v_new_def := CASE WHEN v_cur_def < 0 THEN 0 ELSE v_cur_def + 1 END;
    END IF;
    UPDATE mm3_squeezing_nftji SET
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


ALTER FUNCTION "public"."mm3_squeezing_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_mm3_boss_idle_if_requested"("p_map_id" "text" DEFAULT '5'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_boss mm3_map_boss%ROWTYPE;
BEGIN
  IF p_map_id NOT IN ('3', '4', '5') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_map');
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE map_id = p_map_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'boss_not_found'; END IF;
  IF v_boss.state <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'state', v_boss.state,
      'health', v_boss.health,
      'max_health', v_boss.max_health,
      'changed', false,
      'map_id', p_map_id
    );
  END IF;

  UPDATE mm3_map_boss SET
    state = 'idle',
    health = max_health,
    damage_totals = '{}'::jsonb,
    updated_at = NOW()
  WHERE map_id = p_map_id;

  RETURN jsonb_build_object(
    'ok', true,
    'state', 'idle',
    'health', v_boss.max_health,
    'max_health', v_boss.max_health,
    'changed', true,
    'map_id', p_map_id
  );
END;
$$;


ALTER FUNCTION "public"."set_mm3_boss_idle_if_requested"("p_map_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_leaderboard_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.update_leaderboard();
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_update_leaderboard_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leaderboard"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."update_leaderboard"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_task_claims" (
    "wallet" "text" NOT NULL,
    "day" "text" NOT NULL,
    "task_key" "text" NOT NULL,
    "reward_claimed" boolean DEFAULT true NOT NULL,
    "reward_eur" numeric DEFAULT 0 NOT NULL,
    "reward_usd" numeric DEFAULT 0 NOT NULL,
    "reward_cny" numeric DEFAULT 0 NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_task_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" integer NOT NULL,
    "wallet" "text" NOT NULL,
    "problem" "text" NOT NULL,
    "user_answer" "text" NOT NULL,
    "is_correct" boolean NOT NULL,
    "time_ms" integer NOT NULL,
    "mining_reward" numeric DEFAULT 0,
    "problem_id" bigint,
    "difficulty" integer,
    "problem_type" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "games_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5))),
    CONSTRAINT "games_problem_type_check" CHECK (("problem_type" = ANY (ARRAY['arithmetic'::"text", 'operator_fix'::"text", 'digit_fix'::"text", 'powers'::"text", 'sequence'::"text", 'definition'::"text", 'modulo'::"text", 'logic'::"text", 'fractions'::"text", 'primes'::"text", 'geometry'::"text", 'percentage'::"text", 'algebra'::"text"])))
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."games_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."games_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."games_id_seq" OWNED BY "public"."games"."id";



CREATE TABLE IF NOT EXISTS "public"."leaderboard_data" (
    "wallet" "text" NOT NULL,
    "total_eth" numeric DEFAULT 0,
    "total_correct" integer DEFAULT 0,
    "total_games" integer DEFAULT 0,
    "highest_streak" integer DEFAULT 0,
    "current_streak" integer DEFAULT 0,
    "rank" integer,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "leaderboard_wallet_not_anonymous" CHECK (("lower"("btrim"("wallet")) !~ '^anon($|[-:])'::"text"))
);


ALTER TABLE "public"."leaderboard_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."math_problems" (
    "id" bigint NOT NULL,
    "problem_type" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "question" "text" NOT NULL,
    "correct_answer" "text" NOT NULL,
    "answer_options" "text"[],
    "is_definition_type" boolean DEFAULT false,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "base_points" numeric DEFAULT 0.00001 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "math_problems_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5))),
    CONSTRAINT "math_problems_language_check" CHECK (("language" = ANY (ARRAY['en'::"text", 'es'::"text"]))),
    CONSTRAINT "math_problems_problem_type_check" CHECK (("problem_type" = ANY (ARRAY['arithmetic'::"text", 'operator_fix'::"text", 'digit_fix'::"text", 'powers'::"text", 'sequence'::"text", 'definition'::"text", 'modulo'::"text", 'logic'::"text", 'fractions'::"text", 'primes'::"text", 'geometry'::"text", 'percentage'::"text", 'algebra'::"text"])))
);


ALTER TABLE "public"."math_problems" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."math_problems_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."math_problems_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."math_problems_id_seq" OWNED BY "public"."math_problems"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_chain_reset_log" (
    "id" bigint NOT NULL,
    "chip" integer NOT NULL,
    "wallet" "text" DEFAULT 'anon'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_chain_reset_log_chip_check" CHECK (("chip" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."mm3_chain_reset_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_chain_reset_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_chain_reset_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_chain_reset_log_id_seq" OWNED BY "public"."mm3_chain_reset_log"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_chain_solve_attempts" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "day" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."mm3_chain_solve_attempts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_chain_solve_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_chain_solve_attempts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_chain_solve_attempts_id_seq" OWNED BY "public"."mm3_chain_solve_attempts"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_chain_solvers" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "solved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "formula_solved" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."mm3_chain_solvers" OWNER TO "postgres";


ALTER TABLE "public"."mm3_chain_solvers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."mm3_chain_solvers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mm3_command_penalties" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "command_id" bigint,
    "nftji_key" "text" DEFAULT ''::"text" NOT NULL,
    "penalty_code" "text" NOT NULL,
    "penalty_effect" "text" DEFAULT 'money'::"text" NOT NULL,
    "penalty_value" numeric DEFAULT 0 NOT NULL,
    "penalty_eur" numeric DEFAULT 0 NOT NULL,
    "reason" "text",
    "reset_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "attempted_at" timestamp with time zone,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_command_penalties_penalty_effect_check" CHECK (("penalty_effect" = ANY (ARRAY['money'::"text", 'mm3'::"text"])))
);


ALTER TABLE "public"."mm3_command_penalties" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_command_penalties_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_command_penalties_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_command_penalties_id_seq" OWNED BY "public"."mm3_command_penalties"."id";

CREATE TABLE IF NOT EXISTS "public"."mm3_hidden_cmd_executions" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "block_key" "text" NOT NULL,
    "amount_eur" numeric DEFAULT 0 NOT NULL,
    "amount_mm3" numeric DEFAULT 0 NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mm3_hidden_cmd_executions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_hidden_cmd_executions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_hidden_cmd_executions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_hidden_cmd_executions_id_seq" OWNED BY "public"."mm3_hidden_cmd_executions"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_macro_state" (
    "id" smallint DEFAULT 1 NOT NULL,
    "war_percent" numeric DEFAULT 0 NOT NULL,
    "nature_percent" numeric DEFAULT 0 NOT NULL,
    "ticker_message" "text" DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##'::"text" NOT NULL,
    "ticker_message_en" "text" DEFAULT '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##'::"text" NOT NULL,
    "ticker_message_es" "text" DEFAULT '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chain_demine_active" boolean DEFAULT false NOT NULL,
    "chain_demine_hits_remaining" integer DEFAULT 100 NOT NULL,
    "node_dice_wallet" "text",
    "node_dice_started_at" timestamp with time zone,
    "node_dice_expires_at" timestamp with time zone,
    "node_dice_mode" "text",
    "node_dice_hour_start" bigint DEFAULT 0 NOT NULL,
    "node_dice_war_percent" numeric DEFAULT 0 NOT NULL,
    "node_dice_nature_percent" numeric DEFAULT 0 NOT NULL,
    "formula_chain_index_start" integer,
    "ticker_message_expires_at" timestamp with time zone,
    CONSTRAINT "mm3_macro_state_id_check" CHECK (("id" = 1)),
    CONSTRAINT "mm3_macro_state_nature_percent_check" CHECK ((("nature_percent" >= (0)::numeric) AND ("nature_percent" <= (100)::numeric))),
    CONSTRAINT "mm3_macro_state_node_dice_mode_check" CHECK ((("node_dice_mode" IS NULL) OR ("node_dice_mode" = ANY (ARRAY['war'::"text", 'meteo'::"text"])))),
    CONSTRAINT "mm3_macro_state_node_dice_nature_percent_check" CHECK ((("node_dice_nature_percent" >= (0)::numeric) AND ("node_dice_nature_percent" <= (100)::numeric))),
    CONSTRAINT "mm3_macro_state_node_dice_war_percent_check" CHECK ((("node_dice_war_percent" >= (0)::numeric) AND ("node_dice_war_percent" <= (100)::numeric))),
    CONSTRAINT "mm3_macro_state_war_percent_check" CHECK ((("war_percent" >= (0)::numeric) AND ("war_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."mm3_macro_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_map_boss" (
    "id" "text" NOT NULL,
    "map_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "max_health" integer DEFAULT 5000 NOT NULL,
    "health" integer DEFAULT 5000 NOT NULL,
    "state" "text" DEFAULT 'idle'::"text" NOT NULL,
    "damage_totals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "defeated_at" timestamp with time zone,
    "respawn_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_map_boss_state_check" CHECK (("state" = ANY (ARRAY['idle'::"text", 'active'::"text", 'dead'::"text"])))
);


ALTER TABLE "public"."mm3_map_boss" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_mined_blocks" (
    "id" bigint NOT NULL,
    "block_hex" "text" NOT NULL,
    "grid_row" integer NOT NULL,
    "grid_col" integer NOT NULL,
    "wallet" "text" NOT NULL,
    "wallet_level" integer DEFAULT 0 NOT NULL,
    "mm3_value" numeric DEFAULT 0 NOT NULL,
    "mm3_value_hex" "text" DEFAULT '0'::"text" NOT NULL,
    "chain_index" integer NOT NULL,
    "mined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_mined_blocks_block_hex_check" CHECK (("block_hex" ~ '^#[0-9A-F]{3}$'::"text")),
    CONSTRAINT "mm3_mined_blocks_wallet_level_check" CHECK ((("wallet_level" >= 0) AND ("wallet_level" <= 100)))
);


ALTER TABLE "public"."mm3_mined_blocks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_mined_blocks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_mined_blocks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_mined_blocks_id_seq" OWNED BY "public"."mm3_mined_blocks"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_mining_blocks" (
    "id" bigint NOT NULL,
    "block_key" "text" NOT NULL,
    "grid_row" integer NOT NULL,
    "grid_col" integer NOT NULL,
    "emoji" "text" NOT NULL,
    "title_en" "text" DEFAULT ''::"text" NOT NULL,
    "title_es" "text" DEFAULT ''::"text" NOT NULL,
    "answer_hash" "text" NOT NULL,
    "price_eur" numeric DEFAULT 1 NOT NULL,
    "short_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "claimed_by" "text",
    "claimed_source" "text",
    "claimed_at" timestamp with time zone,
    "first_purchased_at" timestamp with time zone,
    "paid_eur" numeric DEFAULT 0 NOT NULL,
    "paid_usd" numeric DEFAULT 0 NOT NULL,
    "paid_cny" numeric DEFAULT 0 NOT NULL,
    "market_command" "text" DEFAULT ''::"text" NOT NULL,
    "formula_x" integer DEFAULT 123 NOT NULL,
    "formula_result_5d" "text" DEFAULT ''::"text" NOT NULL,
    "hidden_command" "text" DEFAULT ''::"text" NOT NULL,
    "hidden_cmd_min_level" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_mining_blocks_claimed_source_check" CHECK (("claimed_source" = ANY (ARRAY['wallet'::"text", 'google'::"text"]))),
    CONSTRAINT "mm3_mining_blocks_price_eur_check" CHECK (("price_eur" >= (0)::numeric))
);


ALTER TABLE "public"."mm3_mining_blocks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_mining_blocks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_mining_blocks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_mining_blocks_id_seq" OWNED BY "public"."mm3_mining_blocks"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_mining_commands" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "nftji_key" "text" NOT NULL,
    "command" "text" NOT NULL,
    "numeric_code" "text" DEFAULT ''::"text" NOT NULL,
    "formula_x" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mm3_mining_commands" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_mining_commands_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_mining_commands_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_mining_commands_id_seq" OWNED BY "public"."mm3_mining_commands"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_mining_events" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "delta_mm3" numeric DEFAULT 0 NOT NULL,
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_mining_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['life_continue'::"text", 'nftji_claim'::"text", 'mining_buy'::"text", 'mining_resell'::"text", 'nftji_level_up'::"text", 'node_stormroll'::"text", 'rl_mount_buy'::"text"])))
);


ALTER TABLE "public"."mm3_mining_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_mining_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_mining_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_mining_events_id_seq" OWNED BY "public"."mm3_mining_events"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_mining_state" (
    "id" smallint DEFAULT 1 NOT NULL,
    "commission_mm3" numeric DEFAULT 0 NOT NULL,
    "commission_cny" numeric DEFAULT 0 NOT NULL,
    "commission_eur" numeric DEFAULT 0 NOT NULL,
    "commission_usd" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_mining_state_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."mm3_mining_state" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."mm3_pool_dispute_votes" (
    "id" bigint NOT NULL,
    "challenger_pool_code" "text" NOT NULL,
    "defender_pool_code" "text" NOT NULL,
    "wallet" "text" NOT NULL,
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dispute_id" bigint
);


ALTER TABLE "public"."mm3_pool_dispute_votes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_pool_dispute_votes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_pool_dispute_votes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_pool_dispute_votes_id_seq" OWNED BY "public"."mm3_pool_dispute_votes"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_pool_dispute_wallets" (
    "id" bigint NOT NULL,
    "dispute_id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "pool_code" "text" NOT NULL,
    "side" "text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level_snap" integer DEFAULT 0 NOT NULL,
    "mm3_snap" numeric DEFAULT 0 NOT NULL,
    "eur_snap" numeric DEFAULT 0 NOT NULL,
    "usd_snap" numeric DEFAULT 0 NOT NULL,
    "cny_snap" numeric DEFAULT 0 NOT NULL,
    "exec_snap" integer DEFAULT 0 NOT NULL,
    "nftji_snap" integer DEFAULT 0 NOT NULL,
    "mining_nftji_snap" "text",
    "mining_nftji_level_snap" integer DEFAULT 0 NOT NULL,
    "has_penalty" boolean DEFAULT false NOT NULL,
    "eur_stake" numeric DEFAULT 0 NOT NULL,
    "mm3_stake" numeric DEFAULT 0 NOT NULL,
    "delta_eur" numeric DEFAULT 0 NOT NULL,
    "delta_mm3" numeric DEFAULT 0 NOT NULL,
    "squeeze_nftji_equipped" "text",
    "squeeze_nftji_level" smallint DEFAULT '-1'::integer NOT NULL,
    "squeeze_nftji_claimed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "mm3_pool_dispute_wallets_side_check" CHECK (("side" = ANY (ARRAY['challenger'::"text", 'defender'::"text"]))),
    CONSTRAINT "mm3_pool_dispute_wallets_squeeze_nftji_equipped_check" CHECK (("squeeze_nftji_equipped" = ANY (ARRAY['attack'::"text", 'defense'::"text"])))
);


ALTER TABLE "public"."mm3_pool_dispute_wallets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_pool_dispute_wallets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_pool_dispute_wallets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_pool_dispute_wallets_id_seq" OWNED BY "public"."mm3_pool_dispute_wallets"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_pool_disputes" (
    "id" bigint NOT NULL,
    "challenger_pool_code" "text" NOT NULL,
    "defender_pool_code" "text" NOT NULL,
    "status" "text" DEFAULT 'proposing'::"text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "battle_start_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "war_percent" numeric,
    "nature_percent" numeric,
    "dice_modifier" numeric,
    "ch_wallet_count" integer DEFAULT 0 NOT NULL,
    "ch_level_sum" numeric DEFAULT 0 NOT NULL,
    "ch_mm3_sum" numeric DEFAULT 0 NOT NULL,
    "ch_eur_sum" numeric DEFAULT 0 NOT NULL,
    "ch_nftji_count" integer DEFAULT 0 NOT NULL,
    "ch_mining_nftji_count" integer DEFAULT 0 NOT NULL,
    "ch_penalty_count" integer DEFAULT 0 NOT NULL,
    "ch_exec_count" integer DEFAULT 0 NOT NULL,
    "ch_score" numeric,
    "df_wallet_count" integer DEFAULT 0 NOT NULL,
    "df_level_sum" numeric DEFAULT 0 NOT NULL,
    "df_mm3_sum" numeric DEFAULT 0 NOT NULL,
    "df_eur_sum" numeric DEFAULT 0 NOT NULL,
    "df_nftji_count" integer DEFAULT 0 NOT NULL,
    "df_mining_nftji_count" integer DEFAULT 0 NOT NULL,
    "df_penalty_count" integer DEFAULT 0 NOT NULL,
    "df_exec_count" integer DEFAULT 0 NOT NULL,
    "df_score" numeric,
    "winner" "text",
    "result_summary" "jsonb",
    "drop_type" "text",
    "ch_squeeze_atk_sum" integer DEFAULT 0 NOT NULL,
    "df_squeeze_atk_sum" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "mm3_pool_disputes_drop_type_check" CHECK (("drop_type" = ANY (ARRAY['attack'::"text", 'defense'::"text"]))),
    CONSTRAINT "mm3_pool_disputes_status_check" CHECK (("status" = ANY (ARRAY['proposing'::"text", 'registering'::"text", 'battle_start'::"text", 'resolved'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "mm3_pool_disputes_winner_check" CHECK (("winner" = ANY (ARRAY['challenger'::"text", 'defender'::"text", 'draw'::"text"])))
);


ALTER TABLE "public"."mm3_pool_disputes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_pool_disputes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_pool_disputes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_pool_disputes_id_seq" OWNED BY "public"."mm3_pool_disputes"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_pvp_health" (
    "wallet" "text" NOT NULL,
    "health" integer DEFAULT 100 NOT NULL,
    "deaths" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pvp_dead_until" timestamp with time zone,
    "pvp_dead_gx" double precision,
    "pvp_dead_gy" double precision,
    "last_pos_row" integer,
    "last_pos_col" integer,
    "pos_updated_at" timestamp with time zone,
    "last_pos_z" numeric DEFAULT 0,
    "last_pos_map_id" "text",
    CONSTRAINT "mm3_pvp_health_health_check" CHECK ((("health" >= 0) AND ("health" <= 100)))
);


ALTER TABLE "public"."mm3_pvp_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_pvp_hits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attacker_wallet" "text" NOT NULL,
    "victim_wallet" "text" NOT NULL,
    "day_key" "text" NOT NULL,
    "hit_count" integer DEFAULT 0 NOT NULL,
    "eur_stolen" numeric(12,6) DEFAULT 0 NOT NULL,
    "first_hit_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_hit_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "elim_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."mm3_pvp_hits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_relay_exec_log" (
    "id" bigint NOT NULL,
    "wallet_origin" "text" NOT NULL,
    "wallet_target" "text" NOT NULL,
    "delta_origin" integer DEFAULT 1 NOT NULL,
    "delta_target" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mm3_relay_exec_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_relay_exec_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_relay_exec_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_relay_exec_log_id_seq" OWNED BY "public"."mm3_relay_exec_log"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_relaying_messages" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "text" "text" NOT NULL,
    "ts" bigint NOT NULL,
    "kind" "text" DEFAULT 'chat'::"text" NOT NULL,
    "tone" "text" DEFAULT 'neutral'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_relaying_messages_kind_check" CHECK (("kind" = ANY (ARRAY['chat'::"text", 'system'::"text"])))
);

ALTER TABLE ONLY "public"."mm3_relaying_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."mm3_relaying_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_relaying_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_relaying_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_relaying_messages_id_seq" OWNED BY "public"."mm3_relaying_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_sell_transactions" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "source" "text" DEFAULT 'wallet'::"text" NOT NULL,
    "level" integer DEFAULT 0 NOT NULL,
    "mm3_amount" numeric DEFAULT 0 NOT NULL,
    "mm3_commission" numeric DEFAULT 0 NOT NULL,
    "rate_cny" numeric DEFAULT 0 NOT NULL,
    "gross_cny" numeric DEFAULT 0 NOT NULL,
    "gross_eur" numeric DEFAULT 0 NOT NULL,
    "gross_usd" numeric DEFAULT 0 NOT NULL,
    "commission_rate" numeric DEFAULT 0 NOT NULL,
    "commission_cny" numeric DEFAULT 0 NOT NULL,
    "commission_eur" numeric DEFAULT 0 NOT NULL,
    "commission_usd" numeric DEFAULT 0 NOT NULL,
    "net_cny" numeric DEFAULT 0 NOT NULL,
    "net_eur" numeric DEFAULT 0 NOT NULL,
    "net_usd" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_sell_transactions_level_check" CHECK ((("level" >= 0) AND ("level" <= 100))),
    CONSTRAINT "mm3_sell_transactions_source_check" CHECK (("source" = ANY (ARRAY['wallet'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."mm3_sell_transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_sell_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_sell_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_sell_transactions_id_seq" OWNED BY "public"."mm3_sell_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_squeezing_launches" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "challenger_pool_code" "text" NOT NULL,
    "defender_pool_code" "text" NOT NULL,
    "dispute_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mm3_squeezing_launches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_squeezing_launches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_squeezing_launches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_squeezing_launches_id_seq" OWNED BY "public"."mm3_squeezing_launches"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_squeezing_nftji" (
    "wallet" "text" NOT NULL,
    "equipped" "text",
    "attack_level" smallint DEFAULT '-1'::integer NOT NULL,
    "defense_level" smallint DEFAULT '-1'::integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_squeezing_nftji_equipped_check" CHECK (("equipped" = ANY (ARRAY['attack'::"text", 'defense'::"text"])))
);


ALTER TABLE "public"."mm3_squeezing_nftji" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."mm3_wallet_pool_cooldowns" (
    "wallet" "text" NOT NULL,
    "left_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."mm3_wallet_pool_cooldowns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_wallet_pool_invitations" (
    "id" bigint NOT NULL,
    "wallet" "text" NOT NULL,
    "invited_by" "text" NOT NULL,
    "pool_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "mm3_wallet_pool_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."mm3_wallet_pool_invitations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mm3_wallet_pool_invitations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mm3_wallet_pool_invitations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mm3_wallet_pool_invitations_id_seq" OWNED BY "public"."mm3_wallet_pool_invitations"."id";



CREATE TABLE IF NOT EXISTS "public"."mm3_wallet_pool_members" (
    "wallet" "text" NOT NULL,
    "pool_code" "text" NOT NULL,
    "added_by" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mm3_wallet_pool_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_wallet_pools" (
    "pool_code" "text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_wallet_pools_pool_code_check" CHECK (("pool_code" ~ '^[A-Z0-9]{5}$'::"text"))
);


ALTER TABLE "public"."mm3_wallet_pools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mm3_wallet_presence" (
    "wallet" "text" NOT NULL,
    "source" "text" DEFAULT 'wallet'::"text" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mm3_wallet_presence_source_check" CHECK (("source" = ANY (ARRAY['wallet'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."mm3_wallet_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_progress" (
    "wallet" "text" NOT NULL,
    "level" integer DEFAULT 0 NOT NULL,
    "block_chain_percent" numeric DEFAULT 0 NOT NULL,
    "mm3_sold" numeric DEFAULT 0 NOT NULL,
    "cny_earned" numeric DEFAULT 0 NOT NULL,
    "eur_earned" numeric DEFAULT 0 NOT NULL,
    "usd_earned" numeric DEFAULT 0 NOT NULL,
    "wallet_emojis" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "mining_nftji_key" "text",
    "mining_nftji_price" numeric DEFAULT 0 NOT NULL,
    "mining_nftji_since" timestamp with time zone,
    "life_used" boolean DEFAULT false NOT NULL,
    "lucky_50_claimed" boolean DEFAULT false NOT NULL,
    "lucky_100_claimed" boolean DEFAULT false NOT NULL,
    "lucky_500_claimed" boolean DEFAULT false NOT NULL,
    "lucky_1000_claimed" boolean DEFAULT false NOT NULL,
    "lucky_50_level" integer DEFAULT '-1'::integer NOT NULL,
    "lucky_100_level" integer DEFAULT '-1'::integer NOT NULL,
    "lucky_500_level" integer DEFAULT '-1'::integer NOT NULL,
    "lucky_1000_level" integer DEFAULT '-1'::integer NOT NULL,
    "zero_day_level" integer DEFAULT '-1'::integer NOT NULL,
    "mining_nftji_levels" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sell_rate_cny" numeric DEFAULT 0 NOT NULL,
    "sell_quote_cny" numeric DEFAULT 0 NOT NULL,
    "sell_quote_eur" numeric DEFAULT 0 NOT NULL,
    "sell_quote_usd" numeric DEFAULT 0 NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "relay_exec_count" integer DEFAULT 0 NOT NULL,
    "relay_nftji_acquired_at" timestamp with time zone,
    "relay_nftji_partner" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rl_mount_active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "player_progress_block_chain_percent_check" CHECK ((("block_chain_percent" >= (0)::numeric) AND ("block_chain_percent" <= (100)::numeric))),
    CONSTRAINT "player_progress_level_check" CHECK ((("level" >= 0) AND ("level" <= 100))),
    CONSTRAINT "player_progress_wallet_not_anonymous" CHECK (("lower"("btrim"("wallet")) !~ '^anon($|[-:])'::"text"))
);


ALTER TABLE "public"."player_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_scans" (
    "id" integer NOT NULL,
    "triggered_by" "text" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "score" integer,
    "results" "jsonb",
    "summary" "text",
    CONSTRAINT "security_scans_score_check" CHECK ((("score" >= 0) AND ("score" <= 100))),
    CONSTRAINT "security_scans_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "security_scans_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['manual'::"text", 'cron'::"text"])))
);


ALTER TABLE "public"."security_scans" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_scans_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."security_scans_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_scans_id_seq" OWNED BY "public"."security_scans"."id";



CREATE OR REPLACE VIEW "public"."token_value" WITH ("security_invoker"='true') AS
 SELECT ((COALESCE("sum"("games"."mining_reward"), (0)::numeric) + COALESCE(( SELECT "mm3_mining_state"."commission_mm3"
           FROM "public"."mm3_mining_state"
          WHERE ("mm3_mining_state"."id" = 1)), (0)::numeric)) + COALESCE(( SELECT "sum"("mm3_mining_events"."delta_mm3") AS "sum"
           FROM "public"."mm3_mining_events"), (0)::numeric)) AS "total_eth",
    COALESCE(( SELECT "mm3_mining_state"."commission_mm3"
           FROM "public"."mm3_mining_state"
          WHERE ("mm3_mining_state"."id" = 1)), (0)::numeric) AS "commission_pool_mm3",
    ( SELECT "count"(*) AS "count"
           FROM "public"."games" "games_1"
          WHERE ("games_1"."is_correct" = true)) AS "total_correct_answers",
    ( SELECT "count"(DISTINCT "games_1"."wallet") AS "count"
           FROM "public"."games" "games_1") AS "total_players"
   FROM "public"."games"
  WHERE ("games"."is_correct" = true);


ALTER TABLE "public"."token_value" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."token_value_timeseries" WITH ("security_invoker"='true') AS
 WITH "raw_events" AS (
         SELECT "date_trunc"('hour'::"text", "games"."created_at") AS "hour",
            "sum"("games"."mining_reward") AS "delta_mm3"
           FROM "public"."games"
          WHERE ("games"."is_correct" = true)
          GROUP BY ("date_trunc"('hour'::"text", "games"."created_at"))
        UNION ALL
         SELECT "date_trunc"('hour'::"text", "mm3_sell_transactions"."created_at") AS "hour",
            "sum"("mm3_sell_transactions"."mm3_commission") AS "delta_mm3"
           FROM "public"."mm3_sell_transactions"
          GROUP BY ("date_trunc"('hour'::"text", "mm3_sell_transactions"."created_at"))
        UNION ALL
         SELECT "date_trunc"('hour'::"text", "mm3_mining_events"."created_at") AS "hour",
            "sum"("mm3_mining_events"."delta_mm3") AS "delta_mm3"
           FROM "public"."mm3_mining_events"
          GROUP BY ("date_trunc"('hour'::"text", "mm3_mining_events"."created_at"))
        ), "hour_series" AS (
         SELECT "generate_series"("date_trunc"('hour'::"text", ( SELECT COALESCE("min"("raw_events"."hour"), "now"()) AS "coalesce"
                   FROM "raw_events")), "date_trunc"('hour'::"text", "now"()), '01:00:00'::interval) AS "hour"
        ), "hour_rewards" AS (
         SELECT "raw_events"."hour",
            "sum"("raw_events"."delta_mm3") AS "total_hour"
           FROM "raw_events"
          GROUP BY "raw_events"."hour"
        ), "final" AS (
         SELECT "hs"."hour",
            COALESCE("hr"."total_hour", (0)::numeric) AS "hourly_reward"
           FROM ("hour_series" "hs"
             LEFT JOIN "hour_rewards" "hr" ON (("hr"."hour" = "hs"."hour")))
        )
 SELECT "final"."hour",
    "sum"("final"."hourly_reward") OVER (ORDER BY "final"."hour" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "cumulative_reward"
   FROM "final";


ALTER TABLE "public"."token_value_timeseries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."top_positive_miner" WITH ("security_invoker"='true') AS
 SELECT "leaderboard_data"."wallet",
    "leaderboard_data"."total_eth" AS "pos_total",
    "leaderboard_data"."rank"
   FROM "public"."leaderboard_data"
  WHERE ("leaderboard_data"."total_eth" > (0)::numeric)
  ORDER BY "leaderboard_data"."total_eth" DESC
 LIMIT 1;


ALTER TABLE "public"."top_positive_miner" OWNER TO "postgres";


ALTER TABLE ONLY "public"."games" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."games_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."math_problems" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."math_problems_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_chain_reset_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_chain_reset_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_chain_solve_attempts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_chain_solve_attempts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_command_penalties" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_command_penalties_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_hidden_cmd_executions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_hidden_cmd_executions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_mined_blocks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_mined_blocks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_mining_blocks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_mining_blocks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_mining_commands" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_mining_commands_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_mining_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_mining_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_pool_dispute_votes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_pool_dispute_votes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_pool_dispute_wallets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_pool_dispute_wallets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_pool_disputes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_pool_disputes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_relay_exec_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_relay_exec_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_relaying_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_relaying_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_sell_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_sell_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_squeezing_launches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_squeezing_launches_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mm3_wallet_pool_invitations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mm3_wallet_pool_invitations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."security_scans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_scans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."api_requests"
    ADD CONSTRAINT "api_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_task_claims"
    ADD CONSTRAINT "daily_task_claims_pkey" PRIMARY KEY ("wallet", "day", "task_key");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboard_data"
    ADD CONSTRAINT "leaderboard_data_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."math_problems"
    ADD CONSTRAINT "math_problems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_chain_reset_log"
    ADD CONSTRAINT "mm3_chain_reset_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_chain_solve_attempts"
    ADD CONSTRAINT "mm3_chain_solve_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_chain_solve_attempts"
    ADD CONSTRAINT "mm3_chain_solve_attempts_wallet_day_key" UNIQUE ("wallet", "day");



ALTER TABLE ONLY "public"."mm3_chain_solvers"
    ADD CONSTRAINT "mm3_chain_solvers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_chain_solvers"
    ADD CONSTRAINT "mm3_chain_solvers_wallet_key" UNIQUE ("wallet");



ALTER TABLE ONLY "public"."mm3_command_penalties"
    ADD CONSTRAINT "mm3_command_penalties_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."mm3_hidden_cmd_executions"
    ADD CONSTRAINT "mm3_hidden_cmd_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_macro_state"
    ADD CONSTRAINT "mm3_macro_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_map_boss"
    ADD CONSTRAINT "mm3_map_boss_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_mined_blocks"
    ADD CONSTRAINT "mm3_mined_blocks_block_hex_key" UNIQUE ("block_hex");



ALTER TABLE ONLY "public"."mm3_mined_blocks"
    ADD CONSTRAINT "mm3_mined_blocks_chain_index_key" UNIQUE ("chain_index");



ALTER TABLE ONLY "public"."mm3_mined_blocks"
    ADD CONSTRAINT "mm3_mined_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_mining_blocks"
    ADD CONSTRAINT "mm3_mining_blocks_block_key_key" UNIQUE ("block_key");



ALTER TABLE ONLY "public"."mm3_mining_blocks"
    ADD CONSTRAINT "mm3_mining_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_mining_commands"
    ADD CONSTRAINT "mm3_mining_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_mining_events"
    ADD CONSTRAINT "mm3_mining_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_mining_state"
    ADD CONSTRAINT "mm3_mining_state_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."mm3_pool_dispute_votes"
    ADD CONSTRAINT "mm3_pool_dispute_votes_challenger_pool_code_defender_pool_c_key" UNIQUE ("challenger_pool_code", "defender_pool_code", "wallet");



ALTER TABLE ONLY "public"."mm3_pool_dispute_votes"
    ADD CONSTRAINT "mm3_pool_dispute_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_pool_dispute_wallets"
    ADD CONSTRAINT "mm3_pool_dispute_wallets_dispute_id_wallet_key" UNIQUE ("dispute_id", "wallet");



ALTER TABLE ONLY "public"."mm3_pool_dispute_wallets"
    ADD CONSTRAINT "mm3_pool_dispute_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_pool_disputes"
    ADD CONSTRAINT "mm3_pool_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_pvp_health"
    ADD CONSTRAINT "mm3_pvp_health_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."mm3_pvp_hits"
    ADD CONSTRAINT "mm3_pvp_hits_attacker_wallet_victim_wallet_day_key_key" UNIQUE ("attacker_wallet", "victim_wallet", "day_key");



ALTER TABLE ONLY "public"."mm3_pvp_hits"
    ADD CONSTRAINT "mm3_pvp_hits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_relay_exec_log"
    ADD CONSTRAINT "mm3_relay_exec_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_relaying_messages"
    ADD CONSTRAINT "mm3_relaying_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_sell_transactions"
    ADD CONSTRAINT "mm3_sell_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_squeezing_launches"
    ADD CONSTRAINT "mm3_squeezing_launches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_squeezing_nftji"
    ADD CONSTRAINT "mm3_squeezing_nftji_pkey" PRIMARY KEY ("wallet");

ALTER TABLE ONLY "public"."mm3_wallet_pool_cooldowns"
    ADD CONSTRAINT "mm3_wallet_pool_cooldowns_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."mm3_wallet_pool_invitations"
    ADD CONSTRAINT "mm3_wallet_pool_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mm3_wallet_pool_members"
    ADD CONSTRAINT "mm3_wallet_pool_members_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."mm3_wallet_pools"
    ADD CONSTRAINT "mm3_wallet_pools_pkey" PRIMARY KEY ("pool_code");



ALTER TABLE ONLY "public"."mm3_wallet_presence"
    ADD CONSTRAINT "mm3_wallet_presence_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."player_progress"
    ADD CONSTRAINT "player_progress_pkey" PRIMARY KEY ("wallet");



ALTER TABLE ONLY "public"."security_scans"
    ADD CONSTRAINT "security_scans_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_games_created_at" ON "public"."games" USING "btree" ("created_at");



CREATE INDEX "idx_games_wallet" ON "public"."games" USING "btree" ("wallet");



CREATE INDEX "idx_games_wallet_correct" ON "public"."games" USING "btree" ("wallet", "is_correct");



CREATE INDEX "idx_leaderboard_data_total_eth" ON "public"."leaderboard_data" USING "btree" ("total_eth" DESC);



CREATE INDEX "idx_mm3_command_penalties_active" ON "public"."mm3_command_penalties" USING "btree" ("wallet", "reset_at" DESC) WHERE ("redeemed_at" IS NULL);



CREATE INDEX "idx_mm3_command_penalties_wallet" ON "public"."mm3_command_penalties" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_hidden_cmd_executions_wallet_block" ON "public"."mm3_hidden_cmd_executions" USING "btree" ("wallet", "block_key", "executed_at" DESC);



CREATE INDEX "idx_mm3_mined_blocks_chain_index" ON "public"."mm3_mined_blocks" USING "btree" ("chain_index");



CREATE INDEX "idx_mm3_mined_blocks_wallet" ON "public"."mm3_mined_blocks" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_mining_blocks_claimed_by" ON "public"."mm3_mining_blocks" USING "btree" ("claimed_by");



CREATE INDEX "idx_mm3_mining_commands_nftji_key_reset" ON "public"."mm3_mining_commands" USING "btree" ("nftji_key", "reset_at" DESC);



CREATE INDEX "idx_mm3_mining_commands_wallet" ON "public"."mm3_mining_commands" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_mining_events_created_at" ON "public"."mm3_mining_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mm3_mining_events_wallet" ON "public"."mm3_mining_events" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_pool_dispute_votes_pairing" ON "public"."mm3_pool_dispute_votes" USING "btree" ("challenger_pool_code", "defender_pool_code");



CREATE INDEX "idx_mm3_pool_dispute_wallets_dispute" ON "public"."mm3_pool_dispute_wallets" USING "btree" ("dispute_id", "side");



CREATE INDEX "idx_mm3_pool_dispute_wallets_wallet" ON "public"."mm3_pool_dispute_wallets" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_pool_disputes_pools" ON "public"."mm3_pool_disputes" USING "btree" ("challenger_pool_code", "defender_pool_code");



CREATE INDEX "idx_mm3_pool_disputes_status" ON "public"."mm3_pool_disputes" USING "btree" ("status");



CREATE INDEX "idx_mm3_relaying_messages_created_at" ON "public"."mm3_relaying_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mm3_relaying_messages_ts" ON "public"."mm3_relaying_messages" USING "btree" ("ts" DESC);



CREATE INDEX "idx_mm3_relaying_messages_wallet" ON "public"."mm3_relaying_messages" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_sell_transactions_created_at" ON "public"."mm3_sell_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mm3_sell_transactions_wallet" ON "public"."mm3_sell_transactions" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_squeezing_launches_wallet_created" ON "public"."mm3_squeezing_launches" USING "btree" ("wallet", "created_at" DESC);



CREATE INDEX "idx_mm3_squeezing_nftji_equipped" ON "public"."mm3_squeezing_nftji" USING "btree" ("equipped") WHERE ("equipped" IS NOT NULL);



CREATE INDEX "idx_mm3_squeezing_nftji_wallet" ON "public"."mm3_squeezing_nftji" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_wallet_pool_cooldowns_expires" ON "public"."mm3_wallet_pool_cooldowns" USING "btree" ("wallet", "expires_at");



CREATE INDEX "idx_mm3_wallet_pool_invitations_pool_code" ON "public"."mm3_wallet_pool_invitations" USING "btree" ("pool_code");



CREATE INDEX "idx_mm3_wallet_pool_invitations_wallet" ON "public"."mm3_wallet_pool_invitations" USING "btree" ("wallet");



CREATE INDEX "idx_mm3_wallet_pool_members_pool_code" ON "public"."mm3_wallet_pool_members" USING "btree" ("pool_code");



CREATE INDEX "idx_mm3_wallet_presence_last_seen" ON "public"."mm3_wallet_presence" USING "btree" ("last_seen" DESC);



CREATE INDEX "idx_player_progress_block_chain_percent" ON "public"."player_progress" USING "btree" ("block_chain_percent" DESC);



CREATE INDEX "idx_player_progress_level" ON "public"."player_progress" USING "btree" ("level" DESC);



CREATE INDEX "idx_player_progress_mining_nftji_key" ON "public"."player_progress" USING "btree" ("mining_nftji_key") WHERE ("mining_nftji_key" IS NOT NULL);



CREATE INDEX "idx_problems_difficulty" ON "public"."math_problems" USING "btree" ("difficulty");



CREATE INDEX "idx_problems_language_difficulty" ON "public"."math_problems" USING "btree" ("language", "difficulty");



CREATE INDEX "idx_problems_type" ON "public"."math_problems" USING "btree" ("problem_type");



CREATE INDEX "idx_problems_type_difficulty" ON "public"."math_problems" USING "btree" ("problem_type", "difficulty");



CREATE INDEX "idx_relay_exec_log_created" ON "public"."mm3_relay_exec_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_relay_exec_log_origin" ON "public"."mm3_relay_exec_log" USING "btree" ("wallet_origin");



CREATE INDEX "idx_relay_exec_log_target" ON "public"."mm3_relay_exec_log" USING "btree" ("wallet_target");



CREATE INDEX "mm3_pvp_hits_attacker_idx" ON "public"."mm3_pvp_hits" USING "btree" ("attacker_wallet", "day_key");



CREATE INDEX "mm3_pvp_hits_victim_idx" ON "public"."mm3_pvp_hits" USING "btree" ("victim_wallet", "day_key");



CREATE OR REPLACE TRIGGER "trigger_update_leaderboard" AFTER INSERT ON "public"."games" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_update_leaderboard_fn"();



ALTER TABLE ONLY "public"."mm3_command_penalties"
    ADD CONSTRAINT "mm3_command_penalties_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."mm3_mining_commands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mm3_pool_dispute_votes"
    ADD CONSTRAINT "mm3_pool_dispute_votes_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "public"."mm3_pool_disputes"("id");



ALTER TABLE ONLY "public"."mm3_pool_dispute_wallets"
    ADD CONSTRAINT "mm3_pool_dispute_wallets_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "public"."mm3_pool_disputes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mm3_squeezing_launches"
    ADD CONSTRAINT "mm3_squeezing_launches_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "public"."mm3_pool_disputes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mm3_wallet_pool_invitations"
    ADD CONSTRAINT "mm3_wallet_pool_invitations_pool_code_fkey" FOREIGN KEY ("pool_code") REFERENCES "public"."mm3_wallet_pools"("pool_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mm3_wallet_pool_members"
    ADD CONSTRAINT "mm3_wallet_pool_members_pool_code_fkey" FOREIGN KEY ("pool_code") REFERENCES "public"."mm3_wallet_pools"("pool_code") ON DELETE CASCADE;



ALTER TABLE "public"."api_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_task_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."leaderboard_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."math_problems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_chain_reset_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_chain_solve_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_chain_solvers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_command_penalties" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."mm3_hidden_cmd_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_macro_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_map_boss" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_mined_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_mining_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_mining_commands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_mining_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_mining_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."mm3_pool_dispute_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_pool_dispute_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_pool_disputes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_pvp_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_pvp_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_relay_exec_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_relaying_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_sell_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_squeezing_launches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_squeezing_nftji" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."mm3_wallet_pool_cooldowns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_wallet_pool_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_wallet_pool_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_wallet_pools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mm3_wallet_presence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read" ON "public"."security_scans" FOR SELECT USING (true);



CREATE POLICY "public_insert_api_requests" ON "public"."api_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_insert_chain_solve_attempts" ON "public"."mm3_chain_solve_attempts" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("day" <> ''::"text")));



CREATE POLICY "public_insert_daily_task_claims" ON "public"."daily_task_claims" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("day" <> ''::"text") AND ("task_key" <> ''::"text")));



CREATE POLICY "public_insert_games" ON "public"."games" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_insert_mm3_command_penalties" ON "public"."mm3_command_penalties" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("nftji_key" <> ''::"text") AND ("penalty_code" <> ''::"text")));



CREATE POLICY "public_insert_mm3_hidden_cmd_executions" ON "public"."mm3_hidden_cmd_executions" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("block_key" <> ''::"text")));



CREATE POLICY "public_insert_mm3_macro_state" ON "public"."mm3_macro_state" FOR INSERT WITH CHECK (("id" = 1));



CREATE POLICY "public_insert_mm3_mining_commands" ON "public"."mm3_mining_commands" FOR INSERT TO "anon" WITH CHECK ((("wallet" <> ''::"text") AND ("nftji_key" <> ''::"text") AND ("command" <> ''::"text")));



CREATE POLICY "public_insert_mm3_mining_events" ON "public"."mm3_mining_events" FOR INSERT WITH CHECK (("event_type" = ANY (ARRAY['life_continue'::"text", 'nftji_claim'::"text", 'mining_buy'::"text", 'mining_resell'::"text", 'nftji_level_up'::"text", 'node_stormroll'::"text"])));



CREATE POLICY "public_insert_mm3_mining_state" ON "public"."mm3_mining_state" FOR INSERT WITH CHECK (("id" = 1));



CREATE POLICY "public_insert_mm3_relaying_messages" ON "public"."mm3_relaying_messages" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("text" <> ''::"text")));



CREATE POLICY "public_insert_mm3_sell_transactions" ON "public"."mm3_sell_transactions" FOR INSERT WITH CHECK ((("level" >= 0) AND ("level" <= 100)));



CREATE POLICY "public_insert_mm3_wallet_pool_invitations" ON "public"."mm3_wallet_pool_invitations" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("invited_by" <> ''::"text") AND ("pool_code" <> ''::"text")));



CREATE POLICY "public_insert_mm3_wallet_pool_members" ON "public"."mm3_wallet_pool_members" FOR INSERT WITH CHECK ((("wallet" <> ''::"text") AND ("pool_code" <> ''::"text") AND ("added_by" <> ''::"text")));



CREATE POLICY "public_insert_mm3_wallet_pools" ON "public"."mm3_wallet_pools" FOR INSERT WITH CHECK ((("pool_code" <> ''::"text") AND ("created_by" <> ''::"text")));



CREATE POLICY "public_insert_mm3_wallet_presence" ON "public"."mm3_wallet_presence" FOR INSERT WITH CHECK (("wallet" <> ''::"text"));



CREATE POLICY "public_insert_relay_exec_log" ON "public"."mm3_relay_exec_log" FOR INSERT WITH CHECK ((("wallet_origin" <> ''::"text") AND ("wallet_target" <> ''::"text")));

CREATE POLICY "public_read_api_requests" ON "public"."api_requests" FOR SELECT USING (true);



CREATE POLICY "public_read_chain_solve_attempts" ON "public"."mm3_chain_solve_attempts" FOR SELECT USING (true);



CREATE POLICY "public_read_daily_task_claims" ON "public"."daily_task_claims" FOR SELECT USING (true);

CREATE POLICY "public_read_games" ON "public"."games" FOR SELECT USING (true);



CREATE POLICY "public_read_leaderboard_data" ON "public"."leaderboard_data" FOR SELECT USING (true);



CREATE POLICY "public_read_math_problems" ON "public"."math_problems" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_command_penalties" ON "public"."mm3_command_penalties" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_hidden_cmd_executions" ON "public"."mm3_hidden_cmd_executions" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_macro_state" ON "public"."mm3_macro_state" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_mined_blocks" ON "public"."mm3_mined_blocks" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_mining_blocks" ON "public"."mm3_mining_blocks" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_mining_commands" ON "public"."mm3_mining_commands" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_read_mm3_mining_events" ON "public"."mm3_mining_events" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_mining_state" ON "public"."mm3_mining_state" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_pool_dispute_votes" ON "public"."mm3_pool_dispute_votes" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_pool_dispute_wallets" ON "public"."mm3_pool_dispute_wallets" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_pool_disputes" ON "public"."mm3_pool_disputes" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_relaying_messages" ON "public"."mm3_relaying_messages" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_sell_transactions" ON "public"."mm3_sell_transactions" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_squeezing_launches" ON "public"."mm3_squeezing_launches" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_squeezing_nftji" ON "public"."mm3_squeezing_nftji" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_wallet_pool_cooldowns" ON "public"."mm3_wallet_pool_cooldowns" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_wallet_pool_invitations" ON "public"."mm3_wallet_pool_invitations" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_wallet_pool_members" ON "public"."mm3_wallet_pool_members" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_wallet_pools" ON "public"."mm3_wallet_pools" FOR SELECT USING (true);



CREATE POLICY "public_read_mm3_wallet_presence" ON "public"."mm3_wallet_presence" FOR SELECT USING (true);



CREATE POLICY "public_read_player_progress" ON "public"."player_progress" FOR SELECT USING (true);



CREATE POLICY "public_read_relay_exec_log" ON "public"."mm3_relay_exec_log" FOR SELECT USING (true);

CREATE POLICY "public_update_mm3_command_penalties" ON "public"."mm3_command_penalties" FOR UPDATE USING (("redeemed_at" IS NULL)) WITH CHECK ((("wallet" <> ''::"text") AND ("nftji_key" <> ''::"text") AND ("penalty_code" <> ''::"text")));



CREATE POLICY "public_update_mm3_macro_state" ON "public"."mm3_macro_state" FOR UPDATE USING (("id" = 1)) WITH CHECK (("id" = 1));



CREATE POLICY "public_update_mm3_mining_commands" ON "public"."mm3_mining_commands" FOR UPDATE TO "anon" USING (("wallet" <> ''::"text")) WITH CHECK (("wallet" <> ''::"text"));



CREATE POLICY "public_update_mm3_mining_state" ON "public"."mm3_mining_state" FOR UPDATE USING (("id" = 1)) WITH CHECK (("id" = 1));



CREATE POLICY "public_update_mm3_wallet_pool_invitations" ON "public"."mm3_wallet_pool_invitations" FOR UPDATE USING (true) WITH CHECK ((("wallet" <> ''::"text") AND ("invited_by" <> ''::"text") AND ("pool_code" <> ''::"text")));



CREATE POLICY "public_update_mm3_wallet_pools" ON "public"."mm3_wallet_pools" FOR UPDATE USING (true) WITH CHECK ((("pool_code" <> ''::"text") AND ("created_by" <> ''::"text")));



CREATE POLICY "public_update_mm3_wallet_presence" ON "public"."mm3_wallet_presence" FOR UPDATE USING (true) WITH CHECK (("wallet" <> ''::"text"));



CREATE POLICY "public_update_player_progress" ON "public"."player_progress" FOR UPDATE USING (true) WITH CHECK ((("level" >= 0) AND ("level" <= 100)));

CREATE POLICY "pvp_health_read" ON "public"."mm3_pvp_health" FOR SELECT USING (true);



CREATE POLICY "pvp_hits_select" ON "public"."mm3_pvp_hits" FOR SELECT USING (true);

ALTER TABLE "public"."security_scans" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."apply_mm3_boss_attack_player"("p_wallet" "text", "p_damage" integer, "p_boss_gx" numeric, "p_boss_gy" numeric, "p_player_gx" numeric, "p_player_gy" numeric, "p_boss_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_mm3_boss_attack_player"("p_wallet" "text", "p_damage" integer, "p_boss_gx" numeric, "p_boss_gy" numeric, "p_player_gx" numeric, "p_player_gy" numeric, "p_boss_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_mm3_boss_attack_player"("p_wallet" "text", "p_damage" integer, "p_boss_gx" numeric, "p_boss_gy" numeric, "p_player_gx" numeric, "p_player_gy" numeric, "p_boss_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_mm3_boss_player_hit"("p_wallet" "text", "p_damage" integer, "p_boss_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_mm3_boss_player_hit"("p_wallet" "text", "p_damage" integer, "p_boss_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_mm3_boss_player_hit"("p_wallet" "text", "p_damage" integer, "p_boss_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean, "p_damage" integer, "p_eur_per_hit" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean, "p_damage" integer, "p_eur_per_hit" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean, "p_damage" integer, "p_eur_per_hit" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_mm3_pvp_hit"("p_attacker" "text", "p_victim" "text", "p_victim_is_anon" boolean, "p_damage" integer, "p_eur_per_hit" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_can_leave"("p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_can_leave"("p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_can_leave"("p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_cancel"("p_dispute_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_cancel"("p_dispute_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_cancel"("p_dispute_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_join"("p_dispute_id" bigint, "p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_join"("p_dispute_id" bigint, "p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_join"("p_dispute_id" bigint, "p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_resolve"("p_dispute_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_resolve"("p_dispute_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_resolve"("p_dispute_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_start_battle"("p_dispute_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_start_battle"("p_dispute_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_start_battle"("p_dispute_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_dispute_vote"("p_challenger_pool" "text", "p_defender_pool" "text", "p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_dispute_vote"("p_challenger_pool" "text", "p_defender_pool" "text", "p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_dispute_vote"("p_challenger_pool" "text", "p_defender_pool" "text", "p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_leave_wallet_pool"("p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_leave_wallet_pool"("p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_leave_wallet_pool"("p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_pool_max_wallets"("p_avg_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_pool_max_wallets"("p_avg_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_pool_max_wallets"("p_avg_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_pool_rank_from_level"("p_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_pool_rank_from_level"("p_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_pool_rank_from_level"("p_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_refresh_all_pool_ranks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_refresh_all_pool_ranks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_refresh_pool_rank"("p_pool_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_refresh_pool_rank"("p_pool_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_squeeze_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_squeeze_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_squeeze_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mm3_squeezing_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mm3_squeezing_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mm3_squeezing_nftji_take"("p_dispute_id" bigint, "p_wallet" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_mm3_boss_idle_if_requested"("p_map_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_mm3_boss_idle_if_requested"("p_map_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_mm3_boss_idle_if_requested"("p_map_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_leaderboard_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_leaderboard_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_leaderboard_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leaderboard"() TO "service_role";


















GRANT ALL ON TABLE "public"."api_requests" TO "anon";
GRANT ALL ON TABLE "public"."api_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."api_requests" TO "service_role";



GRANT ALL ON TABLE "public"."daily_task_claims" TO "anon";
GRANT ALL ON TABLE "public"."daily_task_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_task_claims" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_data" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_data" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_data" TO "service_role";



GRANT ALL ON TABLE "public"."math_problems" TO "anon";
GRANT ALL ON TABLE "public"."math_problems" TO "authenticated";
GRANT ALL ON TABLE "public"."math_problems" TO "service_role";



GRANT ALL ON SEQUENCE "public"."math_problems_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."math_problems_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."math_problems_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_chain_reset_log" TO "anon";
GRANT ALL ON TABLE "public"."mm3_chain_reset_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_chain_reset_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_chain_reset_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_chain_reset_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_chain_reset_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_chain_solve_attempts" TO "anon";
GRANT ALL ON TABLE "public"."mm3_chain_solve_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_chain_solve_attempts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_chain_solve_attempts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_chain_solve_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_chain_solve_attempts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_chain_solvers" TO "anon";
GRANT ALL ON TABLE "public"."mm3_chain_solvers" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_chain_solvers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_chain_solvers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_chain_solvers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_chain_solvers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_command_penalties" TO "anon";
GRANT ALL ON TABLE "public"."mm3_command_penalties" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_command_penalties" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_command_penalties_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_command_penalties_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_command_penalties_id_seq" TO "service_role";





GRANT ALL ON TABLE "public"."mm3_hidden_cmd_executions" TO "anon";
GRANT ALL ON TABLE "public"."mm3_hidden_cmd_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_hidden_cmd_executions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_hidden_cmd_executions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_hidden_cmd_executions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_hidden_cmd_executions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_macro_state" TO "anon";
GRANT ALL ON TABLE "public"."mm3_macro_state" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_macro_state" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_map_boss" TO "anon";
GRANT ALL ON TABLE "public"."mm3_map_boss" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_map_boss" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_mined_blocks" TO "anon";
GRANT ALL ON TABLE "public"."mm3_mined_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_mined_blocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_mined_blocks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_mined_blocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_mined_blocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_mining_blocks" TO "anon";
GRANT ALL ON TABLE "public"."mm3_mining_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_mining_blocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_mining_blocks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_mining_blocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_mining_blocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_mining_commands" TO "anon";
GRANT ALL ON TABLE "public"."mm3_mining_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_mining_commands" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_mining_commands_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_mining_commands_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_mining_commands_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_mining_events" TO "anon";
GRANT ALL ON TABLE "public"."mm3_mining_events" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_mining_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_mining_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_mining_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_mining_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_mining_state" TO "anon";
GRANT ALL ON TABLE "public"."mm3_mining_state" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_mining_state" TO "service_role";





GRANT ALL ON TABLE "public"."mm3_pool_dispute_votes" TO "anon";
GRANT ALL ON TABLE "public"."mm3_pool_dispute_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_pool_dispute_votes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_votes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_votes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_votes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_pool_dispute_wallets" TO "anon";
GRANT ALL ON TABLE "public"."mm3_pool_dispute_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_pool_dispute_wallets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_wallets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_wallets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_pool_dispute_wallets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_pool_disputes" TO "anon";
GRANT ALL ON TABLE "public"."mm3_pool_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_pool_disputes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_pool_disputes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_pool_disputes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_pool_disputes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_pvp_health" TO "anon";
GRANT ALL ON TABLE "public"."mm3_pvp_health" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_pvp_health" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_pvp_hits" TO "anon";
GRANT ALL ON TABLE "public"."mm3_pvp_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_pvp_hits" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_relay_exec_log" TO "anon";
GRANT ALL ON TABLE "public"."mm3_relay_exec_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_relay_exec_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_relay_exec_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_relay_exec_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_relay_exec_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_relaying_messages" TO "anon";
GRANT ALL ON TABLE "public"."mm3_relaying_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_relaying_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_relaying_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_relaying_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_relaying_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_sell_transactions" TO "anon";
GRANT ALL ON TABLE "public"."mm3_sell_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_sell_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_sell_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_sell_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_sell_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_squeezing_launches" TO "anon";
GRANT ALL ON TABLE "public"."mm3_squeezing_launches" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_squeezing_launches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_squeezing_launches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_squeezing_launches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_squeezing_launches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_squeezing_nftji" TO "anon";
GRANT ALL ON TABLE "public"."mm3_squeezing_nftji" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_squeezing_nftji" TO "service_role";





GRANT ALL ON TABLE "public"."mm3_wallet_pool_cooldowns" TO "anon";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_cooldowns" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_cooldowns" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_wallet_pool_invitations" TO "anon";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_invitations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mm3_wallet_pool_invitations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mm3_wallet_pool_invitations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mm3_wallet_pool_invitations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_wallet_pool_members" TO "anon";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_members" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_wallet_pool_members" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_wallet_pools" TO "anon";
GRANT ALL ON TABLE "public"."mm3_wallet_pools" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_wallet_pools" TO "service_role";



GRANT ALL ON TABLE "public"."mm3_wallet_presence" TO "anon";
GRANT ALL ON TABLE "public"."mm3_wallet_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."mm3_wallet_presence" TO "service_role";



GRANT ALL ON TABLE "public"."player_progress" TO "anon";
GRANT ALL ON TABLE "public"."player_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."player_progress" TO "service_role";



GRANT ALL ON TABLE "public"."security_scans" TO "anon";
GRANT ALL ON TABLE "public"."security_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."security_scans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_scans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_scans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_scans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."token_value" TO "anon";
GRANT ALL ON TABLE "public"."token_value" TO "authenticated";
GRANT ALL ON TABLE "public"."token_value" TO "service_role";



GRANT ALL ON TABLE "public"."token_value_timeseries" TO "anon";
GRANT ALL ON TABLE "public"."token_value_timeseries" TO "authenticated";
GRANT ALL ON TABLE "public"."token_value_timeseries" TO "service_role";



GRANT ALL ON TABLE "public"."top_positive_miner" TO "anon";
GRANT ALL ON TABLE "public"."top_positive_miner" TO "authenticated";
GRANT ALL ON TABLE "public"."top_positive_miner" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























