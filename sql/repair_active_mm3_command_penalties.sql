-- ============================================================
-- MATHSMINE3 — repair active MM3 Market command penalties
--
-- Use after a /mm3 Market command was launched before the MM3
-- penalty logic allowed negative available MM3.
--
-- For each active MM3-family command, this:
--   - finds every affected player_progress wallet
--   - skips the launcher and wallets holding the same NFTJI
--   - skips penalties already present for that command/wallet
--   - increases mm3_sold by the block price, making MM3 negative if needed
--   - inserts the redeemable mm3_command_penalties row
--
-- Hidden command strings are intentionally not included here.
-- ============================================================

BEGIN;

WITH mm3_commands AS (
  SELECT
    c.id AS command_id,
    lower(c.wallet) AS launcher_wallet,
    c.nftji_key,
    c.numeric_code,
    c.reset_at,
    b.price_eur,
    b.emoji,
    b.title_en
  FROM public.mm3_market_commands c
  JOIN public.mm3_market_blocks b ON b.block_key = c.nftji_key
  WHERE c.nftji_key IN (
    'mm3-01d',
    'mm3-04a',
    'mm3-091',
    'mm3-0f8',
    'mm3-15c',
    'mm3-1a6',
    'mm3-20b',
    'mm3-29b',
    'mm3-2da',
    'mm3-2f9'
  )
    AND c.reset_at > NOW()
),
affected AS (
  SELECT
    lower(p.wallet) AS wallet,
    mc.command_id,
    mc.nftji_key,
    mc.numeric_code,
    mc.reset_at,
    mc.price_eur,
    mc.emoji,
    mc.title_en
  FROM mm3_commands mc
  JOIN public.player_progress p
    ON lower(p.wallet) <> mc.launcher_wallet
  WHERE COALESCE(p.market_nftji_key, '') <> mc.nftji_key
    AND NOT EXISTS (
      SELECT 1
      FROM public.mm3_command_penalties existing
      WHERE existing.command_id = mc.command_id
        AND lower(existing.wallet) = lower(p.wallet)
    )
),
updated AS (
  UPDATE public.player_progress p
  SET mm3_sold = COALESCE(p.mm3_sold, 0) + affected.price_eur,
      updated_at = NOW()
  FROM affected
  WHERE lower(p.wallet) = affected.wallet
  RETURNING
    affected.wallet,
    affected.command_id,
    affected.nftji_key,
    affected.numeric_code,
    affected.reset_at,
    affected.price_eur,
    affected.emoji,
    affected.title_en
)
INSERT INTO public.mm3_command_penalties (
  wallet,
  command_id,
  nftji_key,
  penalty_code,
  penalty_value,
  penalty_eur,
  reason,
  reset_at
)
SELECT
  wallet,
  command_id,
  nftji_key,
  numeric_code,
  price_eur,
  0,
  CONCAT(COALESCE(emoji, ''), ' ', COALESCE(title_en, nftji_key)),
  reset_at
FROM updated;

COMMIT;
