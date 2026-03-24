-- Create or replace the trigger function to also send push notifications via edge function
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call edge function via pg_net to send push notification
  PERFORM net.http_post(
    url := 'https://gwqjwclvrihumhqzoikv.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id::text,
      'title', NEW.title,
      'message', COALESCE(NEW.message, ''),
      'interventionId', NEW.intervention_id::text
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trigger_send_push_on_notification ON public.notifications;
CREATE TRIGGER trigger_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_notification();