
-- Table for client contacts/interlocutors
CREATE TABLE public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage their client contacts"
ON public.client_contacts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org users can view their client contacts"
ON public.client_contacts FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all client contacts"
ON public.client_contacts FOR ALL
USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for client internal notes
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage their client notes"
ON public.client_notes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org users can view their client notes"
ON public.client_notes FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all client notes"
ON public.client_notes FOR ALL
USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_client_notes_updated_at
BEFORE UPDATE ON public.client_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
