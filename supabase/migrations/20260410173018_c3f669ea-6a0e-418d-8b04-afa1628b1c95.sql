
DROP POLICY "Technicians can update assigned org interventions" ON public.interventions;

CREATE POLICY "Technicians can update assigned org interventions"
ON public.interventions
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND technician_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
  AND status <> ALL (ARRAY['to_invoice'::intervention_status, 'archived'::intervention_status])
)
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role)
  AND technician_id = auth.uid()
);
