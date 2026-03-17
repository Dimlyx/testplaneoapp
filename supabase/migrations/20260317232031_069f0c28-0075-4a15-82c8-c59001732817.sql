
-- Create technician_details table for HR data
CREATE TABLE public.technician_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  technician_type text NOT NULL DEFAULT 'internal' CHECK (technician_type IN ('internal', 'subcontractor')),
  address text,
  city text,
  postal_code text,
  hire_date date,
  contract_type text,
  contract_end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.technician_details ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org admins can manage their technician details"
ON public.technician_details FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all technician details"
ON public.technician_details FOR ALL TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Technicians can view their own details"
ON public.technician_details FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_technician_details_updated_at
  BEFORE UPDATE ON public.technician_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
