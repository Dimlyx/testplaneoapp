-- Allow public access to intervention_photos via public token
CREATE POLICY "Public access to photos via intervention token"
ON public.intervention_photos
FOR SELECT
USING (
  intervention_id IN (
    SELECT id FROM public.interventions WHERE public_token IS NOT NULL
  )
);

-- Allow public access to intervention_equipment via public token
CREATE POLICY "Public access to equipment via intervention token"
ON public.intervention_equipment
FOR SELECT
USING (
  intervention_id IN (
    SELECT id FROM public.interventions WHERE public_token IS NOT NULL
  )
);

-- Allow public access to equipment details via public token
CREATE POLICY "Public access to equipment details via intervention token"
ON public.equipment
FOR SELECT
USING (
  id IN (
    SELECT ie.equipment_id FROM public.intervention_equipment ie
    WHERE ie.intervention_id IN (
      SELECT id FROM public.interventions WHERE public_token IS NOT NULL
    )
  )
);