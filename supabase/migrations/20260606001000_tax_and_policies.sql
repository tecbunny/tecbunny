-- Migration: Create tax_rates, hsn_codes, and policies schemas and defaults
-- Date: 2026-06-06

BEGIN;

-- 1. Create tax_rates table
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create hsn_codes table
CREATE TABLE IF NOT EXISTS public.hsn_codes (
  code VARCHAR(20) PRIMARY KEY,
  tax_rate_id INTEGER REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create policies table
CREATE TABLE IF NOT EXISTS public.policies (
  key VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS and create standard select policies
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tax_rates_public_select ON public.tax_rates;
CREATE POLICY rls_tax_rates_public_select ON public.tax_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_hsn_codes_public_select ON public.hsn_codes;
CREATE POLICY rls_hsn_codes_public_select ON public.hsn_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_policies_public_select ON public.policies;
CREATE POLICY rls_policies_public_select ON public.policies FOR SELECT USING (is_published = true);

-- Add manager/admin manage policies
DROP POLICY IF EXISTS rls_tax_rates_admin_manage ON public.tax_rates;
CREATE POLICY rls_tax_rates_admin_manage ON public.tax_rates FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS rls_hsn_codes_admin_manage ON public.hsn_codes;
CREATE POLICY rls_hsn_codes_admin_manage ON public.hsn_codes FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS rls_policies_admin_manage ON public.policies;
CREATE POLICY rls_policies_admin_manage ON public.policies FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 5. Seed tax_rates
INSERT INTO public.tax_rates (name, rate, is_default, description)
VALUES
  ('GST 5%', 5.00, false, 'Standard 5% GST rate'),
  ('GST 12%', 12.00, false, 'Standard 12% GST rate'),
  ('GST 18%', 18.00, true, 'Standard 18% GST rate'),
  ('GST 28%', 28.00, false, 'Standard 28% GST rate')
ON CONFLICT (name) DO UPDATE SET
  rate = EXCLUDED.rate,
  is_default = EXCLUDED.is_default,
  description = EXCLUDED.description;

-- 6. Seed default HSN codes
INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8471', id, 18.00, 'Computers and automatic data processing units' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8504', id, 18.00, 'Electrical transformers, static converters and inductors' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8544', id, 18.00, 'Insulated wire, cable and other conductors' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

-- 7. Seed default settings keys
INSERT INTO public.settings (key, value, description, updated_at)
VALUES
  ('phone', '+91 96041 36010', 'Primary Support Phone Number', NOW()),
  ('support_email', 'support@tecbunny.com', 'Primary Support Email Address', NOW()),
  ('whatsapp_template_string', 'https://wa.me/919604136010', 'WhatsApp Contact Quick Link', NOW()),
  ('facebook_pixel_id', '1234567890', 'Facebook Tracking Pixel ID', NOW()),
  ('default_gst_rate', '18.00', 'Standard fallback GST percentage rate', NOW())
ON CONFLICT (key) DO NOTHING;

-- 8. Populate policies table from page_content table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_content') THEN
    INSERT INTO public.policies (key, title, content, is_published, created_at, updated_at)
    SELECT 
      COALESCE(page_key, key),
      title,
      content::jsonb,
      CASE WHEN status = 'published' THEN true ELSE false END,
      created_at,
      updated_at
    FROM public.page_content
    WHERE page_key IN ('privacy_policy', 'terms_of_service', 'refund_cancellation_policy', 'shipping_policy', 'return_policy')
       OR key IN ('privacy_policy', 'terms_of_service', 'refund_cancellation_policy', 'shipping_policy', 'return_policy')
    ON CONFLICT (key) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      is_published = EXCLUDED.is_published,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

COMMIT;
