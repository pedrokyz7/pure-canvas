
-- Allow super_admin to read all roles
CREATE POLICY "Super admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to manage appointments (for deletion)
CREATE POLICY "Super admins can delete appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to delete profiles
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to delete services
CREATE POLICY "Super admins can delete services"
ON public.services
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to delete schedules
CREATE POLICY "Super admins can delete barber_schedules"
ON public.barber_schedules
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to delete roles
CREATE POLICY "Super admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));
