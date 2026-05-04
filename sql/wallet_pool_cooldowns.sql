-- Pool leave cooldown tracking
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS mm3_wallet_pool_cooldowns (
  wallet      TEXT        PRIMARY KEY,
  left_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Index for expiry-based lookups
CREATE INDEX IF NOT EXISTS mm3_wallet_pool_cooldowns_expires
  ON mm3_wallet_pool_cooldowns (wallet, expires_at);

-- Optional: clean up expired records automatically (run as a cron or manually)
-- DELETE FROM mm3_wallet_pool_cooldowns WHERE expires_at < NOW();
