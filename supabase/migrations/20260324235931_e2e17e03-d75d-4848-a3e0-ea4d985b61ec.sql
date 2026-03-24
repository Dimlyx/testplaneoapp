-- Remove the pg_net trigger since it doesn't work reliably
DROP TRIGGER IF EXISTS trigger_send_push_on_notification ON public.notifications;
DROP FUNCTION IF EXISTS public.send_push_on_notification();

-- Update the existing notify_technician_assignment to also call the edge function via pg_net with proper auth
CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _notification_id uuid;
BEGIN
  IF (NEW.technician_id IS NOT NULL AND (OLD.technician_id IS NULL OR OLD.technician_id <> NEW.technician_id)) THEN
    INSERT INTO public.notifications (user_id, title, message, type, intervention_id)
    VALUES (
      NEW.technician_id,
      'Nouvelle intervention assignée',
      'L''intervention "' || NEW.title || '" vous a été assignée.',
      'assignment',
      NEW.id
    )
    RETURNING id INTO _notification_id;

    -- Send push notification via edge function (non-blocking, errors are ignored)
    BEGIN
      PERFORM net.http_post(
        url := 'https://gwqjwclvrihumhqzoikv.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'userId', NEW.technician_id::text,
          'title', 'Nouvelle intervention assignée',
          'message', 'L''intervention "' || NEW.title || '" vous a été assignée.',
          'interventionId', NEW.id::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Push notification send failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;