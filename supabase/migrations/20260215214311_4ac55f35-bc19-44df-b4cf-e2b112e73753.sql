
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'assignment',
  intervention_id UUID REFERENCES public.interventions(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: create notification when technician is assigned
CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when technician_id changes and is not null
  IF (NEW.technician_id IS NOT NULL AND (OLD.technician_id IS NULL OR OLD.technician_id <> NEW.technician_id)) THEN
    INSERT INTO public.notifications (user_id, title, message, type, intervention_id)
    VALUES (
      NEW.technician_id,
      'Nouvelle intervention assignée',
      'L''intervention "' || NEW.title || '" vous a été assignée.',
      'assignment',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to interventions table
CREATE TRIGGER on_technician_assigned
AFTER UPDATE ON public.interventions
FOR EACH ROW
EXECUTE FUNCTION public.notify_technician_assignment();

-- Also trigger on insert if technician is set at creation
CREATE TRIGGER on_intervention_created_with_technician
AFTER INSERT ON public.interventions
FOR EACH ROW
WHEN (NEW.technician_id IS NOT NULL)
EXECUTE FUNCTION public.notify_technician_assignment();
