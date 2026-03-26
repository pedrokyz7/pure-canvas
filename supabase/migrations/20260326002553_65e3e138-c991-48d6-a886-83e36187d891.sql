
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_frozen BOOLEAN DEFAULT false,
  admin_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Barbers can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TYPE public.app_role AS ENUM ('barber', 'client', 'admin', 'super_admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'masculino',
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Barbers can manage own services" ON public.services FOR ALL TO authenticated USING (auth.uid() = barber_id) WITH CHECK (auth.uid() = barber_id);

-- Barber schedules table
CREATE TABLE public.barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (barber_id, day_of_week)
);

ALTER TABLE public.barber_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedules" ON public.barber_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Barbers can manage own schedules" ON public.barber_schedules FOR ALL TO authenticated USING (auth.uid() = barber_id) WITH CHECK (auth.uid() = barber_id);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  barber_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  price NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'local',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Barbers can read own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = barber_id);
CREATE POLICY "Clients can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Barbers can update own appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = barber_id);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Billing settings table (super_admin manages)
CREATE TABLE public.billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read billing settings" ON public.billing_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage billing" ON public.billing_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Billing payments table
CREATE TABLE public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT,
  payment_method TEXT DEFAULT 'pix',
  notes TEXT,
  subscription_activated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own payments" ON public.billing_payments FOR SELECT TO authenticated USING (auth.uid() = admin_user_id);
CREATE POLICY "Anyone can insert payments" ON public.billing_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Super admins can read all payments" ON public.billing_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can update payments" ON public.billing_payments FOR UPDATE TO authenticated USING (true);

-- has_role function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
