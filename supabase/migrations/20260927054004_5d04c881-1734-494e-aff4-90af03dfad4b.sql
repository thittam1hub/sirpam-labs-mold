CREATE OR REPLACE FUNCTION public.get_credit_status()
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); b int; used int;
BEGIN
  PERFORM ensure_credit_account();
  SELECT balance INTO b FROM credit_balances WHERE user_id = uid;
  SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = date_trunc('month', now())::date;
  RETURN json_build_object('balance', b, 'monthlyFreeLeft', greatest(0, 3 - coalesce(used, 0)), 'monthlyFreeLimit', 3);
END $function$;

CREATE OR REPLACE FUNCTION public.spend_credits(_action text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); cost int; b int; used int; freeLeft int; fromFree int; fromPaid int;
  m date := date_trunc('month', now())::date;
BEGIN
  PERFORM ensure_credit_account();
  cost := CASE _action
    WHEN 'export_stl' THEN 1 WHEN 'export_obj' THEN 1
    WHEN 'export_3mf' THEN 2 WHEN 'export_step' THEN 2
    WHEN 'pro_features' THEN 3 WHEN 'ai_shape' THEN 3
    WHEN 'auto_repair' THEN 2 WHEN 'mold_report' THEN 1
    ELSE NULL END;
  IF cost IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;

  SELECT balance INTO b FROM credit_balances WHERE user_id = uid FOR UPDATE;
  INSERT INTO monthly_usage(user_id, month) VALUES (uid, m) ON CONFLICT DO NOTHING;
  SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = m FOR UPDATE;
  freeLeft := greatest(0, 3 - used);
  fromFree := least(freeLeft, cost);
  fromPaid := cost - fromFree;

  IF b < fromPaid THEN
    RETURN json_build_object('ok', false, 'charged', 0, 'needed', cost, 'balance', b, 'monthlyFreeLeft', freeLeft);
  END IF;
  IF fromFree > 0 THEN
    UPDATE monthly_usage SET free_exports = free_exports + fromFree WHERE user_id = uid AND month = m;
    INSERT INTO credit_ledger(user_id, delta, reason, reference) VALUES (uid, -fromFree, _action, 'monthly_free');
  END IF;
  IF fromPaid > 0 THEN
    UPDATE credit_balances SET balance = balance - fromPaid, updated_at = now() WHERE user_id = uid;
    INSERT INTO credit_ledger(user_id, delta, reason) VALUES (uid, -fromPaid, _action);
  END IF;
  RETURN json_build_object('ok', true, 'charged', cost, 'fromFree', fromFree, 'balance', b - fromPaid, 'monthlyFreeLeft', freeLeft - fromFree);
END $function$;