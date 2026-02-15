
CREATE POLICY "Public can view intervention types"
ON public.intervention_types
FOR SELECT
USING (auth.uid() IS NULL);
