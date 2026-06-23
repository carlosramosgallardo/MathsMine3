ALTER TABLE mm3_mining_events
  DROP CONSTRAINT IF EXISTS mm3_mining_events_event_type_check,
  ADD CONSTRAINT mm3_mining_events_event_type_check
    CHECK (event_type IN ('life_continue', 'nftji_claim', 'mining_buy', 'mining_resell', 'nftji_level_up', 'node_stormroll'));

DROP POLICY IF EXISTS "public_insert_mm3_mining_events" ON mm3_mining_events;
CREATE POLICY "public_insert_mm3_mining_events"
  ON mm3_mining_events
  FOR INSERT
  TO public
  WITH CHECK (event_type IN ('life_continue', 'nftji_claim', 'mining_buy', 'mining_resell', 'nftji_level_up', 'node_stormroll'));
