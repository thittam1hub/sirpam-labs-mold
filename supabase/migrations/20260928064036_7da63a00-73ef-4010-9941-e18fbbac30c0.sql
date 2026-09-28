CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id text NOT NULL,
  pack_name text NOT NULL,
  credits integer NOT NULL,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  region text,
  provider text NOT NULL DEFAULT 'manual',
  payment_ref text,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  UNIQUE (provider, payment_ref)
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own purchases readable" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  usd_standard numeric NOT NULL,
  usd_emerging numeric NOT NULL,
  usd_value numeric NOT NULL,
  inr numeric NOT NULL,
  best boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packs TO anon, authenticated;
GRANT ALL ON public.credit_packs TO service_role;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Packs readable by all" ON public.credit_packs FOR SELECT TO anon, authenticated USING (active);

INSERT INTO public.credit_packs (id, name, credits, usd_standard, usd_emerging, usd_value, inr, best, sort) VALUES
  ('starter', 'Starter', 20, 5, 3, 2, 199, false, 1),
  ('maker', 'Maker', 60, 12, 7, 5, 499, true, 2),
  ('studio', 'Studio', 200, 30, 18, 12, 1299, false, 3);

CREATE TABLE public.promo_attempts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_attempts TO authenticated;
GRANT ALL ON public.promo_attempts TO service_role;
ALTER TABLE public.promo_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own attempts readable" ON public.promo_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_promo(_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); p record; c text := upper(btrim(_code)); fails int;
BEGIN
  PERFORM ensure_credit_account();
  SELECT count(*) INTO fails FROM promo_attempts
    WHERE user_id = uid AND attempted_at > now() - interval '1 hour';
  IF fails >= 10 THEN
    RETURN json_build_object('ok', false, 'error', 'Too many attempts. Please try again in an hour.');
  END IF;
  IF c IS NULL OR length(c) < 3 OR length(c) > 40 THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'Enter a valid code.');
  END IF;
  SELECT * INTO p FROM promo_codes WHERE code = c FOR UPDATE;
  IF NOT FOUND OR NOT p.active THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'This code is not valid.');
  END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at <= now() THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'This code has expired.');
  END IF;
  IF p.max_redemptions IS NOT NULL AND p.redeemed_count >= p.max_redemptions THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'This code has been fully used.');
  END IF;
  BEGIN
    INSERT INTO promo_redemptions(code, user_id) VALUES (c, uid);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'You have already used this code.');
  END;
  UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = c;
  PERFORM grant_credits(uid, p.credits, 'promo', 'promo:' || c || ':' || uid::text, 'promo', p.credit_valid_days);
  RETURN json_build_object('ok', true, 'credits', p.credits);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_purchase(_user uuid, _pack_id text, _price numeric, _currency text, _region text, _provider text, _payment_ref text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE pack record; pid uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO pack FROM credit_packs WHERE id = _pack_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown pack'; END IF;
  INSERT INTO purchases(user_id, pack_id, pack_name, credits, price, currency, region, provider, payment_ref)
    VALUES (_user, pack.id, pack.name, pack.credits, _price, _currency, _region, _provider, _payment_ref)
    ON CONFLICT (provider, payment_ref) DO NOTHING
    RETURNING id INTO pid;
  IF pid IS NULL THEN
    SELECT id INTO pid FROM purchases WHERE provider = _provider AND payment_ref = _payment_ref;
    RETURN json_build_object('ok', true, 'purchaseId', pid, 'duplicate', true);
  END IF;
  PERFORM grant_credits(_user, pack.credits, 'purchase', 'purchase:' || pid::text, 'purchase', 730);
  RETURN json_build_object('ok', true, 'purchaseId', pid, 'duplicate', false);
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_refund_purchase(_purchase uuid, _reason text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE p record; l record; removed int := 0;
BEGIN
  PERFORM _require_admin();
  SELECT * INTO p FROM purchases WHERE id = _purchase FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF p.status <> 'paid' THEN RAISE EXCEPTION 'Purchase is not paid'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO l FROM credit_lots WHERE reference = 'purchase:' || p.id::text FOR UPDATE;
  IF FOUND AND l.remaining > 0 THEN
    removed := l.remaining;
    UPDATE credit_lots SET remaining = 0 WHERE id = l.id;
    INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status)
      VALUES (p.user_id, -removed, 'refund: ' || left(btrim(_reason), 200), 'refund:' || p.id::text, 'adjustment', 'charged');
  END IF;
  UPDATE purchases SET status = 'refunded', refunded_at = now() WHERE id = p.id;
  RETURN json_build_object('ok', true, 'removed', removed, 'balance', _refresh_balance(p.user_id));
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_list_purchases(_email text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid;
BEGIN
  PERFORM _require_admin();
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(btrim(_email));
  IF uid IS NULL THEN RETURN '[]'::json; END IF;
  RETURN (SELECT coalesce(json_agg(x ORDER BY x.created_at DESC), '[]'::json) FROM
    (SELECT id, pack_name, credits, price, currency, provider, payment_ref, status, created_at, refunded_at
     FROM purchases WHERE user_id = uid) x);
END $fn$;

REVOKE ALL ON FUNCTION public.record_purchase(uuid, text, numeric, text, text, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, text, numeric, text, text, text, text) TO service_role, authenticated;