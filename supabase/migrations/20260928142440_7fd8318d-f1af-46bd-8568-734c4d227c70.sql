CREATE OR REPLACE FUNCTION public.contact_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.contact_messages
      WHERE lower(email) = lower(NEW.email) AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'rate_limited: too many messages from this email' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.contact_messages WHERE created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION 'rate_limited: too many messages right now' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contact_rate_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS contact_rate_limit ON public.contact_messages;
CREATE TRIGGER contact_rate_limit BEFORE INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.contact_rate_limit();