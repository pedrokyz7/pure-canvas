
-- Function to create notification when appointment is cancelled by barber
CREATE OR REPLACE FUNCTION public.notify_client_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _barber_name TEXT;
  _service_name TEXT;
  _appt_date TEXT;
BEGIN
  -- Only trigger when status changes to 'cancelled' and it was the barber who did it
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND auth.uid() = NEW.barber_id THEN
    SELECT full_name INTO _barber_name FROM public.profiles WHERE user_id = NEW.barber_id LIMIT 1;
    SELECT name INTO _service_name FROM public.services WHERE id = NEW.service_id LIMIT 1;
    _appt_date := to_char(NEW.appointment_date, 'DD/MM/YYYY');

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.client_id,
      'Agendamento Cancelado',
      'O barbeiro ' || COALESCE(_barber_name, 'Barbeiro') || ' cancelou o serviço "' || COALESCE(_service_name, 'Serviço') || '" do dia ' || _appt_date || ' (' || to_char(NEW.start_time, 'HH24:MI') || ' - ' || to_char(NEW.end_time, 'HH24:MI') || ').',
      'cancellation'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
CREATE TRIGGER on_appointment_cancelled_notify_client
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_cancellation();
