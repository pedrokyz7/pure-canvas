CREATE POLICY "Barbers can read client roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'barber') AND role = 'client'
);