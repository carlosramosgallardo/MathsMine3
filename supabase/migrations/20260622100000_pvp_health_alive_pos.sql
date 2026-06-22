-- Add alive position columns to mm3_pvp_health so wallets can't cheat by
-- clearing localStorage to get a fresh random spawn.
-- Dead-state columns (pvp_dead_until / pvp_dead_gx / pvp_dead_gy) were added
-- by a previous migration; we only add the alive-position pair here.
ALTER TABLE mm3_pvp_health
  ADD COLUMN IF NOT EXISTS last_pos_row INTEGER,
  ADD COLUMN IF NOT EXISTS last_pos_col INTEGER,
  ADD COLUMN IF NOT EXISTS pos_updated_at TIMESTAMPTZ;
