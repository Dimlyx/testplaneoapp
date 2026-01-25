-- Drop the problematic policy that allows any authenticated user to see all interventions
DROP POLICY IF EXISTS "Public access via token" ON public.interventions;

-- Recreate it to only work for unauthenticated users (public extranet access)
CREATE POLICY "Public access via token" 
ON public.interventions 
FOR SELECT 
USING (
  auth.uid() IS NULL 
  AND public_token IS NOT NULL
);