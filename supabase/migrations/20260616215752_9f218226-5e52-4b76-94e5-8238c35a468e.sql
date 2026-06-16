
ALTER TABLE public.organization_notes
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_done BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_org_notes_reminder
  ON public.organization_notes(reminder_at)
  WHERE reminder_at IS NOT NULL AND reminder_done = false;
