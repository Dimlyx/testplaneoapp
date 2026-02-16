
-- Track which organizations have read which announcements
CREATE TABLE public.announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  read_by UUID,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, organization_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Org admins can manage their own reads
CREATE POLICY "Org admins can manage their announcement reads"
  ON public.announcement_reads FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND 
    organization_id = get_user_organization(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- Super admins can view all reads
CREATE POLICY "Super admins can manage all announcement reads"
  ON public.announcement_reads FOR ALL
  USING (is_super_admin(auth.uid()));
