
-- Allow public (extranet) access to step completions via intervention token
CREATE POLICY "Public step completions via intervention token"
ON public.intervention_step_completions
FOR SELECT
USING (
  auth.uid() IS NULL
  AND intervention_id IN (
    SELECT id FROM public.interventions WHERE public_token IS NOT NULL
  )
);
