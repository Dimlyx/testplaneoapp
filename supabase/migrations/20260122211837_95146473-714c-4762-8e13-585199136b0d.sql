-- Drop the existing technician update policy
DROP POLICY IF EXISTS "Technicians can update assigned interventions" ON public.interventions;

-- Create new policy that allows technicians to update their assigned interventions
-- EXCEPT when the intervention is already in a locked status (completed, to_invoice, archived)
-- This allows the TRANSITION to completed, but not modifications after
CREATE POLICY "Technicians can update assigned interventions" 
ON public.interventions 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND technician_id = auth.uid()
  AND status NOT IN ('completed', 'to_invoice', 'archived')
)
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) 
  AND technician_id = auth.uid()
);