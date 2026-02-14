
-- Allow public (non-authenticated) access to workflow steps for extranet display
CREATE POLICY "Public can view workflow steps"
ON public.intervention_workflow_steps
FOR SELECT
USING (auth.uid() IS NULL);
