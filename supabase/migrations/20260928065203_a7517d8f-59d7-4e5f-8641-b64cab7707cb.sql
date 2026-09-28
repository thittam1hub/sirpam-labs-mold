CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referral code readable" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.referrals (
  referee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rewarded','capped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id, status);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referrals readable" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referee_id OR auth.uid() = referrer_id);

-- Policy constants: 5 credits each, 90-day expiry, max 10 rewarded referrals per referrer per month,
-- code must be applied within 7 days of sign-up, reward on referee's first successful paid action.
CREATE OR REPLACE FUNCTION public.get_referral_info()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c text; i int := 0; mine record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT code INTO c FROM referral_codes WHERE user_id = uid;
  WHILE c IS NULL AND i < 5 LOOP
    BEGIN
      c := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 8));
      IF length(c) < 8 THEN c := NULL; i := i + 1; CONTINUE; END IF;
      INSERT INTO referral_codes(user_id, code) VALUES (uid, c);
    EXCEPTION WHEN unique_violation THEN c := NULL; i := i + 1;
    END;
  END LOOP;
  SELECT r.status, r.created_at INTO mine FROM referrals r WHERE referee_id = uid;
  RETURN json_build_object(
    'code', c,
    'pending', (SELECT count(*) FROM referrals WHERE referrer_id = uid AND status = 'pending'),
    'rewarded', (SELECT count(*) FROM referrals WHERE referrer_id = uid AND status = 'rewarded'),
    'earned', (SELECT coalesce(sum(delta),0) FROM credit_ledger WHERE user_id = uid AND reason = 'referral_referrer'),
    'reward', 5, 'monthlyCap', 10,
    'referredStatus', mine.status,
    'canApply', mine.status IS NULL AND (SELECT created_at FROM auth.users WHERE id = uid) > now() - interval '7 days'
  );
END $$;

CREATE OR REPLACE FUNCTION public.apply_referral(_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref uuid; c text := upper(btrim(_code)); u record; fails int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT count(*) INTO fails FROM promo_attempts WHERE user_id = uid AND attempted_at > now() - interval '1 hour';
  IF fails >= 10 THEN RETURN json_build_object('ok', false, 'error', 'Too many attempts. Please try again in an hour.'); END IF;
  SELECT created_at, email_confirmed_at INTO u FROM auth.users WHERE id = uid;
  IF u.created_at < now() - interval '7 days' THEN RETURN json_build_object('ok', false, 'error', 'Referral codes can only be used within 7 days of creating your account.'); END IF;
  IF u.email_confirmed_at IS NULL THEN RETURN json_build_object('ok', false, 'error', 'Please confirm your email first.'); END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = uid) THEN RETURN json_build_object('ok', false, 'error', 'You have already used a referral code.'); END IF;
  SELECT user_id INTO ref FROM referral_codes WHERE code = c;
  IF ref IS NULL THEN
    INSERT INTO promo_attempts(user_id) VALUES (uid);
    RETURN json_build_object('ok', false, 'error', 'This referral code is not valid.');
  END IF;
  IF ref = uid THEN RETURN json_build_object('ok', false, 'error', 'You cannot use your own referral code.'); END IF;
  IF EXISTS (SELECT 1 FROM purchases WHERE user_id = uid) OR
     EXISTS (SELECT 1 FROM credit_holds WHERE user_id = uid AND status = 'charged') THEN
    RETURN json_build_object('ok', false, 'error', 'Referral codes are for new accounts before their first paid action.');
  END IF;
  INSERT INTO referrals(referee_id, referrer_id) VALUES (uid, ref) ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true, 'reward', 5);
END $$;

CREATE OR REPLACE FUNCTION public._reward_referral(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int;
BEGIN
  SELECT * INTO r FROM referrals WHERE referee_id = _uid AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO n FROM referrals WHERE referrer_id = r.referrer_id AND status = 'rewarded'
    AND rewarded_at >= date_trunc('month', now());
  PERFORM grant_credits(_uid, 5, 'referral_referee', 'referral:referee:' || _uid::text, 'referral', 90);
  IF n >= 10 THEN
    UPDATE referrals SET status = 'capped', rewarded_at = now() WHERE referee_id = _uid;
  ELSE
    PERFORM grant_credits(r.referrer_id, 5, 'referral_referrer', 'referral:referrer:' || _uid::text, 'referral', 90);
    UPDATE referrals SET status = 'rewarded', rewarded_at = now() WHERE referee_id = _uid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.capture_hold(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  UPDATE credit_holds SET status = 'charged', settled_at = now() WHERE id = _id AND user_id = uid AND status = 'held';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE credit_ledger SET status = 'charged' WHERE reference = 'hold:' || _id::text;
  PERFORM _reward_referral(uid);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public._reward_referral(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_referral_info() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral(text) TO authenticated;