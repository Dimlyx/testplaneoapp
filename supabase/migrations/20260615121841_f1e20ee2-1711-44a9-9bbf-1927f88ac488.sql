ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_file_url text,
  ADD COLUMN IF NOT EXISTS contract_file_name text;