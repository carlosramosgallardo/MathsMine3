-- ============================================================
-- MATHSMINE3 — Add 10 MM3-priced Market NFTJIs
--
-- Safe migration for an existing Supabase instance.
-- Adds the hidden execution audit table if missing, then upserts
-- the public MM3 Market block family metadata.
--
-- Hidden command strings intentionally live outside git:
--   .private/hidden-commands.seed.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mm3_hidden_cmd_executions (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  block_key TEXT NOT NULL,
  amount_eur NUMERIC NOT NULL DEFAULT 0,
  amount_mm3 NUMERIC NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.mm3_hidden_cmd_executions
  ADD COLUMN IF NOT EXISTS amount_mm3 NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.mm3_market_blocks
  ADD COLUMN IF NOT EXISTS hidden_command TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hidden_cmd_min_level INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mm3_hidden_cmd_executions_wallet_block
  ON public.mm3_hidden_cmd_executions(wallet, block_key, executed_at DESC);

INSERT INTO public.mm3_market_blocks (
  block_key,
  grid_row,
  grid_col,
  emoji,
  title_en,
  title_es,
  answer_hash,
  price_eur,
  short_url,
  is_active
)
VALUES
  ('mm3-01d', 1,  1,  '🛸', 'Orbit Siphon',    'Sifón Orbital',      '', 1,   NULL, TRUE),
  ('mm3-04a', 2,  18, '🗝️', 'Key Vault',       'Bóveda Llave',       '', 3,   NULL, TRUE),
  ('mm3-091', 5,  5,  '🛡️', 'Shield Fork',     'Bifurcación Escudo', '', 5,   NULL, TRUE),
  ('mm3-0f8', 8,  24, '🧨', 'Fuse Packet',     'Paquete Mecha',      '', 7,   NULL, TRUE),
  ('mm3-15c', 12, 12, '🪙', 'Coin Kernel',     'Kernel Moneda',      '', 10,  NULL, TRUE),
  ('mm3-1a6', 15, 2,  '🧰', 'Toolchain Cache', 'Caché Toolchain',    '', 15,  NULL, TRUE),
  ('mm3-20b', 18, 19, '🪬', 'Mirror Charm',    'Amuleto Espejo',     '', 25,  NULL, TRUE),
  ('mm3-29b', 23, 23, '🪞', 'Reflector Gate',  'Puerta Reflector',   '', 50,  NULL, TRUE),
  ('mm3-2da', 26, 2,  '🔋', 'Battery Node',    'Nodo Batería',       '', 75,  NULL, TRUE),
  ('mm3-2f9', 27, 5,  '🎛️', 'Mixer Console',   'Consola Mixer',      '', 100, NULL, TRUE)
ON CONFLICT (block_key) DO UPDATE SET
  grid_row   = EXCLUDED.grid_row,
  grid_col   = EXCLUDED.grid_col,
  emoji      = EXCLUDED.emoji,
  title_en   = EXCLUDED.title_en,
  title_es   = EXCLUDED.title_es,
  answer_hash = EXCLUDED.answer_hash,
  price_eur  = EXCLUDED.price_eur,
  short_url  = COALESCE(public.mm3_market_blocks.short_url, EXCLUDED.short_url),
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

ALTER TABLE IF EXISTS public.mm3_hidden_cmd_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_mm3_hidden_cmd_executions" ON public.mm3_hidden_cmd_executions;
DROP POLICY IF EXISTS "public_insert_mm3_hidden_cmd_executions" ON public.mm3_hidden_cmd_executions;
CREATE POLICY "public_read_mm3_hidden_cmd_executions" ON public.mm3_hidden_cmd_executions FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_mm3_hidden_cmd_executions" ON public.mm3_hidden_cmd_executions FOR INSERT TO anon WITH CHECK (wallet <> '' AND block_key <> '');

GRANT SELECT, INSERT ON public.mm3_hidden_cmd_executions TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

COMMIT;
