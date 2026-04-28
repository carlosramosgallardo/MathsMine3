-- ============================================================
-- MIGRATION 001 — rename nftmoji → nftji, podcast_pixels → market_blocks
-- Run on the live Supabase SQL editor. Safe: no data loss.
-- ============================================================

BEGIN;

-- ── 1. Table: mm3_podcast_pixels → mm3_market_blocks ────────────────────────
ALTER TABLE mm3_podcast_pixels RENAME TO mm3_market_blocks;

-- ── 2. Column: pixel_key → block_key ────────────────────────────────────────
ALTER TABLE mm3_market_blocks RENAME COLUMN pixel_key TO block_key;

-- ── 3. player_progress: market_nftmoji_* → market_nftji_* ───────────────────
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_key   TO market_nftji_key;
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_price TO market_nftji_price;
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_since TO market_nftji_since;

-- ── 4. mm3_market_commands: nftmoji_key → nftji_key ─────────────────────────
ALTER TABLE mm3_market_commands RENAME COLUMN nftmoji_key TO nftji_key;

-- ── 5. mm3_command_penalties: nftmoji_key → nftji_key ───────────────────────
ALTER TABLE mm3_command_penalties RENAME COLUMN nftmoji_key TO nftji_key;

-- ── 6. mm3_market_events event_type: nftmoji_claim → nftji_claim ────────────
--       Must drop CHECK, update rows, recreate.
ALTER TABLE mm3_market_events
  DROP CONSTRAINT IF EXISTS mm3_market_events_event_type_check;

UPDATE mm3_market_events
  SET event_type = 'nftji_claim'
  WHERE event_type = 'nftmoji_claim';

ALTER TABLE mm3_market_events
  ADD CONSTRAINT mm3_market_events_event_type_check
  CHECK (event_type IN ('life_continue', 'nftji_claim', 'market_buy', 'market_resell'));

-- ── 7. mm3_hidden_cmd_executions: pixel_key → block_key (if table exists) ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mm3_hidden_cmd_executions' AND column_name = 'pixel_key'
  ) THEN
    ALTER TABLE mm3_hidden_cmd_executions RENAME COLUMN pixel_key TO block_key;
  END IF;
END $$;

-- ── 8. Indexes ───────────────────────────────────────────────────────────────
-- PostgreSQL auto-renames table-level indexes on table rename,
-- but named indexes on specific columns must be renamed manually.

ALTER INDEX IF EXISTS idx_mm3_podcast_pixels_claimed_by
  RENAME TO idx_mm3_market_blocks_claimed_by;

ALTER INDEX IF EXISTS idx_player_progress_market_key
  RENAME TO idx_player_progress_market_nftji_key;

ALTER INDEX IF EXISTS idx_mm3_market_commands_key_reset
  RENAME TO idx_mm3_market_commands_nftji_key_reset;

-- ── 9. RLS policies that reference old column names ──────────────────────────
-- mm3_market_commands INSERT: nftmoji_key → nftji_key
DROP POLICY IF EXISTS "public_insert_mm3_market_commands" ON mm3_market_commands;
CREATE POLICY "public_insert_mm3_market_commands"
  ON mm3_market_commands FOR INSERT TO anon
  WITH CHECK (wallet <> '' AND nftji_key <> '' AND command <> '');

-- mm3_command_penalties INSERT: nftmoji_key → nftji_key
DROP POLICY IF EXISTS "public_insert_mm3_command_penalties" ON mm3_command_penalties;
CREATE POLICY "public_insert_mm3_command_penalties"
  ON mm3_command_penalties FOR INSERT TO public
  WITH CHECK (wallet <> '' AND nftji_key <> '' AND penalty_code <> '');

-- mm3_market_events INSERT: nftmoji_claim → nftji_claim
DROP POLICY IF EXISTS "public_insert_mm3_market_events" ON mm3_market_events;
CREATE POLICY "public_insert_mm3_market_events"
  ON mm3_market_events FOR INSERT TO public
  WITH CHECK (event_type IN ('life_continue', 'nftji_claim', 'market_buy', 'market_resell'));

-- Rename table-level policies (old names from mm3_podcast_pixels era)
DROP POLICY IF EXISTS "public_read_mm3_podcast_pixels"   ON mm3_market_blocks;
DROP POLICY IF EXISTS "public_update_mm3_podcast_pixels" ON mm3_market_blocks;
CREATE POLICY "public_read_mm3_market_blocks"
  ON mm3_market_blocks FOR SELECT TO public USING (true);
CREATE POLICY "public_update_mm3_market_blocks"
  ON mm3_market_blocks FOR UPDATE TO public USING (true) WITH CHECK (true);

-- ── 10. Drop clean_old_irc_messages() — IRC is permanent ────────────────────
DROP FUNCTION IF EXISTS clean_old_irc_messages();

COMMIT;
