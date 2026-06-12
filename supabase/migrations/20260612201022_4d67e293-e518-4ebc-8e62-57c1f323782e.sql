
-- Table: user_google_tokens
CREATE TABLE public.user_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_google_tokens TO authenticated;
GRANT ALL ON public.user_google_tokens TO service_role;

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own google tokens"
  ON public.user_google_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_google_tokens_updated_at
  BEFORE UPDATE ON public.user_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: google_sync_logs
CREATE TABLE public.google_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  intervention_id UUID REFERENCES public.interventions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  google_event_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_sync_logs_user ON public.google_sync_logs(user_id, created_at DESC);
CREATE INDEX idx_google_sync_logs_org ON public.google_sync_logs(organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.google_sync_logs TO authenticated;
GRANT ALL ON public.google_sync_logs TO service_role;

ALTER TABLE public.google_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own sync logs"
  ON public.google_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin')
      AND organization_id = public.get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Service role inserts sync logs"
  ON public.google_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add google_event_id to interventions
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_event_user_id UUID;
