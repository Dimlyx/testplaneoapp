
-- Table to track intervention pauses
CREATE TABLE public.intervention_pauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  paused_by UUID,
  paused_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resumed_at TIMESTAMP WITH TIME ZONE,
  pause_reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add is_paused flag to interventions
ALTER TABLE public.interventions ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.intervention_pauses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Org admins can manage pauses"
ON public.intervention_pauses FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  intervention_id IN (SELECT id FROM interventions WHERE organization_id = get_user_organization(auth.uid()))
);

CREATE POLICY "Technicians can manage their pauses"
ON public.intervention_pauses FOR ALL
USING (
  has_role(auth.uid(), 'technician'::app_role) AND 
  intervention_id IN (SELECT id FROM interventions WHERE technician_id = auth.uid())
);

CREATE POLICY "Super admins can manage all pauses"
ON public.intervention_pauses FOR ALL
USING (is_super_admin(auth.uid()));
