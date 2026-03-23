ALTER TABLE public.intervention_workflow_steps 
ADD COLUMN loop_yes_step_id uuid REFERENCES public.intervention_workflow_steps(id) ON DELETE SET NULL,
ADD COLUMN loop_no_step_id uuid REFERENCES public.intervention_workflow_steps(id) ON DELETE SET NULL;