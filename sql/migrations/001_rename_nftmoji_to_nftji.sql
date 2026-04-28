-- Migration: rename podcast/pixel/nftmoji era → market/block/nftji standard
-- Safe: no data loss. Run once on live DB.

-- 1. Rename main market table
ALTER TABLE mm3_podcast_pixels RENAME TO mm3_market_blocks;

-- 2. Rename block_key column (was pixel_key)
ALTER TABLE mm3_market_blocks RENAME COLUMN pixel_key TO block_key;

-- 3. Rename named index (table rename does not auto-rename indexes)
ALTER INDEX IF EXISTS mm3_podcast_pixels_pkey RENAME TO mm3_market_blocks_pkey;
ALTER INDEX IF EXISTS mm3_podcast_pixels_block_key_idx RENAME TO mm3_market_blocks_block_key_idx;

-- 4. player_progress columns
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_key   TO market_nftji_key;
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_price TO market_nftji_price;
ALTER TABLE player_progress RENAME COLUMN market_nftmoji_since TO market_nftji_since;

-- 5. mm3_market_commands
ALTER TABLE mm3_market_commands RENAME COLUMN nftmoji_key TO nftji_key;

-- 6. mm3_command_penalties
ALTER TABLE mm3_command_penalties RENAME COLUMN nftmoji_key TO nftji_key;

-- 7. mm3_market_events: update event_type CHECK constraint and row values
ALTER TABLE mm3_market_events DROP CONSTRAINT IF EXISTS mm3_market_events_event_type_check;
UPDATE mm3_market_events SET event_type = 'nftji_claim' WHERE event_type = 'nftmoji_claim';
ALTER TABLE mm3_market_events ADD CONSTRAINT mm3_market_events_event_type_check
  CHECK (event_type IN ('life_continue', 'nftji_claim', 'market_buy', 'market_resell'));

-- 8. mm3_hidden_cmd_executions: rename column only if it still exists as pixel_key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mm3_hidden_cmd_executions' AND column_name = 'pixel_key'
  ) THEN
    ALTER TABLE mm3_hidden_cmd_executions RENAME COLUMN pixel_key TO block_key;
  END IF;
END;
$$;

-- 9. Drop obsolete function (was already removed from schema)
DROP FUNCTION IF EXISTS clean_old_irc_messages();

-- 10. Recreate RLS policies that reference renamed columns
-- (drop old → recreate with new column names)
DROP POLICY IF EXISTS public_read_mm3_podcast_pixels ON mm3_market_blocks;
CREATE POLICY public_read_mm3_market_blocks ON mm3_market_blocks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS owner_insert_mm3_market_blocks ON mm3_market_blocks;
CREATE POLICY owner_insert_mm3_market_blocks ON mm3_market_blocks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS owner_update_mm3_market_blocks ON mm3_market_blocks;
CREATE POLICY owner_update_mm3_market_blocks ON mm3_market_blocks
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
