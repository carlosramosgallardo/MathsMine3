-- Persist alive mining height so refreshing on elevated/deep surfaces restores
-- the full 3D position instead of dropping the player to ground level.
ALTER TABLE mm3_pvp_health
  ADD COLUMN IF NOT EXISTS last_pos_z NUMERIC DEFAULT 0;
