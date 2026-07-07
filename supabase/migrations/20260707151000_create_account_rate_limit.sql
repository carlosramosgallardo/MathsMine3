-- ============================================================================
-- SECURITY UPGRADE — Fase B: rate-limit persistente para create-account
-- ============================================================================
-- El limitador de create-account vivia en un Map en memoria del proceso, que se
-- reinicia en cada cold start de la funcion serverless. En la practica no limita
-- nada: basta esperar (o forzar) un nuevo contenedor para resetear el contador.
-- Lo movemos a una tabla para que el limite (N cuentas nuevas por IP y dia) sea
-- real y compartido entre instancias.
--
-- La tabla solo la toca la ruta API con service_role. No se concede a anon.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mm3_account_creation_log (
  ip          text        NOT NULL,
  day         date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count       integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, day)
);

ALTER TABLE public.mm3_account_creation_log ENABLE ROW LEVEL SECURITY;
-- Sin politicas => anon/authenticated no pueden leer ni escribir.
-- service_role bypassa RLS, que es el unico rol que la usa.
REVOKE ALL ON TABLE public.mm3_account_creation_log FROM anon, authenticated;

-- Incrementa y devuelve el contador del dia para una IP de forma atomica.
-- Devuelve el nuevo total tras sumar 1. La ruta decide si excede el limite.
CREATE OR REPLACE FUNCTION public.mm3_bump_account_creation(p_ip text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.mm3_account_creation_log (ip, day, count, updated_at)
  VALUES (p_ip, (now() AT TIME ZONE 'utc')::date, 1, now())
  ON CONFLICT (ip, day) DO UPDATE
    SET count = public.mm3_account_creation_log.count + 1,
        updated_at = now()
  RETURNING count;
$$;

-- Solo service_role puede llamarla (coherente con la Fase A).
REVOKE ALL ON FUNCTION public.mm3_bump_account_creation(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm3_bump_account_creation(text) TO service_role;
