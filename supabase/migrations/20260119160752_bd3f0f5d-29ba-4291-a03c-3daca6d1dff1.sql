-- Ajouter les champs téléphone et email d'intervention
ALTER TABLE public.interventions 
ADD COLUMN IF NOT EXISTS intervention_phone text,
ADD COLUMN IF NOT EXISTS intervention_email text;