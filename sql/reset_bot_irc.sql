-- ============================================================
-- MM3 BOT IRC RESET
-- Borra solo los mensajes de chat del bot en mm3_irc_messages.
-- Los mensajes de otros usuarios, donaciones (realchain) y
-- mensajes de sistema NO se tocan.
-- ============================================================

DELETE FROM mm3_irc_messages
WHERE  wallet = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528'
  AND  kind   = 'chat'
  AND  tone   IN ('neutral', 'bot');

-- Forzar offline al bot inmediatamente
UPDATE mm3_wallet_presence
SET    last_seen  = now() - interval '1 hour',
       updated_at = now()
WHERE  wallet = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528';
