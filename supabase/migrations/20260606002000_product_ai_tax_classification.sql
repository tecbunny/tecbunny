-- Migration: Add AI-assisted product tax classification columns
-- Date: 2026-06-06

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_code TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tax_ai_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS tax_ai_justification TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_model TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_ai_requested_by UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_hsn_code_8_digit_chk,
  ADD CONSTRAINT products_hsn_code_8_digit_chk
    CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{8}$') NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_gst_rate_standard_tier_chk,
  ADD CONSTRAINT products_gst_rate_standard_tier_chk
    CHECK (gst_rate IS NULL OR gst_rate IN (0, 5, 12, 18, 28)) NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_tax_ai_confidence_range_chk,
  ADD CONSTRAINT products_tax_ai_confidence_range_chk
    CHECK (tax_ai_confidence IS NULL OR (tax_ai_confidence >= 0 AND tax_ai_confidence <= 1)) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products (hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON public.products (gst_rate);
CREATE INDEX IF NOT EXISTS idx_products_tax_ai_review ON public.products (tax_ai_reviewed, tax_ai_classified_at DESC);

COMMIT;
