-- Read-only Training farming snapshot for the SQL editor (postgres / service role).
-- Not a migration. Does not replace tools/balance/farming.py (CI still uses JSON).
-- Columns must stay in sync with farming.load_supabase().

SELECT
  wallet,
  is_correct,
  time_ms,
  created_at,
  difficulty
FROM games
ORDER BY created_at DESC
LIMIT 4000;

SELECT
  wallet,
  level,
  is_bot
FROM player_progress;
