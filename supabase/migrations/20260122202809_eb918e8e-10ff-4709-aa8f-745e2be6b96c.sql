-- Create intervention_types table
CREATE TABLE public.intervention_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    label text NOT NULL,
    color text DEFAULT 'blue',
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intervention_types ENABLE ROW LEVEL SECURITY;

-- Only admins can manage intervention types
CREATE POLICY "Admins can manage intervention types"
ON public.intervention_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone authenticated can view intervention types
CREATE POLICY "Authenticated users can view intervention types"
ON public.intervention_types
FOR SELECT
USING (true);

-- Insert default types based on existing enum values
INSERT INTO public.intervention_types (name, label, color) VALUES
('sav', 'SAV', 'red'),
('maintenance', 'Maintenance', 'blue'),
('installation', 'Installation', 'green');