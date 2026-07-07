-- ============================================================================
-- Node Dice storm aggro — bosses attack during the 15-min storm window
-- ============================================================================
-- While a Node Dice is active, during each 15-min storm window the three world
-- bosses go from waiting (idle) to hunting (fighting) and attack every player in
-- range, including the dice buyer and their pool.
--
-- Boss damage on a player runs through apply_mm3_boss_attack_player, which today
-- only applies when the boss row state = 'active'. Aggro is EPHEMERAL: we do not
-- flip the persisted boss state (avoids stuck-aggro after the window and survives
-- client refresh). Instead the attack route computes "storm active" server-side
-- (dice window + node dice owner) and passes a trusted p_storm_active flag.
--
-- Security: the function is callable only by service_role (see 20260707150000),
-- so p_storm_active cannot be forged by a client — only the server route sets it.
--
-- We add p_storm_active as a new trailing parameter, so the signature changes.
-- Drop the old 7-arg version first, then recreate with the extra arg.
-- ============================================================================

DROP FUNCTION IF EXISTS public.apply_mm3_boss_attack_player(text, integer, numeric, numeric, numeric, numeric, text);

CREATE FUNCTION public.apply_mm3_boss_attack_player(
  p_wallet text,
  p_damage integer DEFAULT 20,
  p_boss_gx numeric DEFAULT NULL::numeric,
  p_boss_gy numeric DEFAULT NULL::numeric,
  p_player_gx numeric DEFAULT NULL::numeric,
  p_player_gy numeric DEFAULT NULL::numeric,
  p_boss_id text DEFAULT 'm5_trump'::text,
  p_storm_active boolean DEFAULT false
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  -- During a storm the boss hunts even from its waiting (idle) state; a dead
  -- boss never attacks.
  IF NOT FOUND
     OR v_boss.state = 'dead'
     OR (v_boss.state <> 'active' AND NOT COALESCE(p_storm_active, false)) THEN
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

-- Lock down execution to service_role only (consistent with 20260707150000).
REVOKE ALL ON FUNCTION public.apply_mm3_boss_attack_player(text, integer, numeric, numeric, numeric, numeric, text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mm3_boss_attack_player(text, integer, numeric, numeric, numeric, numeric, text, boolean) TO service_role;
