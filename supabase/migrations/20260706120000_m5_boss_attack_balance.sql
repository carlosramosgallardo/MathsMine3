-- Boss player attack: widen melee to ~5 cells (server tolerance 5.35).
CREATE OR REPLACE FUNCTION apply_mm3_boss_attack_player(
  p_wallet TEXT,
  p_damage INTEGER DEFAULT 20,
  p_boss_gx NUMERIC DEFAULT NULL,
  p_boss_gy NUMERIC DEFAULT NULL,
  p_player_gx NUMERIC DEFAULT NULL,
  p_player_gy NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boss mm3_map_boss%ROWTYPE;
  v_health INTEGER;
  v_killed BOOLEAN := FALSE;
  v_wallet TEXT := LOWER(TRIM(p_wallet));
  v_damage INTEGER := LEAST(100, GREATEST(1, COALESCE(p_damage, 20)));
  v_spawn_gx NUMERIC := 28.0;
  v_spawn_gy NUMERIC := 28.0;
  v_dead_until TIMESTAMPTZ;
BEGIN
  IF v_wallet = '' OR v_wallet LIKE 'anon-%' THEN
    RAISE EXCEPTION 'wallet_required';
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = 'm5_trump';
  IF NOT FOUND OR v_boss.state <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'boss_not_active');
  END IF;

  IF p_boss_gx IS NOT NULL AND p_boss_gy IS NOT NULL THEN
    IF sqrt(power(p_boss_gx - v_spawn_gx, 2) + power(p_boss_gy - v_spawn_gy, 2)) > 28 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'boss_position_invalid');
    END IF;
    IF p_player_gx IS NOT NULL AND p_player_gy IS NOT NULL THEN
      IF sqrt(power(p_player_gx - p_boss_gx, 2) + power(p_player_gy - p_boss_gy, 2)) > 5.35 THEN
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
