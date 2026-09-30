ALTER TABLE public.gallery_items
  ADD COLUMN price_paid numeric(10,2),
  ADD COLUMN currency text,
  ADD COLUMN size_x_mm numeric(8,1),
  ADD COLUMN size_y_mm numeric(8,1),
  ADD COLUMN size_z_mm numeric(8,1),
  ADD COLUMN source text;