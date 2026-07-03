-- RL Coliseum car mount (M2 RL Node purchase)
ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS rl_mount_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE mm3_mining_events DROP CONSTRAINT IF EXISTS mm3_mining_events_event_type_check;
ALTER TABLE mm3_mining_events ADD CONSTRAINT mm3_mining_events_event_type_check
  CHECK (event_type IN ('life_continue', 'nftji_claim', 'mining_buy', 'mining_resell', 'nftji_level_up', 'node_stormroll', 'rl_mount_buy'));
