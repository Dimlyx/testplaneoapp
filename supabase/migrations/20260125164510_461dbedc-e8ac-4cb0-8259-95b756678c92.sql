-- Create settings table for app configuration (branding, extranet, etc.)
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can read settings (needed for extranet and public pages)
CREATE POLICY "Public can read settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES 
('report', '{"companyName": "", "companyAddress": "", "companyPhone": "", "companyEmail": "", "primaryColor": "#003057", "accentColor": "#0050A0", "footerText": "", "logoUrl": ""}'),
('extranet', '{"showClientInfo": true, "showInterventionAddress": true, "showScheduledDateTime": true, "showDescription": true, "showEquipmentDetails": true, "showEquipmentPhotos": true, "showReport": true, "showSignature": true, "welcomeMessage": "", "customFooterText": ""}');