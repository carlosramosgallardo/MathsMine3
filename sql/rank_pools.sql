CREATE OR REPLACE FUNCTION public.mm3_pool_rank_from_level(p_level integer)
RETURNS TABLE(
  rank_key text,
  emoji text,
  rank_name text,
  rank_desc text,
  min_level integer,
  max_level integer
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT *
  FROM (
    VALUES
      ('node_swarm',     '🧟', 'NODE SWARM',     'Pool recién sincronizado; muchas wallets, poca potencia.', 0, 199),
      ('hash_coven',     '🕳️', 'HASH COVEN',     'Grupo estable que empieza a deformar el ranking.', 200, 3999),
      ('signal_cartel',  '🧲', 'SIGNAL CARTEL',  'Pool coordinado con fuerza real de ejecución.', 400, 599),
      ('void_syndicate', '🏴‍☠️', 'VOID SYNDICATE', 'Alianza peligrosa capaz de mover el mainframe.', 600, 799),
      ('dragon_mainnet', '🐉', 'DRAGON MAINNET', 'Pool élite; entidad dominante del ecosistema MM3.', 800, 9999)
  ) AS r(rank_key, emoji, rank_name, rank_desc, min_level, max_level)
  WHERE p_level BETWEEN r.min_level AND r.max_level
  LIMIT 1;
$$;