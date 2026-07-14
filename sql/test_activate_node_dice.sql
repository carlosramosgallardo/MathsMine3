-- ============================================================
-- TEST: activate the Node Dice (🎲 stormroll) without paying
-- Wallet shorthand: 0xc…528 → 0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528
-- Run in Supabase SQL editor (dev/staging only).
--
-- The dice lives on the mm3_macro_state singleton (id = 1): it is
-- active while node_dice_expires_at is in the future. This mirrors
-- what POST /api/node-dice writes, minus the 500 MM3 charge and the
-- level-30 gate. Mode: 'war' or 'meteo' — swap below to test both.
-- Note: while a global dice hour is running, the API re-derives the
-- mode from hash(wallet, hourStart) and ignores node_dice_mode.
-- ============================================================

UPDATE mm3_macro_state
SET
  node_dice_wallet         = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  node_dice_started_at     = NOW(),
  node_dice_expires_at     = NOW() + INTERVAL '24 hours',  -- shorten for quick tests, e.g. '15 minutes'
  node_dice_mode           = 'war',                        -- 'war' | 'meteo'
  node_dice_hour_start     = 0,
  -- Snapshot the current macro percents, like the API does on purchase.
  node_dice_war_percent    = COALESCE(war_percent, 0),
  node_dice_nature_percent = COALESCE(nature_percent, 0),
  updated_at               = NOW()
WHERE id = 1;

-- Optional: log the activation event like the API (visible in the event feed).
-- INSERT INTO mm3_mining_events (wallet, event_type, delta_mm3, emoji)
-- VALUES ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 'node_stormroll', 500, '🎲');

-- ── Verify ──────────────────────────────────────────────────
SELECT
  node_dice_wallet,
  node_dice_mode,
  node_dice_started_at,
  node_dice_expires_at,
  node_dice_expires_at > NOW() AS dice_active,
  node_dice_war_percent,
  node_dice_nature_percent
FROM mm3_macro_state
WHERE id = 1;

-- ── Teardown (deactivate the dice) ──────────────────────────
-- UPDATE mm3_macro_state
-- SET node_dice_wallet     = NULL,
--     node_dice_started_at = NULL,
--     node_dice_expires_at = NULL,
--     node_dice_mode       = NULL,
--     node_dice_hour_start = 0,
--     updated_at           = NOW()
-- WHERE id = 1;
