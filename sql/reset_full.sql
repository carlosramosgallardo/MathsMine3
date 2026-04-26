-- ============================================================
-- MM3 FULL RESET
-- Preserva fechas históricas; resetea todos los valores a 0
-- ============================================================

BEGIN;

-- 1. Recompensas de minado por partida a 0
-- token_value_timeseries es una vista CTE que agrega games.mining_reward
-- Poner a 0 aquí hace que el chart muestre 0 conservando todas las fechas
UPDATE games
SET    mining_reward = 0;

-- 2. Stats de minado por wallet: MM3 acumulado, partidas, rachas, rank
UPDATE leaderboard_data
SET    total_eth      = 0,
       total_correct  = 0,
       total_games    = 0,
       highest_streak = 0,
       current_streak = 0,
       rank           = NULL,
       updated_at     = now();

-- 3. Progreso de cada wallet: nivel, fondos, NFTmojis de mining y market
UPDATE player_progress
SET    level                  = 0,
       mm3_sold               = 0,
       eur_earned             = 0,
       usd_earned             = 0,
       cny_earned             = 0,
       wallet_emojis          = '{}'::text[],
       market_nftmoji_key     = NULL,
       market_nftmoji_price   = 0,
       market_nftmoji_since   = NULL,
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

-- 6. Historial de EXECs (drill slots vuelven a la base 100)
DELETE FROM mm3_sell_transactions;

-- 7. Eventos de market (compras, penalizaciones de PodcastBoard)
DELETE FROM mm3_market_events;

-- 8. Mensajes de usuario del chat IRC
DELETE FROM mm3_irc_messages
WHERE  kind = 'chat';

-- 9. Comisiones acumuladas de Trade
UPDATE mm3_market_state
SET    commission_mm3 = 0,
       commission_cny = 0,
       commission_eur = 0,
       commission_usd = 0,
       updated_at     = now()
WHERE  id = 1;

-- 10. NFTmojis de market: borra propiedad y compra en pixels
UPDATE mm3_podcast_pixels
SET    first_purchased_at = NULL,
       claimed_by         = NULL,
       claimed_source     = NULL,
       claimed_at         = NULL,
       paid_eur           = 0,
       paid_usd           = 0,
       paid_cny           = 0,
       updated_at         = now();

COMMIT;
