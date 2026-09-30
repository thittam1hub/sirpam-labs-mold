-- ===== Ledger extensions =====
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'charged';
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ===== Credit lots =====
CREATE TABLE public.credit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  amount int NOT NULL,
  remaining int NOT NULL,
  expires_at timestamptz,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_lots_user_idx ON public.credit_lots(user_id, expires_at);
GRANT SELECT ON public.credit_lots TO authenticated;
GRANT ALL ON public.credit_lots TO service_role;
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own lots readable" ON public.credit_lots FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Holds =====
CREATE TABLE public.credit_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  cost int NOT NULL,
  from_free int NOT NULL DEFAULT 0,
  free_month date,
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX credit_holds_user_idx ON public.credit_holds(user_id, status, created_at);
GRANT SELECT ON public.credit_holds TO authenticated;
GRANT ALL ON public.credit_holds TO service_role;
ALTER TABLE public.credit_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own holds readable" ON public.credit_holds FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Promo codes =====
CREATE TABLE public.promo_codes (
  code text PRIMARY KEY,
  credits int NOT NULL CHECK (credits > 0 AND credits <= 1000),
  max_redemptions int,
  redeemed_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  credit_valid_days int NOT NULL DEFAULT 90,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.promo_redemptions (
  code text NOT NULL REFERENCES public.promo_codes(code) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own redemptions readable" ON public.promo_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ===== Migrate existing balances into lots =====
INSERT INTO public.credit_lots(user_id, kind, amount, remaining, expires_at, reference)
SELECT user_id, 'purchase', balance, balance, now() + interval '24 months', 'migrated:' || user_id::text
FROM public.credit_balances WHERE balance > 0;

-- ===== Internal helpers =====
CREATE OR REPLACE FUNCTION public._refresh_balance(_uid uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t int;
BEGIN
  SELECT coalesce(sum(remaining), 0) INTO t FROM credit_lots
    WHERE user_id = _uid AND remaining > 0 AND (expires_at IS NULL OR expires_at > now());
  INSERT INTO credit_balances(user_id, balance) VALUES (_uid, t)
    ON CONFLICT (user_id) DO UPDATE SET balance = t, updated_at = now();
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public._expire_lots(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record;
BEGIN
  FOR l IN SELECT * FROM credit_lots WHERE user_id = _uid AND remaining > 0
           AND expires_at IS NOT NULL AND expires_at <= now() FOR UPDATE LOOP
    INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status)
      VALUES (_uid, -l.remaining, 'expired', 'expire:' || l.id::text, l.kind, 'expired')
      ON CONFLICT DO NOTHING;
    UPDATE credit_lots SET remaining = 0 WHERE id = l.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._release_hold(_id uuid, _uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h record; a jsonb;
BEGIN
  SELECT * INTO h FROM credit_holds WHERE id = _id AND user_id = _uid AND status = 'held' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(h.allocations) LOOP
    UPDATE credit_lots SET remaining = remaining + (a->>'n')::int WHERE id = (a->>'lot')::uuid;
  END LOOP;
  IF h.from_free > 0 THEN
    UPDATE monthly_usage SET free_exports = greatest(0, free_exports - h.from_free)
      WHERE user_id = _uid AND month = h.free_month;
  END IF;
  UPDATE credit_holds SET status = 'refunded', settled_at = now() WHERE id = _id;
  UPDATE credit_ledger SET status = 'refunded' WHERE reference = 'hold:' || _id::text;
  PERFORM _refresh_balance(_uid);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public._release_stale(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  FOR hid IN SELECT id FROM credit_holds WHERE user_id = _uid AND status = 'held'
             AND created_at < now() - interval '30 minutes' LOOP
    PERFORM _release_hold(hid, _uid);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._action_cost(_action text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _action
    WHEN 'export_stl' THEN 1 WHEN 'export_obj' THEN 1
    WHEN 'export_3mf' THEN 2 WHEN 'export_step' THEN 2
    WHEN 'pro_features' THEN 3 WHEN 'ai_shape' THEN 3
    WHEN 'auto_repair' THEN 2 WHEN 'mold_report' THEN 1
    ELSE NULL END
$$;

-- ===== Public API =====
CREATE OR REPLACE FUNCTION public.ensure_credit_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO credit_balances(user_id, balance) VALUES (uid, 0) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO credit_lots(user_id, kind, amount, remaining, expires_at, reference)
      VALUES (uid, 'welcome', 10, 10, now() + interval '90 days', 'welcome:' || uid::text);
    INSERT INTO credit_ledger(user_id, delta, reason, kind, status, expires_at)
      VALUES (uid, 10, 'welcome', 'welcome', 'granted', now() + interval '90 days');
    PERFORM _refresh_balance(uid);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_credit_status()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b int; used int; nx record;
BEGIN
  PERFORM ensure_credit_account();
  PERFORM _release_stale(uid);
  PERFORM _expire_lots(uid);
  b := _refresh_balance(uid);
  SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = date_trunc('month', now())::date;
  SELECT sum(remaining) AS amt, min(expires_at) AS at INTO nx FROM credit_lots
    WHERE user_id = uid AND remaining > 0 AND expires_at IS NOT NULL
      AND expires_at = (SELECT min(expires_at) FROM credit_lots WHERE user_id = uid AND remaining > 0 AND expires_at > now());
  RETURN json_build_object('balance', b, 'monthlyFreeLeft', greatest(0, 3 - coalesce(used, 0)), 'monthlyFreeLimit', 3,
    'nextExpiryAmount', coalesce(nx.amt, 0), 'nextExpiryAt', nx.at);
END $$;

CREATE OR REPLACE FUNCTION public.hold_credits(_action text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cost int; b int; used int; freeLeft int; fromFree int; fromPaid int;
  m date := date_trunc('month', now())::date; need int; take int; l record; allocs jsonb := '[]'::jsonb;
  firstKind text; hid uuid := gen_random_uuid();
BEGIN
  PERFORM ensure_credit_account();
  cost := _action_cost(_action);
  IF cost IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;
  PERFORM 1 FROM credit_balances WHERE user_id = uid FOR UPDATE;
  PERFORM _release_stale(uid);
  PERFORM _expire_lots(uid);
  b := _refresh_balance(uid);

  INSERT INTO monthly_usage(user_id, month) VALUES (uid, m) ON CONFLICT DO NOTHING;
  SELECT free_exports INTO used FROM monthly_usage WHERE user_id = uid AND month = m FOR UPDATE;
  freeLeft := greatest(0, 3 - used);
  fromFree := least(freeLeft, cost);
  fromPaid := cost - fromFree;
  IF b < fromPaid THEN
    RETURN json_build_object('ok', false, 'needed', cost, 'balance', b, 'monthlyFreeLeft', freeLeft);
  END IF;

  need := fromPaid;
  FOR l IN SELECT * FROM credit_lots WHERE user_id = uid AND remaining > 0
           AND (expires_at IS NULL OR expires_at > now())
           ORDER BY (kind = 'purchase'), expires_at NULLS LAST, created_at FOR UPDATE LOOP
    EXIT WHEN need <= 0;
    take := least(need, l.remaining);
    UPDATE credit_lots SET remaining = remaining - take WHERE id = l.id;
    allocs := allocs || jsonb_build_object('lot', l.id, 'n', take, 'kind', l.kind);
    firstKind := coalesce(firstKind, l.kind);
    need := need - take;
  END LOOP;

  IF fromFree > 0 THEN
    UPDATE monthly_usage SET free_exports = free_exports + fromFree WHERE user_id = uid AND month = m;
  END IF;
  INSERT INTO credit_holds(id, user_id, action, cost, from_free, free_month, allocations)
    VALUES (hid, uid, _action, cost, fromFree, m, allocs);
  INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status)
    VALUES (uid, -cost, _action, 'hold:' || hid::text,
      CASE WHEN fromPaid = 0 THEN 'monthly' WHEN fromFree = 0 THEN firstKind ELSE 'mixed' END, 'held');
  b := _refresh_balance(uid);
  RETURN json_build_object('ok', true, 'holdId', hid, 'charged', cost, 'fromFree', fromFree,
    'balance', b, 'monthlyFreeLeft', freeLeft - fromFree);
END $$;

CREATE OR REPLACE FUNCTION public.capture_hold(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  UPDATE credit_holds SET status = 'charged', settled_at = now() WHERE id = _id AND user_id = uid AND status = 'held';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE credit_ledger SET status = 'charged' WHERE reference = 'hold:' || _id::text;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.release_hold(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN _release_hold(_id, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.spend_credits(_action text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r json;
BEGIN
  r := hold_credits(_action);
  IF (r->>'ok')::boolean THEN PERFORM capture_hold((r->>'holdId')::uuid); END IF;
  RETURN r;
END $$;

DROP FUNCTION IF EXISTS public.grant_credits(uuid, int, text, text);
CREATE OR REPLACE FUNCTION public.grant_credits(_user uuid, _amount int, _reason text, _reference text,
  _kind text DEFAULT 'purchase', _valid_days int DEFAULT 730)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE exp timestamptz := now() + make_interval(days => _valid_days);
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status, expires_at)
    VALUES (_user, _amount, _reason, _reference, _kind, 'granted', exp);
  INSERT INTO credit_lots(user_id, kind, amount, remaining, expires_at, reference)
    VALUES (_user, _kind, _amount, _amount, exp, _reference);
  PERFORM _refresh_balance(_user);
EXCEPTION WHEN unique_violation THEN RETURN;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_promo(_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; c text := upper(btrim(_code));
BEGIN
  PERFORM ensure_credit_account();
  IF c IS NULL OR length(c) < 3 OR length(c) > 40 THEN RETURN json_build_object('ok', false, 'error', 'Enter a valid code.'); END IF;
  SELECT * INTO p FROM promo_codes WHERE code = c FOR UPDATE;
  IF NOT FOUND OR NOT p.active THEN RETURN json_build_object('ok', false, 'error', 'This code is not valid.'); END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at <= now() THEN RETURN json_build_object('ok', false, 'error', 'This code has expired.'); END IF;
  IF p.max_redemptions IS NOT NULL AND p.redeemed_count >= p.max_redemptions THEN RETURN json_build_object('ok', false, 'error', 'This code has been fully used.'); END IF;
  BEGIN
    INSERT INTO promo_redemptions(code, user_id) VALUES (c, uid);
  EXCEPTION WHEN unique_violation THEN RETURN json_build_object('ok', false, 'error', 'You have already used this code.');
  END;
  UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = c;
  PERFORM grant_credits(uid, p.credits, 'promo', 'promo:' || c || ':' || uid::text, 'promo', p.credit_valid_days);
  RETURN json_build_object('ok', true, 'credits', p.credits);
END $$;

-- ===== Admin =====
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_find_user(_email text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; b int;
BEGIN
  PERFORM _require_admin();
  SELECT id, email, created_at INTO u FROM auth.users WHERE lower(email) = lower(btrim(_email));
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM _expire_lots(u.id);
  b := _refresh_balance(u.id);
  RETURN json_build_object('id', u.id, 'email', u.email, 'createdAt', u.created_at, 'balance', b,
    'history', (SELECT coalesce(json_agg(x ORDER BY x.created_at DESC), '[]'::json) FROM
      (SELECT id, delta, reason, reference, kind, status, created_at FROM credit_ledger WHERE user_id = u.id ORDER BY created_at DESC LIMIT 100) x));
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user uuid, _amount int, _reason text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE need int; take int; l record; removed int := 0;
BEGIN
  PERFORM _require_admin();
  IF _amount = 0 OR abs(_amount) > 10000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF _amount > 0 THEN
    PERFORM grant_credits(_user, _amount, 'admin: ' || left(btrim(_reason), 200), 'admin:' || gen_random_uuid()::text, 'bonus', 365);
    RETURN json_build_object('ok', true, 'balance', _refresh_balance(_user));
  END IF;
  need := -_amount;
  FOR l IN SELECT * FROM credit_lots WHERE user_id = _user AND remaining > 0
           AND (expires_at IS NULL OR expires_at > now())
           ORDER BY (kind = 'purchase'), expires_at NULLS LAST FOR UPDATE LOOP
    EXIT WHEN need <= 0;
    take := least(need, l.remaining);
    UPDATE credit_lots SET remaining = remaining - take WHERE id = l.id;
    need := need - take; removed := removed + take;
  END LOOP;
  IF removed > 0 THEN
    INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status)
      VALUES (_user, -removed, 'admin: ' || left(btrim(_reason), 200), 'admin:' || gen_random_uuid()::text, 'adjustment', 'charged');
  END IF;
  RETURN json_build_object('ok', true, 'removed', removed, 'balance', _refresh_balance(_user));
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_promo(_code text, _credits int, _max int, _expires timestamptz, _valid_days int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := upper(btrim(_code));
BEGIN
  PERFORM _require_admin();
  IF c !~ '^[A-Z0-9_-]{3,40}$' THEN RAISE EXCEPTION 'Code must be 3-40 letters, numbers, dashes'; END IF;
  INSERT INTO promo_codes(code, credits, max_redemptions, expires_at, credit_valid_days)
    VALUES (c, _credits, _max, _expires, coalesce(_valid_days, 90));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_promo_active(_code text, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _require_admin();
  UPDATE promo_codes SET active = _active WHERE code = upper(btrim(_code));
END $$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _require_admin();
  RETURN json_build_object(
    'users', (SELECT count(*) FROM credit_balances),
    'activeLast30', (SELECT count(DISTINCT user_id) FROM credit_holds WHERE created_at > now() - interval '30 days'),
    'purchases', (SELECT count(*) FROM credit_ledger WHERE reason = 'purchase'),
    'creditsSold', (SELECT coalesce(sum(delta), 0) FROM credit_ledger WHERE reason = 'purchase'),
    'usageByAction', (SELECT coalesce(json_object_agg(action, n), '{}'::json) FROM
      (SELECT action, sum(cost) AS n FROM credit_holds WHERE status = 'charged' AND created_at > now() - interval '30 days' GROUP BY action) s),
    'promos', (SELECT coalesce(json_agg(p ORDER BY p.created_at DESC), '[]'::json) FROM
      (SELECT code, credits, max_redemptions, redeemed_count, expires_at, credit_valid_days, active, created_at FROM promo_codes) p)
  );
END $$;

-- ===== Permissions =====
REVOKE ALL ON FUNCTION public._refresh_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expire_lots(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._release_hold(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._release_stale(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._require_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, int, text, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, int, text, text, text, int) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_credit_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_credit_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hold_credits(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capture_hold(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_hold(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_credits(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_promo(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_find_user(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_promo(text, int, int, timestamptz, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_promo_active(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account(), public.get_credit_status(), public.hold_credits(text),
  public.capture_hold(uuid), public.release_hold(uuid), public.spend_credits(text), public.redeem_promo(text),
  public.admin_find_user(text), public.admin_adjust_credits(uuid, int, text),
  public.admin_create_promo(text, int, int, timestamptz, int), public.admin_set_promo_active(text, boolean),
  public.admin_overview(), public.has_role(uuid, public.app_role) TO authenticated;