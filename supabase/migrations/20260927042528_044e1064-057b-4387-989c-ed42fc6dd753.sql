ALTER TABLE public.gallery_items
  ADD COLUMN stl_name text,
  ADD COLUMN stl_size text,
  ADD COLUMN best_settings text,
  ADD COLUMN rating smallint CHECK (rating BETWEEN 1 AND 5);

CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  maker text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  size_class text,
  casting_material text,
  notes text,
  project_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own quotes select" ON public.quote_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own quotes insert" ON public.quote_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own quotes delete" ON public.quote_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own project files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own project files upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own project files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);