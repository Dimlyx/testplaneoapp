-- Create intervention workflow steps table
CREATE TABLE public.intervention_workflow_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_type_id uuid REFERENCES public.intervention_types(id) ON DELETE CASCADE NOT NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    label text NOT NULL,
    description text,
    is_mandatory boolean DEFAULT false,
    step_order integer NOT NULL DEFAULT 0,
    requires_photo boolean DEFAULT false,
    requires_comment boolean DEFAULT false,
    requires_signature boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_workflow_steps_intervention_type ON public.intervention_workflow_steps(intervention_type_id);
CREATE INDEX idx_workflow_steps_organization ON public.intervention_workflow_steps(organization_id);

-- Enable RLS
ALTER TABLE public.intervention_workflow_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org admins can manage their workflow steps"
ON public.intervention_workflow_steps
FOR ALL
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Org users can view their workflow steps"
ON public.intervention_workflow_steps
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all workflow steps"
ON public.intervention_workflow_steps
FOR ALL
USING (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_workflow_steps_updated_at
    BEFORE UPDATE ON public.intervention_workflow_steps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create intervention step completions table to track progress
CREATE TABLE public.intervention_step_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id uuid REFERENCES public.interventions(id) ON DELETE CASCADE NOT NULL,
    step_id uuid REFERENCES public.intervention_workflow_steps(id) ON DELETE CASCADE NOT NULL,
    completed_at timestamp with time zone DEFAULT now(),
    completed_by uuid,
    photo_url text,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(intervention_id, step_id)
);

-- Create indexes
CREATE INDEX idx_step_completions_intervention ON public.intervention_step_completions(intervention_id);

-- Enable RLS
ALTER TABLE public.intervention_step_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for step completions
CREATE POLICY "Org admins can manage step completions"
ON public.intervention_step_completions
FOR ALL
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND intervention_id IN (
        SELECT id FROM interventions WHERE organization_id = get_user_organization(auth.uid())
    )
);

CREATE POLICY "Technicians can manage their step completions"
ON public.intervention_step_completions
FOR ALL
USING (
    has_role(auth.uid(), 'technician'::app_role)
    AND intervention_id IN (
        SELECT id FROM interventions WHERE technician_id = auth.uid()
    )
);

CREATE POLICY "Super admins can manage all step completions"
ON public.intervention_step_completions
FOR ALL
USING (is_super_admin(auth.uid()));