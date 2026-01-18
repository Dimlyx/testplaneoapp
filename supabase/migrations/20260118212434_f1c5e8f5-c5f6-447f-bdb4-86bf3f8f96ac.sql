-- Create storage bucket for intervention photos
INSERT INTO storage.buckets (id, name, public) VALUES ('intervention-photos', 'intervention-photos', true);

-- Create table for intervention photos
CREATE TABLE public.intervention_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('serial_number', 'during', 'after')),
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intervention_photos ENABLE ROW LEVEL SECURITY;

-- Policies for intervention_photos
CREATE POLICY "Admins can manage all photos"
ON public.intervention_photos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Technicians can view photos of assigned interventions"
ON public.intervention_photos
FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Technicians can add photos to assigned interventions"
ON public.intervention_photos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) 
  AND intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

CREATE POLICY "Technicians can delete their photos"
ON public.intervention_photos
FOR DELETE
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND intervention_id IN (
    SELECT id FROM public.interventions WHERE technician_id = auth.uid()
  )
);

-- Storage policies for intervention-photos bucket
CREATE POLICY "Anyone can view intervention photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'intervention-photos');

CREATE POLICY "Authenticated users can upload intervention photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'intervention-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their uploaded photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'intervention-photos' AND auth.role() = 'authenticated');