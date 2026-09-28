REVOKE EXECUTE ON FUNCTION public.record_purchase(uuid, text, numeric, text, text, text, text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, text, numeric, text, text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_refund_purchase(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_purchases(text) FROM anon, public;