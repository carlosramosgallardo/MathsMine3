-- ============================================================================
-- SECURITY — Fase B: revoke anon direct writes on economy / progress tables
-- ============================================================================
-- Client apps (web bundle + Android APK) embed the public Supabase anon key.
-- Permissive INSERT/UPDATE policies let any holder impersonate any wallet.
-- All writes must go through Next.js API routes (service_role) with session auth.
-- ============================================================================

-- Drop permissive write policies
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

-- Revoke table-level grants (belt + suspenders; RLS policies alone are not enough
-- when a permissive policy exists — here we remove both).
REVOKE INSERT, UPDATE, DELETE ON public.games FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.player_progress FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_sell_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_mining_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_relaying_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_wallet_presence FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_mining_commands FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_command_penalties FROM anon, authenticated;

-- Keep public read access for leaderboard / IRC history / portal UI.
GRANT SELECT ON public.games TO anon, authenticated;
GRANT SELECT ON public.player_progress TO anon, authenticated;
GRANT SELECT ON public.mm3_sell_transactions TO anon, authenticated;
GRANT SELECT ON public.mm3_mining_events TO anon, authenticated;
GRANT SELECT ON public.mm3_relaying_messages TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_presence TO anon, authenticated;
GRANT SELECT ON public.mm3_mining_commands TO anon, authenticated;
GRANT SELECT ON public.mm3_command_penalties TO anon, authenticated;
