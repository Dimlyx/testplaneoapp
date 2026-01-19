-- Add new intervention status values
ALTER TYPE intervention_status ADD VALUE IF NOT EXISTS 'to_invoice';
ALTER TYPE intervention_status ADD VALUE IF NOT EXISTS 'archived';