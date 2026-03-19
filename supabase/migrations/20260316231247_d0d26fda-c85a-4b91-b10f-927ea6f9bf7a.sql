CREATE POLICY "Clients can read barber and admin roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (role IN ('barber', 'admin'));