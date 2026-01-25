-- Step 1: Add super_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Step 2: Create organizations table for multi-tenant support
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    logo_url text,
    email text,
    phone text,
    address text,
    city text,
    postal_code text,
    siret text,
    tva_number text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    max_users integer DEFAULT 5,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'unpaid')),
    trial_ends_at timestamp with time zone DEFAULT (now() + interval '14 days'),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();