-- ============================================================================
-- SECURITY — Fase B (extension): revoke anon direct writes on wallet pools
-- ============================================================================
-- Pool create/join/invite flows go through Next.js API routes with session
-- auth + service_role. Permissive INSERT/UPDATE policies on these tables let
-- any anon-key holder bypass API validation.
-- ============================================================================

DROP POLICY IF EXISTS "public_insert_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_invitations" ON public.mm3_wallet_pool_invitations;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pool_invitations" ON public.mm3_wallet_pool_invitations;

REVOKE INSERT, UPDATE, DELETE ON public.mm3_wallet_pools FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_wallet_pool_members FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_wallet_pool_invitations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mm3_wallet_pool_cooldowns FROM anon, authenticated;

GRANT SELECT ON public.mm3_wallet_pools TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_members TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_invitations TO anon, authenticated;
GRANT SELECT ON public.mm3_wallet_pool_cooldowns TO anon, authenticated;
