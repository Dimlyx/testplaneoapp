-- Allow technicians to insert equipment for clients they're working with
CREATE POLICY "Technicians can create equipment for intervention clients"
ON public.equipment
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) 
  AND client_id IN (
    SELECT client_id FROM interventions WHERE technician_id = auth.uid()
  )
);