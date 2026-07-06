-- When M5 is abandoned mid-fight, reset boss to full HP idle (not defeated).
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
  IF p_map_id <> '5' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_map');
  END IF;

  SELECT * INTO v_boss FROM mm3_map_boss WHERE id = 'm5_trump' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'boss_not_found'; END IF;
  IF v_boss.state <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'state', v_boss.state,
      'health', v_boss.health,
      'max_health', v_boss.max_health,
      'changed', false
    );
  END IF;

  UPDATE mm3_map_boss SET
    state = 'idle',
    health = max_health,
    damage_totals = '{}'::jsonb,
    updated_at = NOW()
  WHERE id = 'm5_trump';

  RETURN jsonb_build_object(
    'ok', true,
    'state', 'idle',
    'health', v_boss.max_health,
    'max_health', v_boss.max_health,
    'changed', true
  );
END;
$$;
