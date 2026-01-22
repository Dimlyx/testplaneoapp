-- Create enum for alert recurrence
CREATE TYPE public.alert_recurrence AS ENUM ('once', 'weekly', 'monthly', 'quarterly', 'yearly');

-- Create enum for alert status
CREATE TYPE public.alert_status AS ENUM ('pending', 'acknowledged', 'completed', 'dismissed');

-- Create maintenance_alerts table
CREATE TABLE public.maintenance_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
    alert_date DATE NOT NULL,
    recurrence alert_recurrence NOT NULL DEFAULT 'once',
    status alert_status NOT NULL DEFAULT 'pending',
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_alerts ENABLE ROW LEVEL SECURITY;

-- Admin can manage all alerts
CREATE POLICY "Admins can manage maintenance alerts"
ON public.maintenance_alerts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Technicians can view alerts for their assigned clients
CREATE POLICY "Technicians can view relevant alerts"
ON public.maintenance_alerts
FOR SELECT
USING (
    has_role(auth.uid(), 'technician'::app_role) 
    AND client_id IN (
        SELECT DISTINCT client_id FROM interventions WHERE technician_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_maintenance_alerts_updated_at
BEFORE UPDATE ON public.maintenance_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for maintenance_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_alerts;