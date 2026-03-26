
-- Insert profiles for existing users
INSERT INTO public.profiles (user_id, full_name, phone) VALUES
  ('c2868612-9b7e-489a-ae0b-f3b96aa1aa54', 'adm barbeiro', '34999844129'),
  ('de3c3949-1230-4054-84c6-9fd7e8e5e16f', 'c', '23432432423'),
  ('db5b190d-81be-48f9-b6ea-33915ce09826', 'cliente tetste3', '34999844129'),
  ('c1b44119-5f39-456c-bd27-6795b6724b8b', 'cliente1teste1', '43245324542')
ON CONFLICT (user_id) DO NOTHING;

-- Set admin@blackoutbarber.com as barber (admin role)
INSERT INTO public.user_roles (user_id, role) VALUES
  ('c2868612-9b7e-489a-ae0b-f3b96aa1aa54', 'barber')
ON CONFLICT (user_id, role) DO NOTHING;

-- Set other users as clients
INSERT INTO public.user_roles (user_id, role) VALUES
  ('de3c3949-1230-4054-84c6-9fd7e8e5e16f', 'client'),
  ('db5b190d-81be-48f9-b6ea-33915ce09826', 'client'),
  ('c1b44119-5f39-456c-bd27-6795b6724b8b', 'client')
ON CONFLICT (user_id, role) DO NOTHING;
