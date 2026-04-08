
-- Add cancelled to intervention_status enum
ALTER TYPE public.intervention_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add cancellation fields to interventions
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_details text,
  ADD COLUMN IF NOT EXISTS cancellation_photos jsonb DEFAULT '[]'::jsonb;

-- Update technician update policy to allow setting cancelled status
DROP POLICY IF EXISTS "Technicians can update assigned org interventions" ON public.interventions;

CREATE POLICY "Technicians can update assigned org interventions"
ON public.interventions
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND technician_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
  AND status <> ALL (ARRAY['completed'::intervention_status, 'to_invoice'::intervention_status, 'archived'::intervention_status])
)
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role)
  AND technician_id = auth.uid()
);
