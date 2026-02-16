-- Add plan column to organizations
ALTER TABLE public.organizations 
ADD COLUMN plan text NOT NULL DEFAULT 'essentiel';

-- Add a check constraint for valid plan values
CREATE OR REPLACE FUNCTION public.validate_organization_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan NOT IN ('essentiel', 'business') THEN
    RAISE EXCEPTION 'Invalid plan value: %. Must be essentiel or business', NEW.plan;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_organization_plan
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.validate_organization_plan();