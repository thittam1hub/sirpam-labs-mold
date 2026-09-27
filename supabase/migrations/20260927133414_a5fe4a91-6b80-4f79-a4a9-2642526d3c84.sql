DROP TABLE IF EXISTS public.quote_requests;

REVOKE ALL ON FUNCTION public.ensure_credit_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_credit_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_status() TO authenticated;
REVOKE ALL ON FUNCTION public.spend_credits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(text) TO authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text) TO service_role;