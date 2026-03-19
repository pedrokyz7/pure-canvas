
ALTER TABLE public.billing_payments ADD COLUMN payment_method text NOT NULL DEFAULT 'pix';
ALTER TABLE public.billing_payments ADD COLUMN subscription_activated boolean NOT NULL DEFAULT false;
