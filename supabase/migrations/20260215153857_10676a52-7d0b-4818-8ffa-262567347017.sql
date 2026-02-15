ALTER TABLE public.interventions
ADD COLUMN intervention_building text DEFAULT NULL,
ADD COLUMN intervention_floor text DEFAULT NULL;