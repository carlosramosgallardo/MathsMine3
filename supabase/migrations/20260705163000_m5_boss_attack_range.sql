-- Widen Donald Trump boss melee range to match 2× scale avatar (was 2.4, player could kite at 2.25).
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
BEGIN
  IF v_wallet = '' OR v_wallet LIKE 'anon-%' THEN
    RAISE EXCEPTION 'wallet_required';
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = 'm5_trump';
  IF NOT FOUND OR v_boss.state <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'boss_not_active');
  END IF;

  IF p_boss_gx IS NOT NULL AND p_boss_gy IS NOT NULL THEN
    IF hypot(p_boss_gx - v_spawn_gx, p_boss_gy - v_spawn_gy) > 28 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'boss_position_invalid');
    END IF;
    IF p_player_gx IS NOT NULL AND p_player_gy IS NOT NULL THEN
      IF hypot(p_player_gx - p_boss_gx, p_player_gy - p_boss_gy) > 4.25 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'out_of_range');
      END IF;
    END IF;
  END IF;

  INSERT INTO mm3_pvp_health(wallet, health) VALUES (v_wallet, 100)
  ON CONFLICT (wallet) DO NOTHING;

  SELECT health INTO v_health FROM mm3_pvp_health WHERE wallet = v_wallet FOR UPDATE;
  IF v_health IS NULL THEN v_health := 100; END IF;

  v_health := GREATEST(0, v_health - v_damage);
  v_killed := v_health = 0;

  UPDATE mm3_pvp_health SET
    health = CASE WHEN v_killed THEN 100 ELSE v_health END,
    deaths = deaths + CASE WHEN v_killed THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE wallet = v_wallet;

  RETURN jsonb_build_object('ok', true, 'health', CASE WHEN v_killed THEN 100 ELSE v_health END, 'killed', v_killed, 'damage', v_damage);
END;
$$;
