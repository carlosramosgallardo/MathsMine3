-- Add hidden command fields to mm3_podcast_pixels
-- Actual command values are set via .private/hidden-commands.seed.sql (not in git)
ALTER TABLE mm3_podcast_pixels
  ADD COLUMN IF NOT EXISTS hidden_command      TEXT    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hidden_cmd_min_level INTEGER NULL DEFAULT NULL;

-- Track daily executions of hidden commands (1x per wallet per pixel per UTC day)
CREATE TABLE IF NOT EXISTS mm3_hidden_cmd_executions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet      TEXT        NOT NULL,
  pixel_key   TEXT        NOT NULL REFERENCES mm3_podcast_pixels(pixel_key),
  amount_eur  NUMERIC     NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hidden_cmd_exec_lookup
  ON mm3_hidden_cmd_executions (wallet, pixel_key, executed_at);

-- RLS: anon can select/insert (consistent with player_progress pattern)
ALTER TABLE mm3_hidden_cmd_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hidden_cmd_exec_select_anon" ON mm3_hidden_cmd_executions
  FOR SELECT TO anon USING (true);

CREATE POLICY "hidden_cmd_exec_insert_anon" ON mm3_hidden_cmd_executions
  FOR INSERT TO anon WITH CHECK (true);

GRANT SELECT, INSERT ON public.mm3_hidden_cmd_executions TO anon;
