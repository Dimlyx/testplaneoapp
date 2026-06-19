-- Add visit period to client maintenance contracts
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS contract_visits_period text NOT NULL DEFAULT 'year';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_contract_visits_period_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_contract_visits_period_check 
  CHECK (contract_visits_period IN ('day', 'week', 'month', 'year'));

-- Add day-of-month support to maintenance alerts (e.g. "every 10th of the month")
ALTER TABLE public.maintenance_alerts
  ADD COLUMN IF NOT EXISTS day_of_month integer;

ALTER TABLE public.maintenance_alerts
  DROP CONSTRAINT IF EXISTS maintenance_alerts_day_of_month_check;
ALTER TABLE public.maintenance_alerts
  ADD CONSTRAINT maintenance_alerts_day_of_month_check 
  CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31));