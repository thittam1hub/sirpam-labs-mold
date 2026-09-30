CREATE TABLE public.credit_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT ALL ON public.credit_balances TO service_role;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own balance readable" ON public.credit_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX credit_ledger_reference_uq ON public.credit_ledger(reference) WHERE reference IS NOT NULL;
CREATE INDEX credit_ledger_user_idx ON public.credit_ledger(user_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ledger readable" ON public.credit_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.monthly_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  free_exports integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
GRANT SELECT ON public.monthly_usage TO authenticated;
GRANT ALL ON public.monthly_usage TO service_role;
ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage readable" ON public.monthly_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Creates the account with 10 welcome credits the first time.
CREATE OR REPLACE FUNCTION public.ensure_credit_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO credit_balances(user_id, balance) VALUES (uid, 10) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO credit_ledger(user_id, delta, reason) VALUES (uid, 10, 'welcome');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_credit_status()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b int; used int;
BEGIN
  PERFORM ensure_credit_account();
  SELECT balance INTO b FROM credit_balances WHERE user_id = uid;
  SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = date_trunc('month', now())::date;
  RETURN json_build_object('balance', b, 'freeExportsUsed', coalesce(used, 0), 'freeExportsLimit', 3);
END $$;

-- Charges for an action. Costs live here so the browser can't change them.
CREATE OR REPLACE FUNCTION public.spend_credits(_action text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cost int; b int; used int; m date := date_trunc('month', now())::date;
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

  IF _action IN ('export_stl', 'export_obj') THEN
    INSERT INTO monthly_usage(user_id, month) VALUES (uid, m) ON CONFLICT DO NOTHING;
    SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = m FOR UPDATE;
    IF used < 3 THEN
      UPDATE monthly_usage SET free_exports = free_exports + 1 WHERE user_id = uid AND month = m;
      RETURN json_build_object('ok', true, 'charged', 0, 'free', true, 'balance', b, 'freeExportsUsed', used + 1);
    END IF;
  END IF;

  IF b < cost THEN
    RETURN json_build_object('ok', false, 'charged', 0, 'needed', cost, 'balance', b);
  END IF;
  UPDATE credit_balances SET balance = balance - cost, updated_at = now() WHERE user_id = uid;
  INSERT INTO credit_ledger(user_id, delta, reason) VALUES (uid, -cost, _action);
  RETURN json_build_object('ok', true, 'charged', cost, 'free', false, 'balance', b - cost);
END $$;

-- Only the payment webhook (server) may add credits. Idempotent via reference.
CREATE OR REPLACE FUNCTION public.grant_credits(_user uuid, _amount int, _reason text, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO credit_ledger(user_id, delta, reason, reference) VALUES (_user, _amount, _reason, _reference);
  INSERT INTO credit_balances(user_id, balance) VALUES (_user, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + _amount, updated_at = now();
EXCEPTION WHEN unique_violation THEN RETURN;
END $$;

REVOKE ALL ON FUNCTION public.ensure_credit_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_credit_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_credits(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, int, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, int, text, text) TO service_role;