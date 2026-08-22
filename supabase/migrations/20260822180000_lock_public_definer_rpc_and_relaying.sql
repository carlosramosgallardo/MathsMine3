-- ============================================================================
-- Close leftover PUBLIC EXECUTE on SECURITY DEFINER RPCs, allow relay events,
-- index unindexed FKs, and finish the anon write lockdown that never applied.
-- ============================================================================
-- Why previous locks failed: PostgreSQL grants EXECUTE to PUBLIC by default.
-- REVOKE FROM anon/authenticated does not remove {=X/postgres}, so
-- has_function_privilege('anon', ..., 'EXECUTE') stayed true. Confirmed live
-- 2026-08-22 via pg_proc.proacl.
--
-- Writes stay on Next.js API routes with SUPABASE_SERVICE_ROLE_KEY. Browser
-- clients only SELECT. redeem-penalty and pvp-anon-kill were switched to
-- service_role in the same change set so this REVOKE does not break them.
-- ============================================================================

-- 1) SECURITY DEFINER RPCs — revoke PUBLIC (and roles) , keep service_role.
REVOKE EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_leaderboard() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_leaderboard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) TO service_role;

-- 2) Stop new postgres functions from becoming public RPCs.
-- supabase_admin default privileges cannot be changed by the postgres role
-- used for migrations (ERROR 42501); postgres defaults are the ones that
-- apply to CREATE FUNCTION in this project.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- 3) Relay exec writes event_type = 'relaying' (bot tick + /api/relay/exec).
--    The check constraint never included it, so every relay event insert failed.
ALTER TABLE public.mm3_mining_events
  DROP CONSTRAINT IF EXISTS mm3_mining_events_event_type_check;
ALTER TABLE public.mm3_mining_events
  ADD CONSTRAINT mm3_mining_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'life_continue'::text,
    'nftji_claim'::text,
    'mining_buy'::text,
    'mining_resell'::text,
    'nftji_level_up'::text,
    'node_stormroll'::text,
    'rl_mount_buy'::text,
    'relaying'::text
  ]));

-- 4) Cover FKs that had no index (advisor: unindexed_foreign_keys).
CREATE INDEX IF NOT EXISTS idx_mm3_command_penalties_command_id
  ON public.mm3_command_penalties (command_id);
CREATE INDEX IF NOT EXISTS idx_mm3_pool_dispute_votes_dispute_id
  ON public.mm3_pool_dispute_votes (dispute_id);
CREATE INDEX IF NOT EXISTS idx_mm3_squeezing_launches_dispute_id
  ON public.mm3_squeezing_launches (dispute_id);

-- 5) Drop permissive write policies still live on 2026-08-22.
DROP POLICY IF EXISTS "public_insert_games" ON public.games;
DROP POLICY IF EXISTS "public_update_player_progress" ON public.player_progress;
DROP POLICY IF EXISTS "public_insert_mm3_sell_transactions" ON public.mm3_sell_transactions;
DROP POLICY IF EXISTS "public_insert_mm3_mining_events" ON public.mm3_mining_events;
DROP POLICY IF EXISTS "public_insert_mm3_relaying_messages" ON public.mm3_relaying_messages;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_presence" ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_update_mm3_wallet_presence" ON public.mm3_wallet_presence;
DROP POLICY IF EXISTS "public_insert_mm3_mining_commands" ON public.mm3_mining_commands;
DROP POLICY IF EXISTS "public_update_mm3_mining_commands" ON public.mm3_mining_commands;
DROP POLICY IF EXISTS "public_insert_mm3_command_penalties" ON public.mm3_command_penalties;
DROP POLICY IF EXISTS "public_update_mm3_command_penalties" ON public.mm3_command_penalties;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_invitations" ON public.mm3_wallet_pool_invitations;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pool_invitations" ON public.mm3_wallet_pool_invitations;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.games FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.player_progress FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_sell_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_mining_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_relaying_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_wallet_presence FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_mining_commands FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_command_penalties FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_wallet_pools FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_wallet_pool_members FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_wallet_pool_invitations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mm3_wallet_pool_cooldowns FROM anon, authenticated;

GRANT SELECT ON public.games TO anon, authenticated;
GRANT SELECT ON public.player_progress TO anon, authenticated;
GRANT SELECT ON public.mm3_sell_transactions TO anon, authenticated;
GRANT SELECT ON public.mm3_mining_events TO anon, authenticated;
GRANT SELECT ON public.mm3_relaying_messages TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_presence TO anon, authenticated;
GRANT SELECT ON public.mm3_mining_commands TO anon, authenticated;
GRANT SELECT ON public.mm3_command_penalties TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pools TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_members TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_invitations TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_cooldowns TO anon, authenticated;
