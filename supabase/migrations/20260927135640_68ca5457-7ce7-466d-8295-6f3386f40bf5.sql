DROP POLICY IF EXISTS "Anyone can send a message" ON public.contact_messages;
CREATE POLICY "Anyone can send a valid message"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 100
  AND char_length(btrim(email)) BETWEEN 3 AND 254
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND char_length(btrim(message)) BETWEEN 1 AND 5000
);