-- Add loop_index to track which iteration each step completion belongs to
ALTER TABLE public.intervention_step_completions 
ADD COLUMN loop_index integer NOT NULL DEFAULT 0;