-- Drop existing technician update policy
DROP POLICY IF EXISTS "Technicians can update assigned interventions" ON public.interventions;

-- Create new policy that prevents updates on completed interventions
CREATE POLICY "Technicians can update assigned interventions"
ON public.interventions
FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND technician_id = auth.uid()
  AND status NOT IN ('completed', 'to_invoice', 'archived')
);