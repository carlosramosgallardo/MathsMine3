-- M5 Trump BOSS — shared map boss with daily respawn
CREATE TABLE IF NOT EXISTS mm3_map_boss (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  name TEXT NOT NULL,
  max_health INTEGER NOT NULL DEFAULT 5000,
  health INTEGER NOT NULL DEFAULT 5000,
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'active', 'dead')),
  damage_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  defeated_at TIMESTAMPTZ,
  respawn_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mm3_map_boss (id, map_id, name, max_health, health, state)
VALUES ('m5_trump', '5', 'Trump', 5000, 5000, 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION apply_mm3_boss_player_hit(
  p_wallet TEXT,
  p_damage INTEGER DEFAULT 1,
  p_map_id TEXT DEFAULT '5'
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
  IF p_map_id <> '5' THEN
    RAISE EXCEPTION 'wrong_map';
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = 'm5_trump' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'boss_not_found'; END IF;

  IF v_boss.state = 'dead' THEN
    IF v_boss.respawn_at IS NOT NULL AND v_boss.respawn_at <= NOW() THEN
      UPDATE mm3_map_boss SET
        state = 'idle', health = max_health, damage_totals = '{}'::jsonb,
        defeated_at = NULL, respawn_at = NULL, updated_at = NOW()
      WHERE id = 'm5_trump'
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
    WHERE id = 'm5_trump';
  ELSE
    UPDATE mm3_map_boss SET
      state = 'active', health = v_health, damage_totals = v_totals, updated_at = NOW()
    WHERE id = 'm5_trump';
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
      IF hypot(p_player_gx - p_boss_gx, p_player_gy - p_boss_gy) > 2.4 THEN
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
  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = 'm5_trump' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'boss_not_found'; END IF;
  IF v_boss.state <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'state', v_boss.state, 'changed', false);
  END IF;
  UPDATE mm3_map_boss SET state = 'idle', updated_at = NOW() WHERE id = 'm5_trump';
  RETURN jsonb_build_object('ok', true, 'state', 'idle', 'changed', true);
END;
$$;
