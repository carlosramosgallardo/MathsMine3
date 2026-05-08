-- ============================================================
-- MM3 BOT IRC RESET
-- Deletes only the bots' chat messages from mm3_irc_messages.
-- Donations (realchain) and other users' messages are untouched.
-- Also forces the bots offline immediately.
-- ============================================================

DELETE FROM mm3_irc_messages
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
)
  AND  kind   = 'chat'
  AND  tone   IN ('neutral', 'bot');

UPDATE mm3_wallet_presence
SET    last_seen  = now() - interval '1 hour',
       updated_at = now()
WHERE  wallet IN (
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233'
);
