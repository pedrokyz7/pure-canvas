
CREATE OR REPLACE FUNCTION public.cascade_freeze_to_barbers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_frozen IS DISTINCT FROM NEW.is_frozen THEN
    UPDATE public.profiles
    SET is_frozen = NEW.is_frozen
    WHERE admin_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cascade_freeze
AFTER UPDATE OF is_frozen ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cascade_freeze_to_barbers();
