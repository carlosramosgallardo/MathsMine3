-- ============================================================================
-- SECURITY UPGRADE — Fase A: bloquear ejecución de funciones a anon/authenticated
-- ============================================================================
-- Contexto: las 18 funciones SECURITY DEFINER del proyecto tenian EXECUTE para
-- los roles `anon` y `authenticated`. Como son SECURITY DEFINER, ejecutarlas
-- salta el RLS y toda la validacion que hacen las rutas API (rango de ataque,
-- posicion del boss, ventana de registro de disputas, etc.). Cualquiera con la
-- anon key publica podia invocarlas directamente via PostgREST/RPC.
--
-- Verificado en el codigo: NINGUN componente de navegador llama a estas
-- funciones. Todas se invocan solo desde rutas API con SUPABASE_SERVICE_ROLE_KEY
-- (service_role bypassa estos grants), asi que revocar anon/authenticated no
-- rompe ningun flujo de usuario.
--
-- Reversible: para deshacer, sustituir REVOKE por GRANT en cada linea.
-- ============================================================================

-- 1) Revocar EXECUTE a anon y authenticated en cada funcion (firmas exactas
--    tomadas del schema remoto) y concederlo explicitamente a service_role.

-- Bosses (m3 Putin / m4 Kim / m5 Trump comparten estas firmas)
REVOKE EXECUTE ON FUNCTION public.apply_mm3_boss_attack_player(text, integer, numeric, numeric, numeric, numeric, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_mm3_boss_attack_player(text, integer, numeric, numeric, numeric, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_mm3_boss_player_hit(text, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_mm3_boss_idle_if_requested(text) TO service_role;

-- PvP
REVOKE EXECUTE ON FUNCTION public.apply_mm3_pvp_hit(text, text, boolean, integer, numeric) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_mm3_pvp_hit(text, text, boolean, integer, numeric) TO service_role;

-- Disputas / squeeze
REVOKE EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_can_leave(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_cancel(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_join(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_resolve(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_start_battle(bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_dispute_vote(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeeze_nftji_take(bigint, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_squeezing_nftji_take(bigint, text) TO service_role;

-- Pools
REVOKE EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_max_wallets(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_pool_rank_from_level(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_pool_rank(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm3_refresh_all_pool_ranks() TO service_role;

-- Leaderboard (update_leaderboard es callable; trigger_update_leaderboard_fn es
-- trigger, el REVOKE es inocuo — el trigger se dispara por el owner de la tabla)
REVOKE EXECUTE ON FUNCTION public.update_leaderboard() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_leaderboard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_update_leaderboard_fn() FROM anon, authenticated;

-- 2) Cerrar el default privilege que reabria todo.
--    El proyecto tenia ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO
--    anon/authenticated, de modo que cada funcion nueva creada por `postgres`
--    en el schema `public` volvia a quedar ejecutable por anon. A partir de aqui
--    las funciones nuevas NO se conceden a anon/authenticated por defecto; hay
--    que darles GRANT EXECUTE explicito si en el futuro alguna debe ser publica.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
