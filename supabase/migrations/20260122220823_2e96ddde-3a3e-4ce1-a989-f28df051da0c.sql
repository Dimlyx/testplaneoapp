-- Create intervention_attachments table for storing file attachments
CREATE TABLE public.intervention_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intervention_attachments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all attachments
CREATE POLICY "Admins can manage all attachments"
ON public.intervention_attachments
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Technicians can view attachments for their assigned interventions
CREATE POLICY "Technicians can view attachments for assigned interventions"
ON public.intervention_attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'technician') AND 
  intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

-- Technicians can add attachments to their assigned interventions
CREATE POLICY "Technicians can add attachments to assigned interventions"
ON public.intervention_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician') AND 
  intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

-- Technicians can delete their own attachments
CREATE POLICY "Technicians can delete attachments from assigned interventions"
ON public.intervention_attachments
FOR DELETE
USING (
  has_role(auth.uid(), 'technician') AND 
  intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

-- Public access via intervention token
CREATE POLICY "Public access to attachments via intervention token"
ON public.intervention_attachments
FOR SELECT
USING (
  intervention_id IN (
    SELECT id FROM public.interventions WHERE public_token IS NOT NULL
  )
);