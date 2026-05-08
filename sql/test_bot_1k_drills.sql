-- ============================================================
-- TEST: Give each bot 1000 drills for the next tick
-- How it works:
--   drillsTotal = DAILY_MINE_BASE(100) + COUNT(sell_transactions)
--   drillsLeft  = drillsTotal - COUNT(games today)
--   Target: drillsLeft = 1000  →  need totalExecs = 900 (if clean env)
--
-- Cleanup: run test_reset_full.sql when done (deletes sell_transactions).
-- ============================================================

BEGIN;

-- 1. Delete today's bot games so drillsLeft resets to drillsTotal
DELETE FROM games
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
)
  AND  created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

-- 2. Reset today's daily claims so the bots can reclaim all tasks
DELETE FROM daily_task_claims
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
)
  AND  day    = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

-- 3. Insert dummy sell_transactions to reach drillsTotal = 1000
--    (900 rows × zero values — only the row count matters for the formula)
--    generate_series stops at 0 for each bot that already has ≥900 transactions.
INSERT INTO mm3_sell_transactions (
  wallet, source, level,
  mm3_amount, mm3_commission, rate_cny,
  gross_cny, gross_eur, gross_usd,
  commission_rate, commission_cny, commission_eur, commission_usd,
  net_cny, net_eur, net_usd
)
SELECT
  bots.wallet, 'wallet', 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0
FROM (
  VALUES
    ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'),
    ('0xd6c6c15060b27406d956c7e99e520cc810b44233')
) AS bots(wallet)
CROSS JOIN LATERAL generate_series(
  1,
  GREATEST(0, 900 - (
    SELECT COUNT(*)::int
    FROM mm3_sell_transactions
    WHERE wallet = bots.wallet
  ))
) AS _;

-- Verify
SELECT
  bots.wallet,
  (SELECT COUNT(*) FROM games
   WHERE wallet = bots.wallet
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS games_today,
  (SELECT COUNT(*) FROM mm3_sell_transactions
   WHERE wallet = bots.wallet) AS total_execs,
  100 + (SELECT COUNT(*) FROM mm3_sell_transactions
         WHERE wallet = bots.wallet) AS drills_total
FROM (
  VALUES
    ('0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'),
    ('0xd6c6c15060b27406d956c7e99e520cc810b44233')
) AS bots(wallet);

COMMIT;
