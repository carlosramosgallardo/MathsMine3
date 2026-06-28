-- Store the first chain_index used by formula auto-mine, so demine can
-- preserve blocks mined before the formula solve.
ALTER TABLE mm3_macro_state
  ADD COLUMN IF NOT EXISTS formula_chain_index_start integer;
