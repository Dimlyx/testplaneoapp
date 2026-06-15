ALTER TABLE public.clients ADD COLUMN contract_notes TEXT;

GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;