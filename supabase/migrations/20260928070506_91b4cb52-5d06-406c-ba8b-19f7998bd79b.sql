CREATE TABLE public.deleted_referral_emails (
  email_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.deleted_referral_emails TO service_role;
ALTER TABLE public.deleted_referral_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.capture_hold(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); h record;
BEGIN
  UPDATE credit_holds SET status = 'charged', settled_at = now()
    WHERE id = _id AND user_id = uid AND status = 'held' RETURNING * INTO h;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE credit_ledger SET status = 'charged' WHERE reference = 'hold:' || _id::text;
  IF h.from_free < h.cost THEN PERFORM _reward_referral(uid); END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.apply_referral(_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref uuid; c text := upper(btrim(_code)); u record; fails int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT count(*) INTO fails FROM promo_attempts WHERE user_id = uid AND attempted_at > now() - interval '1 hour';
  IF fails >= 10 THEN RETURN json_build_object('ok', false, 'error', 'Too many attempts. Please try again in an hour.'); END IF;
  SELECT created_at, email_confirmed_at, email INTO u FROM auth.users WHERE id = uid;
  IF u.created_at < now() - interval '7 days' THEN RETURN json_build_object('ok', false, 'error', 'Referral codes can only be used within 7 days of creating your account.'); END IF;
  IF u.email_confirmed_at IS NULL THEN RETURN json_build_object('ok', false, 'error', 'Please confirm your email first.'); END IF;
  IF EXISTS (SELECT 1 FROM deleted_referral_emails WHERE email_hash = encode(digest(lower(u.email), 'sha256'), 'hex')) THEN
    RETURN json_build_object('ok', false, 'error', 'This email has already used a referral.');
  END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = uid) THEN RETURN json_build_object('ok', false, 'error', 'You have already used a referral code.'); END IF;
  SELECT user_id INTO ref FROM referral_codes WHERE code = c;
  IF ref IS NULL THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'This referral code is not valid.');
  END IF;
  IF ref = uid THEN RETURN json_build_object('ok', false, 'error', 'You cannot use your own referral code.'); END IF;
  IF EXISTS (SELECT 1 FROM purchases WHERE user_id = uid) OR
     EXISTS (SELECT 1 FROM credit_holds WHERE user_id = uid AND status = 'charged' AND from_free < cost) THEN
    RETURN json_build_object('ok', false, 'error', 'Referral codes are for new accounts before their first paid action.');
  END IF;
  INSERT INTO referrals(referee_id, referrer_id) VALUES (uid, ref) ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true, 'reward', 5);
END $$;

-- Deletes all of the caller's app data in one transaction (auth user removed afterwards by the server).
CREATE OR REPLACE FUNCTION public.delete_my_account_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  IF em IS NOT NULL AND EXISTS (SELECT 1 FROM referrals WHERE referee_id = uid) THEN
    INSERT INTO deleted_referral_emails(email_hash) VALUES (encode(digest(lower(em), 'sha256'), 'hex')) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM gallery_items WHERE user_id = uid;
  DELETE FROM credit_holds WHERE user_id = uid;
  DELETE FROM credit_lots WHERE user_id = uid;
  DELETE FROM credit_ledger WHERE user_id = uid;
  DELETE FROM monthly_usage WHERE user_id = uid;
  DELETE FROM promo_redemptions WHERE user_id = uid;
  DELETE FROM credit_balances WHERE user_id = uid;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated;