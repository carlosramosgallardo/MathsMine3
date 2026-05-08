-- ============================================================
-- MM3 FULL TEST RESET
-- Resets all game state. Preserves:
--   · math_problems (mining question bank)
--   · mm3_hidden_cmd_executions (hidden command history)
--   · mm3_market_blocks definitions (only resets ownership)
-- Run manually in Supabase SQL editor.
-- ============================================================

BEGIN;

-- Disable triggers to avoid leaderboard side-effects
SET session_replication_role = replica;

-- 1. Mining game log
DELETE FROM games;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- 2. Leaderboard
UPDATE leaderboard_data
SET    total_eth      = 0,
       total_correct  = 0,
       total_games    = 0,
       highest_streak = 0,
       current_streak = 0,
       rank           = NULL,
       updated_at     = now();

-- 3. Player progress: full wipe including nftji levels
UPDATE player_progress
SET    level                = 0,
       mm3_sold             = 0,
       eur_earned           = 0,
       usd_earned           = 0,
       cny_earned           = 0,
       wallet_emojis        = '{}'::text[],
       market_nftji_key     = NULL,
       market_nftji_price   = 0,
       market_nftji_since   = NULL,
       life_used            = false,
       lucky_50_claimed     = false,
       lucky_100_claimed    = false,
       lucky_500_claimed    = false,
       lucky_1000_claimed   = false,
       lucky_50_level       = -1,
       lucky_100_level      = -1,
       lucky_500_level      = -1,
       lucky_1000_level     = -1,
       market_nftji_levels  = '{}'::jsonb,
       sell_rate_cny        = 0,
       sell_quote_cny       = 0,
       sell_quote_eur       = 0,
       sell_quote_usd       = 0,
       updated_at           = now();

-- 4. Daily task claims
DELETE FROM daily_task_claims;

-- 5. Market commands and penalties
DELETE FROM mm3_market_commands;
DELETE FROM mm3_command_penalties;

-- 6. Pool / dispute state
DELETE FROM mm3_pool_dispute_wallets;
DELETE FROM mm3_pool_dispute_votes;
DELETE FROM mm3_pool_disputes;
DELETE FROM mm3_wallet_pool_members;
DELETE FROM mm3_wallet_pool_invitations;
DELETE FROM mm3_wallet_pools;
DELETE FROM mm3_wallet_pool_cooldowns;
DELETE FROM mm3_squeeze_nftji;

-- 7. Trade history and market events
DELETE FROM mm3_sell_transactions;
DELETE FROM mm3_market_events;

-- 8. IRC messages
DELETE FROM mm3_irc_messages;

-- 9. Trade commission pool
UPDATE mm3_market_state
SET    commission_mm3 = 0,
       commission_cny = 0,
       commission_eur = 0,
       commission_usd = 0,
       updated_at     = now()
WHERE  id = 1;

-- 10. World modifiers
UPDATE mm3_macro_state
SET    war_percent    = 75,
       nature_percent = 65,
       updated_at     = now()
WHERE  id = 1;

-- 11. Market block ownership (keeps definitions, prices, commands)
UPDATE mm3_market_blocks
SET    first_purchased_at = NULL,
       claimed_by         = NULL,
       claimed_source     = NULL,
       claimed_at         = NULL,
       paid_eur           = 0,
       paid_usd           = 0,
       paid_cny           = 0,
       updated_at         = now();

-- 12. Force all wallets offline
UPDATE mm3_wallet_presence
SET    last_seen  = now() - interval '1 hour',
       updated_at = now();

-- 13. Re-seed bot wallet flags (survives progress reset)
INSERT INTO player_progress (wallet, is_bot, updated_at)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE, NOW()),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', TRUE, NOW())
ON CONFLICT (wallet) DO UPDATE SET is_bot = TRUE, updated_at = NOW();

COMMIT;
