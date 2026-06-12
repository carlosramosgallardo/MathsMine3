CREATE TABLE IF NOT EXISTS mm3_pvp_hits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attacker_wallet TEXT NOT NULL,
  victim_wallet TEXT NOT NULL,
  day_key TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  eur_stolen NUMERIC(12,6) NOT NULL DEFAULT 0,
  first_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attacker_wallet,victim_wallet,day_key)
);
CREATE INDEX IF NOT EXISTS mm3_pvp_hits_attacker_idx ON mm3_pvp_hits(attacker_wallet,day_key);
CREATE INDEX IF NOT EXISTS mm3_pvp_hits_victim_idx ON mm3_pvp_hits(victim_wallet,day_key);
ALTER TABLE mm3_pvp_hits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvp_hits_select" ON mm3_pvp_hits;
CREATE POLICY "pvp_hits_select" ON mm3_pvp_hits FOR SELECT TO public USING (true);
GRANT SELECT ON mm3_pvp_hits TO anon;

CREATE TABLE IF NOT EXISTS mm3_pvp_health (
  wallet TEXT PRIMARY KEY,
  health INTEGER NOT NULL DEFAULT 100 CHECK (health BETWEEN 0 AND 100),
  deaths INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mm3_pvp_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvp_health_read" ON mm3_pvp_health;
CREATE POLICY "pvp_health_read" ON mm3_pvp_health FOR SELECT TO public USING (true);
GRANT SELECT ON mm3_pvp_health TO anon;

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
  v_stolen NUMERIC := 0;
  v_attacker_eur NUMERIC := 0;
  v_victim_eur NUMERIC := 0;
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
    SELECT COALESCE(eur_earned, 0) INTO v_victim_eur
    FROM player_progress WHERE wallet = p_victim FOR UPDATE;

    IF v_victim_eur > 0 THEN
      v_stolen := LEAST(p_eur_per_hit, v_victim_eur);
      UPDATE player_progress SET eur_earned = eur_earned - v_stolen, updated_at = NOW()
      WHERE wallet = p_victim;
      UPDATE player_progress SET eur_earned = eur_earned + v_stolen, updated_at = NOW()
      WHERE wallet = p_attacker;
    END IF;
  END IF;

  INSERT INTO mm3_pvp_hits(attacker_wallet,victim_wallet,day_key,hit_count,eur_stolen,first_hit_at,last_hit_at)
  VALUES(p_attacker,p_victim,v_day_key,1,v_stolen,NOW(),NOW())
  ON CONFLICT(attacker_wallet,victim_wallet,day_key) DO UPDATE SET
    hit_count=mm3_pvp_hits.hit_count+1,
    eur_stolen=mm3_pvp_hits.eur_stolen+EXCLUDED.eur_stolen,
    last_hit_at=NOW();

  SELECT COALESCE(eur_earned, 0) INTO v_attacker_eur
  FROM player_progress WHERE wallet = p_attacker;
  IF NOT p_victim_is_anon THEN
    SELECT COALESCE(eur_earned, 0) INTO v_victim_eur
    FROM player_progress WHERE wallet = p_victim;
  END IF;

  RETURN jsonb_build_object(
    'health', CASE WHEN v_killed THEN 0 ELSE v_health END,
    'respawn_health', CASE WHEN v_killed THEN 100 ELSE v_health END,
    'killed', v_killed,
    'damage', p_damage,
    'stolen_eur', v_stolen,
    'attacker_eur', v_attacker_eur,
    'victim_eur', CASE WHEN p_victim_is_anon THEN NULL ELSE v_victim_eur END
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_mm3_pvp_hit(TEXT,TEXT,BOOLEAN,INTEGER,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_mm3_pvp_hit(TEXT,TEXT,BOOLEAN,INTEGER,NUMERIC) TO service_role;
