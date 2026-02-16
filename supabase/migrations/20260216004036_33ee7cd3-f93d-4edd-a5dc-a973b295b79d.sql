
-- Table for super admin announcements to organizations
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'specific'
  target_organization_ids UUID[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage announcements
CREATE POLICY "Super admins can manage all announcements"
  ON public.announcements FOR ALL
  USING (is_super_admin(auth.uid()));

-- Org admins can view announcements targeting their org or all
CREATE POLICY "Org admins can view their announcements"
  ON public.announcements FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND (
      target_type = 'all' OR 
      get_user_organization(auth.uid()) = ANY(target_organization_ids)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
