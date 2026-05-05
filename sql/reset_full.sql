-- ============================================================
-- MM3 FULL RESET
-- Resetea valores, mining, drills, market, trade e IRC
-- ============================================================

BEGIN;

-- 0. Desactivar triggers durante el reset para evitar efectos secundarios
SET session_replication_role = replica;

-- 1. Reset real de Mining y Drill Slots
-- Los DRILL SLOTS se calculan a partir de las partidas existentes en games.
-- Para que todas las wallets vuelvan a 100/100, hay que borrar las partidas.
DELETE FROM games;

-- Reactivar triggers
SET session_replication_role = DEFAULT;

-- 2. Stats de minado por wallet: MM3 acumulado, partidas, rachas, rank
UPDATE leaderboard_data
SET    total_eth      = 0,
       total_correct  = 0,
       total_games    = 0,
       highest_streak = 0,
       current_streak = 0,
       rank           = NULL,
       updated_at     = now();

-- 3. Progreso de cada wallet: nivel, fondos, NTFJIs de mining y market
UPDATE player_progress
SET    level                  = 0,
       mm3_sold               = 0,
       eur_earned             = 0,
       usd_earned             = 0,
       cny_earned             = 0,
       wallet_emojis          = '{}'::text[],
       market_nftji_key     = NULL,
       market_nftji_price   = 0,
       market_nftji_since   = NULL,
       life_used              = false,
       lucky_50_claimed       = false,
       lucky_100_claimed      = false,
       lucky_500_claimed      = false,
       lucky_1000_claimed     = false,
       sell_rate_cny          = 0,
       sell_quote_cny         = 0,
       sell_quote_eur         = 0,
       sell_quote_usd         = 0,
       updated_at             = now();

-- 4. Comandos de market activos
DELETE FROM mm3_market_commands;

-- 5. Penalizaciones activas y ya redimidas
DELETE FROM mm3_command_penalties;
DELETE FROM mm3_hidden_cmd_executions;
DELETE FROM daily_task_claims;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_dispute_wallets' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_pool_dispute_wallets';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_dispute_votes' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_pool_dispute_votes';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_pool_disputes' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_pool_disputes';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_members' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_wallet_pool_members';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_invitations' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_wallet_pool_invitations';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pools' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_wallet_pools';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relname = 'mm3_wallet_pool_cooldowns' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DELETE FROM mm3_wallet_pool_cooldowns';
  END IF;
END$$;

-- 6. Historial de EXECs
-- Si quieres que los drills vuelvan exactamente a 100/100 y no a 100+EXECs,
-- también hay que borrar los EXECs.
DELETE FROM mm3_sell_transactions;

-- 7. Eventos de market
DELETE FROM mm3_market_events;

-- 8. Mensajes del chat IRC
-- EXCLUDED: Comentado para preservar donaciones incluso después de reset
-- Las donaciones con "Self injection" o "Donation detected" se mantienen persistentes
-- DELETE FROM mm3_irc_messages;

-- 9. Comisiones acumuladas de Trade
UPDATE mm3_market_state
SET    commission_mm3 = 0,
       commission_cny = 0,
       commission_eur = 0,
       commission_usd = 0,
       updated_at     = now()
WHERE  id = 1;

-- 9b. Modificadores del mundo: ⚔️ guerra y 🌪️ meteo
UPDATE mm3_macro_state
SET    war_percent    = 75,
       nature_percent = 65,
       updated_at     = now()
WHERE  id = 1;

-- 10. NTFJIs de market: borra propiedad y compra en blocks
UPDATE mm3_market_blocks
SET    first_purchased_at = NULL,
       claimed_by         = NULL,
       claimed_source     = NULL,
       claimed_at         = NULL,
       paid_eur           = 0,
       paid_usd           = 0,
       paid_cny           = 0,
       updated_at         = now();

COMMIT;
