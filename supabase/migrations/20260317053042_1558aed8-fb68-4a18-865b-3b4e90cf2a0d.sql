
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT NULL;
