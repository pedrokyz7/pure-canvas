INSERT INTO public.user_roles (user_id, role)
SELECT
  p.user_id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.services s
      WHERE s.barber_id = p.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.barber_schedules bs
      WHERE bs.barber_id = p.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.barber_id = p.user_id
    )
    OR lower(coalesce(p.full_name, '')) LIKE '%barbeiro%'
    THEN 'barber'::public.app_role
    ELSE 'client'::public.app_role
  END AS role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;