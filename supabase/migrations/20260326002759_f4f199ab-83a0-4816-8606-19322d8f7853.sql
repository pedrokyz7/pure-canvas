
-- Fix overly permissive RLS policies

-- notifications: restrict insert to own user_id
DROP POLICY "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow service role / edge functions to insert notifications for any user
CREATE POLICY "Service can insert notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- billing_settings: restrict to super_admin via has_role
DROP POLICY "Super admins can manage billing" ON public.billing_settings;
CREATE POLICY "Super admins can manage billing" ON public.billing_settings FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- billing_payments: restrict insert
DROP POLICY "Anyone can insert payments" ON public.billing_payments;
CREATE POLICY "Admins can insert own payments" ON public.billing_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_user_id);

-- billing_payments: restrict super_admin policies
DROP POLICY "Super admins can read all payments" ON public.billing_payments;
CREATE POLICY "Super admins can read all payments" ON public.billing_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY "Super admins can update payments" ON public.billing_payments;
CREATE POLICY "Super admins can update payments" ON public.billing_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
