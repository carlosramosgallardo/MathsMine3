CREATE OR REPLACE FUNCTION apply_mm3_pvp_hit(
  p_attacker TEXT,
  p_victim TEXT,
  p_victim_is_anon BOOLEAN DEFAULT FALSE,
  p_damage INTEGER DEFAULT 1,
  p_eur_per_hit NUMERIC DEFAULT 0.10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health INTEGER;
  v_killed BOOLEAN := FALSE;
  v_stolen_eur NUMERIC := 0;
  v_stolen_usd NUMERIC := 0;
  v_stolen_cny NUMERIC := 0;
  v_attacker_eur NUMERIC := 0;
  v_attacker_usd NUMERIC := 0;
  v_attacker_cny NUMERIC := 0;
  v_victim_eur NUMERIC := 0;
  v_victim_usd NUMERIC := 0;
  v_victim_cny NUMERIC := 0;
  v_same_pool BOOLEAN := FALSE;
  v_day_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  p_attacker := LOWER(TRIM(p_attacker));
  p_victim := LOWER(TRIM(p_victim));
  p_damage := LEAST(100, GREATEST(1, p_damage));

  IF p_attacker = '' OR p_victim = '' OR p_attacker = p_victim THEN
    RAISE EXCEPTION 'invalid_params';
  END IF;
  IF p_attacker LIKE 'anon-%' THEN
    RAISE EXCEPTION 'anon_cannot_attack';
  END IF;

  IF NOT p_victim_is_anon THEN
    SELECT EXISTS (
      SELECT 1 FROM mm3_wallet_pool_members a
      JOIN mm3_wallet_pool_members v ON v.pool_code = a.pool_code
      WHERE a.wallet = p_attacker AND v.wallet = p_victim
    ) INTO v_same_pool;
    IF v_same_pool THEN RAISE EXCEPTION 'same_pool'; END IF;
  END IF;

  INSERT INTO mm3_pvp_health(wallet, health) VALUES (p_victim, 100)
  ON CONFLICT (wallet) DO NOTHING;
  SELECT health INTO v_health FROM mm3_pvp_health
  WHERE wallet = p_victim FOR UPDATE;

  v_health := GREATEST(0, v_health - p_damage);
  v_killed := v_health = 0;
  UPDATE mm3_pvp_health SET
    health = CASE WHEN v_killed THEN 100 ELSE v_health END,
    deaths = deaths + CASE WHEN v_killed THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE wallet = p_victim;

  IF NOT p_victim_is_anon THEN
    SELECT COALESCE(eur_earned, 0), COALESCE(usd_earned, 0), COALESCE(cny_earned, 0)
    INTO v_victim_eur, v_victim_usd, v_victim_cny
    FROM player_progress WHERE wallet = p_victim FOR UPDATE;

    v_stolen_eur := LEAST(p_eur_per_hit, GREATEST(0, v_victim_eur));
    v_stolen_usd := LEAST(p_eur_per_hit * (0.139 / 0.128), GREATEST(0, v_victim_usd));
    v_stolen_cny := LEAST(p_eur_per_hit / 0.128, GREATEST(0, v_victim_cny));

    IF v_stolen_eur > 0 OR v_stolen_usd > 0 OR v_stolen_cny > 0 THEN
      UPDATE player_progress SET
        eur_earned = GREATEST(0, eur_earned - v_stolen_eur),
        usd_earned = GREATEST(0, usd_earned - v_stolen_usd),
        cny_earned = GREATEST(0, cny_earned - v_stolen_cny),
        updated_at = NOW()
      WHERE wallet = p_victim;
      UPDATE player_progress SET
        eur_earned = eur_earned + v_stolen_eur,
        usd_earned = usd_earned + v_stolen_usd,
        cny_earned = cny_earned + v_stolen_cny,
        updated_at = NOW()
      WHERE wallet = p_attacker;
    END IF;
  END IF;

  INSERT INTO mm3_pvp_hits(attacker_wallet,victim_wallet,day_key,hit_count,eur_stolen,first_hit_at,last_hit_at)
  VALUES(p_attacker,p_victim,v_day_key,1,v_stolen_eur,NOW(),NOW())
  ON CONFLICT(attacker_wallet,victim_wallet,day_key) DO UPDATE SET
    hit_count=mm3_pvp_hits.hit_count+1,
    eur_stolen=mm3_pvp_hits.eur_stolen+EXCLUDED.eur_stolen,
    last_hit_at=NOW();

  SELECT COALESCE(eur_earned, 0), COALESCE(usd_earned, 0), COALESCE(cny_earned, 0)
  INTO v_attacker_eur, v_attacker_usd, v_attacker_cny
  FROM player_progress WHERE wallet = p_attacker;
  IF NOT p_victim_is_anon THEN
    SELECT COALESCE(eur_earned, 0), COALESCE(usd_earned, 0), COALESCE(cny_earned, 0)
    INTO v_victim_eur, v_victim_usd, v_victim_cny
    FROM player_progress WHERE wallet = p_victim;
  END IF;

  RETURN jsonb_build_object(
    'health', CASE WHEN v_killed THEN 0 ELSE v_health END,
    'respawn_health', CASE WHEN v_killed THEN 100 ELSE v_health END,
    'killed', v_killed,
    'damage', p_damage,
    'stolen_eur', v_stolen_eur,
    'stolen_usd', v_stolen_usd,
    'stolen_cny', v_stolen_cny,
    'attacker_balances', jsonb_build_object('EUR',v_attacker_eur,'USD',v_attacker_usd,'CNY',v_attacker_cny),
    'victim_balances', CASE WHEN p_victim_is_anon THEN NULL ELSE jsonb_build_object('EUR',v_victim_eur,'USD',v_victim_usd,'CNY',v_victim_cny) END
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_mm3_pvp_hit(TEXT,TEXT,BOOLEAN,INTEGER,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_mm3_pvp_hit(TEXT,TEXT,BOOLEAN,INTEGER,NUMERIC) TO service_role;
