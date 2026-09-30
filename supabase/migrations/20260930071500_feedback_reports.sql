-- In-app issue reports from users (feedback form, no WhatsApp).
CREATE TABLE public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  category text NOT NULL DEFAULT 'bug',
  message text NOT NULL,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anyone (even signed-out visitors) may submit a report; only admins can read them.
GRANT INSERT ON public.feedback_reports TO anon, authenticated;
GRANT SELECT, UPDATE ON public.feedback_reports TO authenticated;
GRANT ALL ON public.feedback_reports TO service_role;

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a report"
ON public.feedback_reports
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read reports"
ON public.feedback_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
ON public.feedback_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
