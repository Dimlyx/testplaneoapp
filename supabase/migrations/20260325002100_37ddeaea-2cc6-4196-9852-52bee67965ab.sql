-- Fix the trigger to include proper auth headers for the edge function
CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _notification_id uuid;
  _anon_key text;
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

    -- Send push notification via edge function with proper auth headers
    BEGIN
      SELECT decrypted_secret INTO _anon_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_ANON_KEY'
      LIMIT 1;

      PERFORM net.http_post(
        url := 'https://gwqjwclvrihumhqzoikv.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', _anon_key,
          'Authorization', 'Bearer ' || _anon_key
        ),
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

-- Make sure the trigger exists on interventions
DROP TRIGGER IF EXISTS trigger_notify_technician ON public.interventions;
CREATE TRIGGER trigger_notify_technician
  AFTER INSERT OR UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_technician_assignment();