-- ============================================================
-- RESET: MM3 BLOCK CHAIN COMPLETED STATE
-- Deja la chain al 0% como si nadie hubiera minado nunca.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

BEGIN;

-- 1. Borrar todos los bloques minados
DELETE FROM mm3_mined_blocks;

-- 2. Resetear modo demine + ticker en macro_state
UPDATE mm3_macro_state
SET
  chain_demine_active          = FALSE,
  chain_demine_hits_remaining  = 100,
  ticker_message    = '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_en = '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_es = '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##',
  updated_at        = NOW()
WHERE id = 1;

-- 3. Resetear block_chain_percent de todos los jugadores a 0
UPDATE player_progress
SET block_chain_percent = 0,
    updated_at          = NOW();

-- 4. Limpiar registro de solvers (para poder volver a resolver la fórmula)
DELETE FROM mm3_chain_solvers;

-- 5. Limpiar intentos de fórmula (para que las wallets puedan intentar de nuevo)
DELETE FROM mm3_chain_solve_attempts;

-- 6. Limpiar winner legacy (por si existe de antes)
DELETE FROM mm3_game_winner;

-- 7. Verificación
SELECT
  'mm3_mined_blocks'       AS tabla, COUNT(*) AS filas FROM mm3_mined_blocks
UNION ALL
SELECT 'mm3_chain_solvers',           COUNT(*) FROM mm3_chain_solvers
UNION ALL
SELECT 'mm3_chain_solve_attempts',    COUNT(*) FROM mm3_chain_solve_attempts
UNION ALL
SELECT 'mm3_game_winner',             COUNT(*) FROM mm3_game_winner;

SELECT
  chain_demine_active,
  chain_demine_hits_remaining,
  ticker_message
FROM mm3_macro_state
WHERE id = 1;

COMMIT;
