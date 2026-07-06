-- ============================================================
-- TEST: RL car (coche) for bot F5528 — boss fight on M5
-- Wallet shorthand: 0xc…528 → 0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528
-- Run in Supabase SQL editor (dev/staging only).
-- ============================================================

-- Ensure bot row exists and grant RL mount (Octane car on M2+ maps).
INSERT INTO player_progress (wallet, is_bot, level, rl_mount_active, updated_at)
VALUES ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE, 10, TRUE, NOW())
ON CONFLICT (wallet) DO UPDATE SET
  is_bot          = TRUE,
  level           = GREATEST(player_progress.level, 10),
  rl_mount_active = TRUE,
  updated_at      = NOW();

-- Revive / full HP so the bot can enter a boss fight immediately.
INSERT INTO mm3_pvp_health (wallet, health, pvp_dead_until, updated_at)
VALUES ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 100, NULL, NOW())
ON CONFLICT (wallet) DO UPDATE SET
  health         = 100,
  pvp_dead_until = NULL,
  pvp_dead_gx    = NULL,
  pvp_dead_gy    = NULL,
  updated_at     = NOW();

-- Optional: reset Donald Trump boss to idle for a clean fight.
-- UPDATE mm3_map_boss
-- SET state = 'idle', health = max_health, damage_totals = '{}'::jsonb, updated_at = NOW()
-- WHERE id = 'm5_trump';

-- ── Verify ──────────────────────────────────────────────────
SELECT
  pp.wallet,
  pp.is_bot,
  pp.level,
  pp.rl_mount_active AS car_active,
  ph.health,
  ph.pvp_dead_until,
  b.state  AS boss_state,
  b.health AS boss_health
FROM player_progress pp
LEFT JOIN mm3_pvp_health ph ON ph.wallet = pp.wallet
CROSS JOIN mm3_map_boss b
WHERE pp.wallet = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'
  AND b.id = 'm5_trump';

-- ── Teardown (undo car grant) ───────────────────────────────
-- UPDATE player_progress
-- SET rl_mount_active = FALSE, updated_at = NOW()
-- WHERE wallet = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528';
