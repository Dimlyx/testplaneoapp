
-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL DEFAULT 'intervention_notification',
  subject TEXT NOT NULL DEFAULT 'Intervention planifiée - {{intervention_title}}',
  greeting TEXT NOT NULL DEFAULT 'Bonjour {{client_name}},',
  body_text TEXT NOT NULL DEFAULT 'Nous vous informons qu''une intervention a été planifiée :',
  closing_text TEXT NOT NULL DEFAULT 'N''hésitez pas à nous contacter pour toute question.',
  signature_text TEXT NOT NULL DEFAULT 'Cordialement,',
  header_color TEXT NOT NULL DEFAULT '#003057',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, template_type)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all templates
CREATE POLICY "Super admins can manage all email templates"
ON public.email_templates
FOR ALL
USING (is_super_admin(auth.uid()));

-- Org admins can view their own templates
CREATE POLICY "Org admins can view their email templates"
ON public.email_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
