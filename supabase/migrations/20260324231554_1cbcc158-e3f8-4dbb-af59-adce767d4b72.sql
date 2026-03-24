
-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  leader_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team members table (many-to-many)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS for teams
CREATE POLICY "Org admins can manage their teams" ON public.teams
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org technicians can view their teams" ON public.teams
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician') AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all teams" ON public.teams
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()));

-- RLS for team_members
CREATE POLICY "Org admins can manage their team members" ON public.team_members
  FOR ALL TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE organization_id = get_user_organization(auth.uid())) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE organization_id = get_user_organization(auth.uid())) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Org technicians can view their team members" ON public.team_members
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE organization_id = get_user_organization(auth.uid())) AND has_role(auth.uid(), 'technician'));

CREATE POLICY "Super admins can manage all team members" ON public.team_members
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()));

-- Update trigger for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add team_id to interventions for team assignment
ALTER TABLE public.interventions ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Allow team members to VIEW interventions assigned to their team (consultation only)
CREATE POLICY "Team members can view team interventions" ON public.interventions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'technician') 
    AND team_id IS NOT NULL 
    AND auth.uid() IN (SELECT user_id FROM public.team_members WHERE team_id = interventions.team_id)
    AND organization_id = get_user_organization(auth.uid())
  );
