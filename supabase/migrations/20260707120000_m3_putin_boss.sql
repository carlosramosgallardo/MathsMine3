-- M3 Putin boss + parameterized boss RPCs for multi-map bosses
INSERT INTO mm3_map_boss (id, map_id, name, max_health, health, state)
VALUES ('m3_putin', '3', 'Vladimir Putin', 2500, 2500, 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION apply_mm3_boss_player_hit(
  p_wallet TEXT,
  p_damage INTEGER DEFAULT 1,
  p_boss_id TEXT DEFAULT 'm5_trump'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION apply_mm3_boss_attack_player(
  p_wallet TEXT,
  p_damage INTEGER DEFAULT 20,
  p_boss_gx NUMERIC DEFAULT NULL,
  p_boss_gy NUMERIC DEFAULT NULL,
  p_player_gx NUMERIC DEFAULT NULL,
  p_player_gy NUMERIC DEFAULT NULL,
  p_boss_id TEXT DEFAULT 'm5_trump'
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
    WHEN 'm3_putin' THEN 28.0
    ELSE 28.0
  END;
  v_spawn_gy := CASE p_boss_id
    WHEN 'm3_putin' THEN 48.5
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

CREATE OR REPLACE FUNCTION set_mm3_boss_idle_if_requested(
  p_map_id TEXT DEFAULT '5'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boss mm3_map_boss%ROWTYPE;
BEGIN
  IF p_map_id NOT IN ('3', '5') THEN
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
