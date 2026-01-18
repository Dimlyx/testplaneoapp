-- Ajouter les champs pour le rapport d'intervention détaillé
ALTER TABLE public.interventions 
ADD COLUMN arrival_time time without time zone,
ADD COLUMN departure_time time without time zone,
ADD COLUMN observations text,
ADD COLUMN equipment_functional boolean DEFAULT true,
ADD COLUMN client_signature_name text;