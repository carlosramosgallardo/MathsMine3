// Shared allowlist for routes that upsert into `player_progress` from a
// client-supplied object. Without this, a route that does
// `{ ...body.progress, wallet }` lets a caller set ANY column on the row
// (eur_earned, usd_earned, mining_nftji_key, lucky_*_claimed, ...) to any
// value — see the 2026-07 security audit. Only forward fields the calling
// route's own client code actually sends.
export const ALLOWED_PROGRESS_FIELDS = new Set([
  'level',
  'mm3_sold',
  'eur_earned',
  'usd_earned',
  'cny_earned',
  'sell_rate_cny',
  'sell_quote_cny',
  'sell_quote_eur',
  'sell_quote_usd',
  'updated_at',
]);

/** Drop any key not in ALLOWED_PROGRESS_FIELDS, then attach `wallet`. */
export function sanitizeProgressPayload(wallet, progress) {
  const payload = { wallet };
  for (const key of Object.keys(progress || {})) {
    if (ALLOWED_PROGRESS_FIELDS.has(key)) payload[key] = progress[key];
  }
  return payload;
}
