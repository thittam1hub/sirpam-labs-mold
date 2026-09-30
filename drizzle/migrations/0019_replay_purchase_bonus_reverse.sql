ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS purchase_bonus_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_purchase(_user uuid, _pack_id text, _price numeric, _currency text, _region text, _provider text, _payment_ref text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE pack record; pid uuid; r record;
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
  -- Inviter bonus: 10 credits once, on the invited friend's first purchase.
  SELECT * INTO r FROM referrals WHERE referee_id = _user AND purchase_bonus_at IS NULL FOR UPDATE;
  IF FOUND AND (SELECT count(*) FROM purchases WHERE user_id = _user) = 1 THEN
    PERFORM grant_credits(r.referrer_id, 10, 'referral_purchase_bonus', 'referral:purchase:' || _user::text, 'referral', 90);
    UPDATE referrals SET purchase_bonus_at = now() WHERE referee_id = _user;
  END IF;
  RETURN json_build_object('ok', true, 'purchaseId', pid, 'duplicate', false);
END $fn$;
REVOKE ALL ON FUNCTION public.record_purchase(uuid, text, numeric, text, text, text, text) FROM PUBLIC, anon;

-- Provider refund/chargeback: remove unused credits of that purchase (service role only).
CREATE OR REPLACE FUNCTION public.reverse_purchase(_provider text, _payment_ref text, _reason text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE p record; l record; removed int := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO p FROM purchases WHERE provider = _provider AND payment_ref = _payment_ref FOR UPDATE;
  IF NOT FOUND OR p.status <> 'paid' THEN RETURN json_build_object('ok', false); END IF;
  SELECT * INTO l FROM credit_lots WHERE reference = 'purchase:' || p.id::text FOR UPDATE;
  IF FOUND AND l.remaining > 0 THEN
    removed := l.remaining;
    UPDATE credit_lots SET remaining = 0 WHERE id = l.id;
    INSERT INTO credit_ledger(user_id, delta, reason, reference, kind, status)
      VALUES (p.user_id, -removed, left(_reason, 200), 'refund:' || p.id::text, 'adjustment', 'charged')
      ON CONFLICT DO NOTHING;
  END IF;
  UPDATE purchases SET status = 'refunded', refunded_at = now() WHERE id = p.id;
  PERFORM _refresh_balance(p.user_id);
  RETURN json_build_object('ok', true, 'removed', removed);
END $fn$;
REVOKE ALL ON FUNCTION public.reverse_purchase(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_purchase(text, text, text) TO service_role;