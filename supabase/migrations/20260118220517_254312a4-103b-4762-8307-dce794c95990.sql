-- Create table to track multiple equipment per intervention
CREATE TABLE public.intervention_equipment (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    technical_comments TEXT,
    equipment_functional BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(intervention_id, equipment_id)
);

-- Enable RLS
ALTER TABLE public.intervention_equipment ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all intervention equipment"
ON public.intervention_equipment
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Technicians can view intervention equipment for assigned interventions"
ON public.intervention_equipment
FOR SELECT
USING (
    has_role(auth.uid(), 'technician'::app_role) 
    AND intervention_id IN (
        SELECT id FROM public.interventions WHERE technician_id = auth.uid()
    )
);

CREATE POLICY "Technicians can manage intervention equipment for assigned interventions"
ON public.intervention_equipment
FOR ALL
USING (
    has_role(auth.uid(), 'technician'::app_role) 
    AND intervention_id IN (
        SELECT id FROM public.interventions WHERE technician_id = auth.uid()
    )
);

-- Add equipment_id to intervention_photos to link photos to specific equipment
ALTER TABLE public.intervention_photos
ADD COLUMN equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_intervention_equipment_updated_at
BEFORE UPDATE ON public.intervention_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();