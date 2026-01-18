-- Add column for client signature image URL
ALTER TABLE public.interventions
ADD COLUMN client_signature_url TEXT;