ALTER TABLE public.appointments ADD COLUMN payment_method text NOT NULL DEFAULT 'local';

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;