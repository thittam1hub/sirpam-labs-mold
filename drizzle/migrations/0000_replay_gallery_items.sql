CREATE TABLE public.gallery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  notes TEXT,
  material TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT ALL ON public.gallery_items TO service_role;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own gallery select" ON public.gallery_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own gallery insert" ON public.gallery_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own gallery update" ON public.gallery_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own gallery delete" ON public.gallery_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own mold photos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mold-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own mold photos upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mold-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own mold photos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mold-photos' AND (storage.foldername(name))[1] = auth.uid()::text);