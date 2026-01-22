-- Add travel time tracking fields to interventions
ALTER TABLE public.interventions 
ADD COLUMN travel_departure_time time without time zone,
ADD COLUMN travel_return_time time without time zone;

-- travel_departure_time: when technician leaves base (home/hotel) to go to intervention
-- travel_return_time: when technician returns to base after intervention (end of day)