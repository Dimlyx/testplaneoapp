-- Remove automatic expiration on completed interventions - tokens are client-facing and must remain accessible
UPDATE public.interventions SET token_expires_at = NULL;

-- Update the RLS policy to keep token_expires_at support but make it optional (NULL = no expiration)
DROP POLICY IF EXISTS "Public access via valid token" ON public.interventions;

CREATE POLICY "Public access via valid token"
ON public.interventions FOR SELECT
USING (
  auth.uid() IS NULL 
  AND public_token IS NOT NULL 
  AND (token_expires_at IS NULL OR token_expires_at > now())
);