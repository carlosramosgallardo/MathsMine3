-- ============================================================
-- MM3 NFTJI LEVEL MIGRATION
-- Run once in Supabase SQL editor after deploying the schema.
-- Sets initial levels for wallets that already own mining NFTJis.
-- ============================================================

-- Add new columns if not already present (safe to run multiple times)
ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS lucky_50_level     INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS lucky_100_level    INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS lucky_500_level    INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS lucky_1000_level   INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS market_nftji_levels JSONB NOT NULL DEFAULT '{}';

ALTER TABLE mm3_pool_dispute_wallets
  ADD COLUMN IF NOT EXISTS market_nftji_level_snap INTEGER NOT NULL DEFAULT 0;

-- Back-fill: existing claimers start at level 0
UPDATE player_progress SET lucky_50_level  = 0 WHERE lucky_50_claimed  = TRUE AND lucky_50_level  = -1;
UPDATE player_progress SET lucky_100_level = 0 WHERE lucky_100_claimed = TRUE AND lucky_100_level = -1;
UPDATE player_progress SET lucky_500_level = 0 WHERE lucky_500_claimed = TRUE AND lucky_500_level = -1;
UPDATE player_progress SET lucky_1000_level = 0 WHERE lucky_1000_claimed = TRUE AND lucky_1000_level = -1;

-- Verify
SELECT wallet,
       lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level,
       market_nftji_key, market_nftji_levels
FROM   player_progress
WHERE  lucky_50_claimed OR lucky_100_claimed OR lucky_500_claimed OR lucky_1000_claimed
   OR  market_nftji_key IS NOT NULL;
