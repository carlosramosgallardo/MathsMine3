-- ============================================================
-- MM3 BOT FLAG — add or remove
-- Run the relevant block in Supabase SQL editor.
-- ============================================================

-- ADD: mark wallet as bot (upserts the row if missing)
INSERT INTO player_progress (wallet, is_bot, updated_at)
VALUES ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE, NOW())
ON CONFLICT (wallet) DO UPDATE SET is_bot = TRUE, updated_at = NOW();

-- DELETE (comment out ADD above and uncomment this instead):
-- UPDATE player_progress
-- SET    is_bot     = FALSE,
--        updated_at = NOW()
-- WHERE  wallet = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528';
