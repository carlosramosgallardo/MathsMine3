-- ============================================================================
-- SECURITY UPGRADE — Fase A (retomada) — lock the functions 20260707150000
-- meant to lock, using the REAL signatures confirmed live on 2026-07-26.
-- ============================================================================
-- 20260707150000_security_lock_functions.sql was written and committed on
-- 2026-07-07 but was NEVER actually run against this project — verified by
-- querying pg_proc/has_function_privilege() directly against the live DB.
-- Two of its targets (apply_mm3_boss_attack_player, apply_mm3_pvp_hit) ended
-- up locked to service_role anyway via other means, but the other 17 stayed
-- wide open to anon/authenticated the whole time. This migration re-does the
-- job with the actual current signatures (apply_mm3_boss_attack_player grew
-- an 8th arg, p_storm_active, in 20260707160000 — the old 7-arg REVOKE in
-- 20260707150000 now fails with "function does not exist").
--
-- Verified via:
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid), ...
--   FROM pg_proc p ... WHERE has_function_privilege(role, p.oid, 'EXECUTE')
--
-- Reversible: to undo, swap REVOKE for GRANT on each line.
-- ============================================================================

-- Bosses — still open (attack_player + pvp_hit are already service_role-only,
-- left untouched here).
REVOKE EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) TO service_role;

-- Disputes / squeeze
REVOKE EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) TO service_role;

-- Pools
REVOKE EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() TO service_role;

-- Leaderboard
REVOKE EXECUTE ON FUNCTION public.update_leaderboard() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_leaderboard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn() FROM anon, authenticated;

-- Close the default privilege that reopens every newly created function to
-- anon/authenticated. Safe to re-run even if 20260707150000 partially applied
-- this already (ALTER DEFAULT PRIVILEGES is idempotent).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
