ALTER TABLE mm3_macro_state
  ADD COLUMN IF NOT EXISTS node_dice_wallet TEXT,
  ADD COLUMN IF NOT EXISTS node_dice_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS node_dice_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS node_dice_mode TEXT,
  ADD COLUMN IF NOT EXISTS node_dice_hour_start BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS node_dice_war_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS node_dice_nature_percent NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mm3_macro_state_node_dice_mode_check'
  ) THEN
    ALTER TABLE mm3_macro_state
      ADD CONSTRAINT mm3_macro_state_node_dice_mode_check
      CHECK (node_dice_mode IS NULL OR node_dice_mode IN ('war', 'meteo'));
  END IF;
END $$;

ALTER TABLE mm3_macro_state
  DROP CONSTRAINT IF EXISTS mm3_macro_state_node_dice_war_percent_check,
  ADD CONSTRAINT mm3_macro_state_node_dice_war_percent_check
    CHECK (node_dice_war_percent >= 0 AND node_dice_war_percent <= 100),
  DROP CONSTRAINT IF EXISTS mm3_macro_state_node_dice_nature_percent_check,
  ADD CONSTRAINT mm3_macro_state_node_dice_nature_percent_check
    CHECK (node_dice_nature_percent >= 0 AND node_dice_nature_percent <= 100);
