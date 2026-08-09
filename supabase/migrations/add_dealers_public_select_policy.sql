-- Create public SELECT policy for dealers table to allow public users to see the dealer code on car details page
DROP POLICY IF EXISTS "Public can view dealers" ON public.dealers;
CREATE POLICY "Public can view dealers" ON public.dealers FOR SELECT USING (true);
