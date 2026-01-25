-- Update existing RLS policies to support multi-tenancy
-- Clients
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

CREATE POLICY "Super admins can manage all clients"
ON public.clients FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their clients"
ON public.clients FOR ALL
USING (
  has_role(auth.uid(), 'admin') 
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Org users can view their clients"
ON public.clients FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- Interventions  
DROP POLICY IF EXISTS "Admins can manage all interventions" ON public.interventions;
DROP POLICY IF EXISTS "Public access via token" ON public.interventions;
DROP POLICY IF EXISTS "Technicians can update assigned interventions" ON public.interventions;
DROP POLICY IF EXISTS "Technicians can view assigned interventions" ON public.interventions;

CREATE POLICY "Super admins can manage all interventions"
ON public.interventions FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their interventions"
ON public.interventions FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Technicians can view assigned org interventions"
ON public.interventions FOR SELECT
USING (
  has_role(auth.uid(), 'technician')
  AND technician_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Technicians can update assigned org interventions"
ON public.interventions FOR UPDATE
USING (
  has_role(auth.uid(), 'technician')
  AND technician_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
  AND status NOT IN ('completed', 'to_invoice', 'archived')
)
WITH CHECK (
  has_role(auth.uid(), 'technician')
  AND technician_id = auth.uid()
);

CREATE POLICY "Public access via token"
ON public.interventions FOR SELECT
USING (public_token IS NOT NULL);

-- User roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their org roles"
ON public.user_roles FOR ALL
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
  AND role::text IN ('admin', 'technician')
);

CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can view their org profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can manage their own profile"
ON public.profiles FOR ALL
USING (auth.uid() = id);