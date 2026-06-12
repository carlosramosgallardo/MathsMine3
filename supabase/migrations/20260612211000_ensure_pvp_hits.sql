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
