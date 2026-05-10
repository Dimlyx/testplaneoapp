-- Restrict the unauthenticated public read on app_settings to the keys
-- strictly required by the public extranet (branding/document styling).
-- 'company' (contact email/phone/address) now requires authentication.
DROP POLICY IF EXISTS "Public can read org settings" ON public.app_settings;

CREATE POLICY "Public can read branding settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (
  key IN ('interface', 'documents', 'extranet', 'report')
);

-- Authenticated users of the org can still read all of their own org settings
-- (including 'company'). This complements the existing admin-manage policy.
CREATE POLICY "Org users can read their org settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
);