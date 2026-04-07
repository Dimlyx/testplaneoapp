
CREATE INDEX IF NOT EXISTS idx_interventions_organization_id ON public.interventions (organization_id);
CREATE INDEX IF NOT EXISTS idx_interventions_technician_id ON public.interventions (technician_id);
CREATE INDEX IF NOT EXISTS idx_interventions_scheduled_date ON public.interventions (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interventions_client_id ON public.interventions (client_id);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON public.interventions (status);
CREATE INDEX IF NOT EXISTS idx_interventions_team_id ON public.interventions (team_id);

CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients (organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_organization_id ON public.equipment (organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_client_id ON public.equipment (client_id);

CREATE INDEX IF NOT EXISTS idx_step_completions_intervention_id ON public.intervention_step_completions (intervention_id);
CREATE INDEX IF NOT EXISTS idx_step_completions_step_id ON public.intervention_step_completions (step_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_organization_id ON public.maintenance_alerts (organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_client_id ON public.maintenance_alerts (client_id);

CREATE INDEX IF NOT EXISTS idx_intervention_photos_intervention_id ON public.intervention_photos (intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_equipment_intervention_id ON public.intervention_equipment (intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_attachments_intervention_id ON public.intervention_attachments (intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_pauses_intervention_id ON public.intervention_pauses (intervention_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);
