-- Add unique constraint on key + organization_id for proper upsert
ALTER TABLE public.app_settings 
DROP CONSTRAINT IF EXISTS app_settings_key_key;

ALTER TABLE public.app_settings 
ADD CONSTRAINT app_settings_key_organization_id_key UNIQUE (key, organization_id);