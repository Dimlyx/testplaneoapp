-- App settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read settings" ON public.app_settings;

CREATE POLICY "Super admins can manage all settings"
ON public.app_settings FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their settings"
ON public.app_settings FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Public can read org settings"
ON public.app_settings FOR SELECT
USING (true);

-- Equipment
DROP POLICY IF EXISTS "Admins can manage equipment" ON public.equipment;
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Public access to equipment details via intervention token" ON public.equipment;
DROP POLICY IF EXISTS "Technicians can create equipment for intervention clients" ON public.equipment;

CREATE POLICY "Super admins can manage all equipment"
ON public.equipment FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their equipment"
ON public.equipment FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Org users can view their equipment"
ON public.equipment FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Technicians can create equipment for org clients"
ON public.equipment FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician')
  AND organization_id = get_user_organization(auth.uid())
  AND client_id IN (
    SELECT client_id FROM interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Public equipment via intervention token"
ON public.equipment FOR SELECT
USING (
  id IN (
    SELECT ie.equipment_id FROM intervention_equipment ie
    WHERE ie.intervention_id IN (
      SELECT id FROM interventions WHERE public_token IS NOT NULL
    )
  )
);

-- Maintenance alerts
DROP POLICY IF EXISTS "Admins can manage maintenance alerts" ON public.maintenance_alerts;
DROP POLICY IF EXISTS "Technicians can view relevant alerts" ON public.maintenance_alerts;

CREATE POLICY "Super admins can manage all alerts"
ON public.maintenance_alerts FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their alerts"
ON public.maintenance_alerts FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Org technicians can view their alerts"
ON public.maintenance_alerts FOR SELECT
USING (
  has_role(auth.uid(), 'technician')
  AND organization_id = get_user_organization(auth.uid())
  AND client_id IN (
    SELECT DISTINCT client_id FROM interventions WHERE technician_id = auth.uid()
  )
);

-- Intervention types
DROP POLICY IF EXISTS "Admins can manage intervention types" ON public.intervention_types;
DROP POLICY IF EXISTS "Authenticated users can view intervention types" ON public.intervention_types;

CREATE POLICY "Super admins can manage all intervention types"
ON public.intervention_types FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their intervention types"
ON public.intervention_types FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Org users can view their intervention types"
ON public.intervention_types FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) OR organization_id IS NULL);