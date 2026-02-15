
-- Table for client documents
CREATE TABLE public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage their client documents"
ON public.client_documents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org users can view their client documents"
ON public.client_documents FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all client documents"
ON public.client_documents FOR ALL
USING (is_super_admin(auth.uid()));

-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', true);

CREATE POLICY "Authenticated users can upload client documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view client documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);
