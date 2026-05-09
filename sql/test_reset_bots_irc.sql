-- ============================================================
-- MM3 BOT IRC RESET
-- Deletes only the bots' chat messages from mm3_irc_messages.
-- Donations (realchain) and other users' messages are untouched.
-- Also forces the bots offline immediately and recreates the two test pools:
--   #FHNN6: bot F5528 + wallet E202
--   #8FR49: bot 44233 + wallet E8AB
-- ============================================================

DELETE FROM mm3_irc_messages
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
)
  AND  kind   = 'chat'
  AND  tone   IN ('neutral', 'bot');

DELETE FROM mm3_irc_messages
WHERE  wallet = 'system'
  AND  kind   = 'system'
  AND  tone   IN ('join', 'leave')
  AND (
    text ILIKE '%0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528%' OR
    text ILIKE '%0xd6c6c15060b27406d956c7e99e520cc810b44233%'
  );

UPDATE mm3_wallet_presence
SET    last_seen  = now() - interval '1 hour',
       updated_at = now()
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
);

-- Recreate deterministic bot test pools after test_reset_full.sql.
-- User wallets are inserted in player_progress if they do not exist yet so
-- ranking/squeeze can read them immediately after the reset.
INSERT INTO player_progress (wallet, is_bot, updated_at)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE,  NOW()),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', TRUE,  NOW()),
  ('0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', FALSE, NOW()),
  ('0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', FALSE, NOW())
ON CONFLICT (wallet) DO UPDATE
SET is_bot = EXCLUDED.is_bot,
    updated_at = NOW();

INSERT INTO leaderboard_data (wallet, total_eth, total_correct, total_games, highest_streak, current_streak, updated_at)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 0, 0, 0, 0, 0, NOW()),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', 0, 0, 0, 0, 0, NOW()),
  ('0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', 0, 0, 0, 0, 0, NOW()),
  ('0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', 0, 0, 0, 0, 0, NOW())
ON CONFLICT (wallet) DO UPDATE
SET updated_at = NOW();

DELETE FROM mm3_wallet_pool_invitations
WHERE  pool_code IN ('FHNN6', '8FR49')
   OR  wallet IN (
     '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
     '0xd6c6c15060b27406d956c7e99e520cc810b44233',
     '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
     '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
   )
   OR  invited_by IN (
     '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
     '0xd6c6c15060b27406d956c7e99e520cc810b44233',
     '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
     '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
   );

DELETE FROM mm3_wallet_pool_cooldowns
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
);

DELETE FROM mm3_wallet_pool_members
WHERE  pool_code IN ('FHNN6', '8FR49')
   OR  wallet IN (
     '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
     '0xd6c6c15060b27406d956c7e99e520cc810b44233',
     '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
     '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
   );

DELETE FROM mm3_wallet_pools
WHERE  pool_code IN ('FHNN6', '8FR49');

INSERT INTO mm3_wallet_pools (pool_code, created_by, updated_at)
VALUES
  ('FHNN6', '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', NOW()),
  ('8FR49', '0xd6c6c15060b27406d956c7e99e520cc810b44233', NOW())
ON CONFLICT (pool_code) DO UPDATE
SET created_by = EXCLUDED.created_by,
    updated_at = NOW();

INSERT INTO mm3_wallet_pool_members (wallet, pool_code, added_by)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 'FHNN6', '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'),
  ('0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', 'FHNN6', '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', '8FR49', '0xd6c6c15060b27406d956c7e99e520cc810b44233'),
  ('0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', '8FR49', '0xd6c6c15060b27406d956c7e99e520cc810b44233')
ON CONFLICT (wallet) DO UPDATE
SET pool_code = EXCLUDED.pool_code,
    added_by = EXCLUDED.added_by,
    joined_at = NOW();
