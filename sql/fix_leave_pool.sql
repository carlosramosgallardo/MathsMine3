BEGIN;

CREATE OR REPLACE FUNCTION public.mm3_leave_wallet_pool(p_wallet text)
RETURNS TABLE(wallet text, pool_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  DELETE FROM public.mm3_wallet_pool_members m
  WHERE lower(trim(m.wallet)) = lower(trim(p_wallet))
  RETURNING m.wallet, m.pool_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) TO anon;
GRANT EXECUTE ON FUNCTION public.mm3_leave_wallet_pool(text) TO authenticated;

COMMIT;