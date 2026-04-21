CREATE POLICY "Technicians can create interventions in their org"
ON public.interventions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role)
  AND organization_id = get_user_organization(auth.uid())
  AND technician_id = auth.uid()
);