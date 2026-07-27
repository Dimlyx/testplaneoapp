DROP TRIGGER IF EXISTS on_intervention_created_with_technician ON public.interventions;
DROP TRIGGER IF EXISTS on_technician_assigned ON public.interventions;

CREATE OR REPLACE FUNCTION public.notify_technician_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _notification_id uuid;
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3cWp3Y2x2cmlodW1ocXpvaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTYxNzYsImV4cCI6MjA4NDMzMjE3Nn0.cJuBPCvhOVkj5TlCvaWmRCLgUMDZ2s7PmEKQGG0wp8Y';
  _vault_key text;
BEGIN
  IF (NEW.technician_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.technician_id IS NULL OR OLD.technician_id <> NEW.technician_id)) THEN
    INSERT INTO public.notifications (user_id, title, message, type, intervention_id)
    VALUES (
      NEW.technician_id,
      'Nouvelle intervention assignée',
      'L''intervention "' || NEW.title || '" vous a été assignée.',
      'assignment',
      NEW.id
    )
    RETURNING id INTO _notification_id;

    BEGIN
      SELECT decrypted_secret INTO _vault_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_ANON_KEY'
      LIMIT 1;

      IF _vault_key IS NOT NULL THEN
        _anon_key := _vault_key;
      END IF;

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
$function$;