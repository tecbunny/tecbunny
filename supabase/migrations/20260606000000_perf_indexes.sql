-- Migration: Create lookup performance indexes to eliminate full-table scans
-- Date: 2026-06-06

DO $$
BEGIN
  -- 1. Index on otp_verifications(code) for faster code validations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'code') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_code ON public.otp_verifications(code);
    END IF;
  END IF;

  -- 2. Index on order_otp_verifications(otp_code) for atomic OTP checks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_otp_verifications' AND column_name = 'otp_code') THEN
      CREATE INDEX IF NOT EXISTS idx_order_otp_verifications_otp_code ON public.order_otp_verifications(otp_code);
    END IF;
  END IF;

  -- 3. Indexes on webhook_events for audit logging and pruning operations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'event_type') THEN
      CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);
    END IF;
  END IF;

  -- 4. Index on payment_transactions(order_id) (conditional fallback if table is present)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'order_id') THEN
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
    END IF;
  END IF;
END $$;
