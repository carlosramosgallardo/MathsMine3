-- Add is_bot flag to player_progress and mark bot wallet
ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO player_progress (wallet, is_bot)
VALUES ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', TRUE)
ON CONFLICT (wallet) DO UPDATE SET is_bot = TRUE;
