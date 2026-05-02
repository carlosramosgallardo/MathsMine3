-- ============================================================
-- MM3 WALLET POOLS / CONTACTS
-- Incremental migration for existing Supabase instances.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mm3_wallet_pools (
  pool_code TEXT PRIMARY KEY CHECK (pool_code ~ '^[A-Z0-9]{5}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mm3_wallet_pool_members (
  wallet TEXT PRIMARY KEY,
  pool_code TEXT NOT NULL REFERENCES public.mm3_wallet_pools(pool_code) ON DELETE CASCADE,
  added_by TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mm3_wallet_pool_members_pool_code
  ON public.mm3_wallet_pool_members(pool_code);

ALTER TABLE public.mm3_wallet_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm3_wallet_pool_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pools" ON public.mm3_wallet_pools;
DROP POLICY IF EXISTS "public_update_mm3_wallet_pools" ON public.mm3_wallet_pools;
CREATE POLICY "public_read_mm3_wallet_pools" ON public.mm3_wallet_pools FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_wallet_pools" ON public.mm3_wallet_pools FOR INSERT TO anon WITH CHECK (pool_code <> '' AND created_by <> '');
CREATE POLICY "public_update_mm3_wallet_pools" ON public.mm3_wallet_pools FOR UPDATE TO anon USING (true) WITH CHECK (pool_code <> '' AND created_by <> '');

DROP POLICY IF EXISTS "public_read_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members;
DROP POLICY IF EXISTS "public_insert_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members;
CREATE POLICY "public_read_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_wallet_pool_members" ON public.mm3_wallet_pool_members FOR INSERT TO anon WITH CHECK (wallet <> '' AND pool_code <> '' AND added_by <> '');

GRANT SELECT, INSERT, UPDATE ON public.mm3_wallet_pools TO anon;
GRANT SELECT, INSERT ON public.mm3_wallet_pool_members TO anon;

COMMIT;
