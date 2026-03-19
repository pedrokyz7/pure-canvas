
-- Drop existing trigger/function if they exist (in case partial creation)
DROP TRIGGER IF EXISTS trigger_cascade_freeze ON public.profiles;
DROP FUNCTION IF EXISTS public.cascade_freeze_to_barbers();

-- Recreate function
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

-- Create trigger
CREATE TRIGGER trigger_cascade_freeze
AFTER UPDATE OF is_frozen ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cascade_freeze_to_barbers();
