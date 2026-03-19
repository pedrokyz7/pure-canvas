
CREATE TABLE public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  amount numeric NOT NULL,
  billing_period text NOT NULL DEFAULT 'monthly',
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid
);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage billing_payments"
ON public.billing_payments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can read own billing_payments"
ON public.billing_payments FOR SELECT TO authenticated
USING (auth.uid() = admin_user_id);
