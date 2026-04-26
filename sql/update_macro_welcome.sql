-- ============================================================
-- MM3 MACRO STATE — Welcome message update
-- Run once in Supabase SQL editor (safe to re-run, idempotent)
-- ============================================================

UPDATE mm3_macro_state
SET
  ticker_message    = '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_en = '## WELCOME TO MATHSMINE3 ## SOLVE FAST, MINE MM3, FEED THE RETRO MAINFRAME ##',
  ticker_message_es = '## BIENVENIDO A MATHSMINE3 ## RESUELVE RAPIDO, MINA MM3 Y ALIMENTA EL MAINFRAME RETRO ##',
  updated_at        = now()
WHERE id = 1;
