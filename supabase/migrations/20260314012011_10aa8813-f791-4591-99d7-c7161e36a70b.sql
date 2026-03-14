
-- Create custom intervention statuses table
CREATE TABLE public.custom_intervention_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  status_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Add custom_status_id to interventions
ALTER TABLE public.interventions ADD COLUMN custom_status_id UUID REFERENCES public.custom_intervention_statuses(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.custom_intervention_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org admins can manage their custom statuses"
ON public.custom_intervention_statuses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org users can view their custom statuses"
ON public.custom_intervention_statuses
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all custom statuses"
ON public.custom_intervention_statuses
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_custom_intervention_statuses_updated_at
  BEFORE UPDATE ON public.custom_intervention_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
