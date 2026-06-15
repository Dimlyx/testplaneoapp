ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS has_maintenance_contract boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS contract_visits_per_year integer;

CREATE INDEX IF NOT EXISTS idx_clients_has_maintenance_contract
  ON public.clients (organization_id, has_maintenance_contract)
  WHERE has_maintenance_contract = true;