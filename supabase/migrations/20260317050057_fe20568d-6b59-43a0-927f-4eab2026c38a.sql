
CREATE TABLE public.billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 99.90,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can read billing_settings"
ON public.billing_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert billing_settings"
ON public.billing_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update billing_settings"
ON public.billing_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admins (barber admins) can read to see their billing amount
CREATE POLICY "Admins can read billing_settings"
ON public.billing_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.billing_settings (billing_period, amount) VALUES ('monthly', 99.90);
