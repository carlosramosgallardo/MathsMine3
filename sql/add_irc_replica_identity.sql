-- Required for Supabase Realtime column-level filters on mm3_irc_messages.
-- Without FULL, filters like tone=eq.bot / tone=eq.market / tone=eq.realchain
-- are silently ignored and no realtime notifications are delivered.
ALTER TABLE mm3_irc_messages REPLICA IDENTITY FULL;
