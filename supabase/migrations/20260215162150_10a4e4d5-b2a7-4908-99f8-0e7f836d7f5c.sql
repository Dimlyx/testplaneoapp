-- Change intervention_type column from enum to text to allow dynamic types
ALTER TABLE public.interventions 
  ALTER COLUMN intervention_type TYPE text USING intervention_type::text;

-- Drop the old enum type (no longer needed)
DROP TYPE IF EXISTS public.intervention_type;