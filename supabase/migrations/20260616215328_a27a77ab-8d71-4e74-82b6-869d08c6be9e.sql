
CREATE TABLE public.organization_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'note',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_notes_org ON public.organization_notes(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_notes TO authenticated;
GRANT ALL ON public.organization_notes TO service_role;

ALTER TABLE public.organization_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view org notes"
ON public.organization_notes FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert org notes"
ON public.organization_notes FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Super admins can update org notes"
ON public.organization_notes FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete org notes"
ON public.organization_notes FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_organization_notes_updated_at
BEFORE UPDATE ON public.organization_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
