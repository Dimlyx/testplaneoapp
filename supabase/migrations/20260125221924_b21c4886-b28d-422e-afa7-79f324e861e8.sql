-- Intervention equipment policies update
DROP POLICY IF EXISTS "Admins can manage all intervention equipment" ON public.intervention_equipment;
DROP POLICY IF EXISTS "Public access to equipment via intervention token" ON public.intervention_equipment;
DROP POLICY IF EXISTS "Technicians can manage intervention equipment for assigned inte" ON public.intervention_equipment;
DROP POLICY IF EXISTS "Technicians can view intervention equipment for assigned interv" ON public.intervention_equipment;

CREATE POLICY "Super admins can manage all intervention equipment"
ON public.intervention_equipment FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage intervention equipment"
ON public.intervention_equipment FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Technicians can manage their intervention equipment"
ON public.intervention_equipment FOR ALL
USING (
  has_role(auth.uid(), 'technician')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Public access to intervention equipment via token"
ON public.intervention_equipment FOR SELECT
USING (
  intervention_id IN (SELECT id FROM interventions WHERE public_token IS NOT NULL)
);

-- Intervention photos policies update
DROP POLICY IF EXISTS "Admins can manage all photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Public access to photos via intervention token" ON public.intervention_photos;
DROP POLICY IF EXISTS "Technicians can add photos to assigned interventions" ON public.intervention_photos;
DROP POLICY IF EXISTS "Technicians can delete their photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Technicians can view photos of assigned interventions" ON public.intervention_photos;

CREATE POLICY "Super admins can manage all photos"
ON public.intervention_photos FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage photos"
ON public.intervention_photos FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Technicians can manage their photos"
ON public.intervention_photos FOR ALL
USING (
  has_role(auth.uid(), 'technician')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Public photos via intervention token"
ON public.intervention_photos FOR SELECT
USING (
  intervention_id IN (SELECT id FROM interventions WHERE public_token IS NOT NULL)
);

-- Intervention attachments policies update
DROP POLICY IF EXISTS "Admins can manage all attachments" ON public.intervention_attachments;
DROP POLICY IF EXISTS "Public access to attachments via intervention token" ON public.intervention_attachments;
DROP POLICY IF EXISTS "Technicians can add attachments to assigned interventions" ON public.intervention_attachments;
DROP POLICY IF EXISTS "Technicians can delete attachments from assigned interventions" ON public.intervention_attachments;
DROP POLICY IF EXISTS "Technicians can view attachments for assigned interventions" ON public.intervention_attachments;

CREATE POLICY "Super admins can manage all attachments"
ON public.intervention_attachments FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage attachments"
ON public.intervention_attachments FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Technicians can manage their attachments"
ON public.intervention_attachments FOR ALL
USING (
  has_role(auth.uid(), 'technician')
  AND intervention_id IN (
    SELECT id FROM interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Public attachments via intervention token"
ON public.intervention_attachments FOR SELECT
USING (
  intervention_id IN (SELECT id FROM interventions WHERE public_token IS NOT NULL)
);