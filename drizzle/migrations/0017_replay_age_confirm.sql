ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_age_confirmed CHECK (age_confirmed) NOT VALID;