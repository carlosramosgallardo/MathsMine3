-- ============================================================
-- MM3 BOT FLAGS — add or remove
-- Run the relevant block in Supabase SQL editor.
-- ============================================================

-- ADD: mark wallets as bots (upserts rows if missing)
INSERT INTO player_progress (wallet, is_bot, updated_at)
VALUES
  ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE, NOW()),
  ('0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', TRUE, NOW()),
  ('0xd6c6c15060b27406d956c7e99e520cc810b44233', TRUE, NOW()),
  ('0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', TRUE, NOW())
ON CONFLICT (wallet) DO UPDATE SET is_bot = TRUE, updated_at = NOW();

-- DELETE (comment out ADD above and uncomment this instead):
-- UPDATE player_progress
-- SET    is_bot     = FALSE,
--        updated_at = NOW()
-- WHERE  wallet IN (
--   '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
--   '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
--   '0xd6c6c15060b27406d956c7e99e520cc810b44233',
--   '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab'
-- );
