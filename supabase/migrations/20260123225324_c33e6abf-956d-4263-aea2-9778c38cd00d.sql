-- Create enum for equipment status
CREATE TYPE equipment_status AS ENUM ('not_working', 'needs_intervention', 'working');

-- Add new status column to intervention_equipment
ALTER TABLE public.intervention_equipment 
ADD COLUMN equipment_status equipment_status DEFAULT 'working';

-- Migrate existing data
UPDATE public.intervention_equipment 
SET equipment_status = CASE 
  WHEN equipment_functional = false THEN 'not_working'::equipment_status
  ELSE 'working'::equipment_status
END;