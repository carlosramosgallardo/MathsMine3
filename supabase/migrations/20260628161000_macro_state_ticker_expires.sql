ALTER TABLE mm3_macro_state
  ADD COLUMN IF NOT EXISTS ticker_message_expires_at timestamptz;
