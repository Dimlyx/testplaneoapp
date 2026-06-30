
-- Table contrats de maintenance (plusieurs par client)
CREATE TABLE public.client_maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Contrat principal',
  contract_type text,
  start_date date,
  end_date date,
  visits_per_period integer,
  visits_period text NOT NULL DEFAULT 'year' CHECK (visits_period IN ('day','week','month','year')),
  notes text,
  file_url text,
  file_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_maintenance_contracts TO authenticated;
GRANT ALL ON public.client_maintenance_contracts TO service_role;

ALTER TABLE public.client_maintenance_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage contracts"
  ON public.client_maintenance_contracts
  FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org techs view contracts"
  ON public.client_maintenance_contracts
  FOR SELECT
  USING (has_role(auth.uid(),'technician'::app_role) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins manage all contracts"
  ON public.client_maintenance_contracts
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX idx_cmc_client ON public.client_maintenance_contracts(client_id);
CREATE INDEX idx_cmc_org ON public.client_maintenance_contracts(organization_id);

CREATE TRIGGER update_cmc_updated_at
  BEFORE UPDATE ON public.client_maintenance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration des contrats existants
INSERT INTO public.client_maintenance_contracts
  (client_id, organization_id, name, contract_type, start_date, end_date,
   visits_per_period, visits_period, notes, file_url, file_name, is_active)
SELECT
  c.id, c.organization_id,
  COALESCE(NULLIF(c.contract_type,''), 'Contrat principal'),
  c.contract_type, c.contract_start_date, c.contract_end_date,
  c.contract_visits_per_year, COALESCE(c.contract_visits_period,'year'),
  c.contract_notes, c.contract_file_url, c.contract_file_name, true
FROM public.clients c
WHERE c.has_maintenance_contract = true
  AND c.organization_id IS NOT NULL;

-- Lien alertes -> contrat
ALTER TABLE public.maintenance_alerts
  ADD COLUMN contract_id uuid REFERENCES public.client_maintenance_contracts(id) ON DELETE SET NULL;
CREATE INDEX idx_maintenance_alerts_contract ON public.maintenance_alerts(contract_id);
