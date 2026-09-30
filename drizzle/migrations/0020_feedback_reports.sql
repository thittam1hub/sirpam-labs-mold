CREATE TABLE public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  category text NOT NULL DEFAULT 'bug' CHECK (category IN ('bug', 'idea', 'other')),
  message text NOT NULL,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback_reports TO authenticated;
GRANT INSERT ON public.feedback_reports TO anon;
GRANT ALL ON public.feedback_reports TO service_role;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can report" ON public.feedback_reports FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(btrim(message)) BETWEEN 3 AND 5000);
CREATE POLICY "Own reports readable" ON public.feedback_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all reports" ON public.feedback_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update reports" ON public.feedback_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));