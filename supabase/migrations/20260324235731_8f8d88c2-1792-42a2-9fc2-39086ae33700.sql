CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gwqjwclvrihumhqzoikv.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id::text,
        'title', NEW.title,
        'message', COALESCE(NEW.message, ''),
        'interventionId', COALESCE(NEW.intervention_id::text, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;