
ALTER TABLE public.intervention_workflow_steps 
ADD COLUMN checklist_items jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.intervention_step_completions 
ADD COLUMN checklist_data jsonb DEFAULT '[]'::jsonb;
