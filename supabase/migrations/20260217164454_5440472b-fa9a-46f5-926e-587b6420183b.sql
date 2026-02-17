-- 1. Add token expiration to interventions
ALTER TABLE public.interventions 
ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Set expiration for completed interventions (90 days after completion)
UPDATE public.interventions 
SET token_expires_at = updated_at + interval '90 days'
WHERE status IN ('completed', 'to_invoice', 'archived');

-- 2. Drop old public access policy and create new one with expiration check
DROP POLICY IF EXISTS "Public access via token" ON public.interventions;

CREATE POLICY "Public access via valid token"
ON public.interventions FOR SELECT
USING (
  auth.uid() IS NULL 
  AND public_token IS NOT NULL 
  AND (token_expires_at IS NULL OR token_expires_at > now())
);

-- 3. Secure the storage bucket - make it private
UPDATE storage.buckets SET public = false WHERE id = 'intervention-photos';

-- 4. Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Anyone can view intervention photos" ON storage.objects;

-- 5. Create restrictive storage policies
-- Authenticated org users can view photos from their org's interventions
CREATE POLICY "Org users can view their intervention photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'intervention-photos'
  AND auth.uid() IS NOT NULL
  AND (
    -- Admin access
    (has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM interventions 
      WHERE id::text = split_part(name, '/', 1)
      AND organization_id = get_user_organization(auth.uid())
    ))
    OR
    -- Technician access
    (has_role(auth.uid(), 'technician') AND EXISTS (
      SELECT 1 FROM interventions 
      WHERE id::text = split_part(name, '/', 1)
      AND technician_id = auth.uid()
    ))
    OR
    -- Super admin access
    is_super_admin(auth.uid())
    OR
    -- Logos folder - accessible to all authenticated org users
    name LIKE 'logos/%'
  )
);

-- Public access to photos via valid intervention token (non-authenticated)
CREATE POLICY "Public can view photos via valid token"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'intervention-photos'
  AND auth.uid() IS NULL
  AND EXISTS (
    SELECT 1 FROM interventions 
    WHERE id::text = split_part(name, '/', 1)
    AND public_token IS NOT NULL
    AND (token_expires_at IS NULL OR token_expires_at > now())
  )
);