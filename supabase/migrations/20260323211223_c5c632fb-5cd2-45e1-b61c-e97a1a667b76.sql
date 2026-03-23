
ALTER TABLE public.intervention_workflow_steps 
ADD COLUMN multiple_choice_items jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.intervention_step_completions 
ADD COLUMN multiple_choice_data jsonb DEFAULT NULL;
