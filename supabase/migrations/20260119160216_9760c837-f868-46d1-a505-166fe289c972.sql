-- Ajouter les champs d'adresse d'intervention
ALTER TABLE public.interventions 
ADD COLUMN IF NOT EXISTS intervention_address text,
ADD COLUMN IF NOT EXISTS intervention_city text,
ADD COLUMN IF NOT EXISTS intervention_postal_code text;