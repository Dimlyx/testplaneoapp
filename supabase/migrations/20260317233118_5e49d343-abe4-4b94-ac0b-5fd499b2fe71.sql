
-- Add new columns to technician_details
ALTER TABLE public.technician_details
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS personal_phone text,
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS social_security_number text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS kbis_url text,
  ADD COLUMN IF NOT EXISTS contract_link text,
  ADD COLUMN IF NOT EXISTS collaboration_start_date date,
  ADD COLUMN IF NOT EXISTS collaboration_end_date date,
  ADD COLUMN IF NOT EXISTS specialties text;

-- Create technician_documents table for file uploads with expiration
CREATE TABLE public.technician_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  document_type text NOT NULL, -- 'assurance_decennale', 'rc_pro', 'attestation_sous_traitance', 'rib', 'kbis', 'other'
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for technician_documents
CREATE POLICY "Org admins can manage their technician documents"
  ON public.technician_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all technician documents"
  ON public.technician_documents FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Technicians can view their own documents"
  ON public.technician_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
