-- Advance Payment Requests Table
CREATE TABLE IF NOT EXISTS public.advance_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  advance_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'payu', -- 'payu' or 'wire_transfer'
  payment_terms TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, payment_initiated, paid, completed
  customer_notes TEXT,
  final_quotation_url TEXT,
  payu_payment_id TEXT,
  transaction_id TEXT,
  payment_reference TEXT,
  confirmed_at TIMESTAMPTZ,
  payment_completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add status column to quotes table to track advance payment state
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS advance_payment_id UUID REFERENCES public.advance_payment_requests(id) ON DELETE SET NULL;

-- Update quote status enum to include new states
-- Note: If quote_status enum doesn't exist yet, create it
CREATE TYPE advance_payment_status AS ENUM ('pending', 'confirmed', 'payment_initiated', 'paid', 'completed');

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_quote_id 
ON public.advance_payment_requests(quote_id);

CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_status 
ON public.advance_payment_requests(status);

CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_admin_id 
ON public.advance_payment_requests(admin_id);

-- Enable RLS
ALTER TABLE public.advance_payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers can view their own advance payment requests
CREATE POLICY "Customers can view their own advance requests" 
ON public.advance_payment_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = advance_payment_requests.quote_id 
    AND quotes.user_id = auth.uid()
  )
);

-- Admins can view all advance payment requests
CREATE POLICY "Admins can view all advance requests" 
ON public.advance_payment_requests 
FOR SELECT 
TO authenticated
USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));

-- Admins can create advance payment requests
CREATE POLICY "Admins can create advance requests" 
ON public.advance_payment_requests 
FOR INSERT 
TO authenticated
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));

-- Admins can update advance payment requests
CREATE POLICY "Admins can update advance requests" 
ON public.advance_payment_requests 
FOR UPDATE 
TO authenticated
USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'))
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));

-- Customers can update their own advance requests (confirm, upload file)
CREATE POLICY "Customers can update their advance requests" 
ON public.advance_payment_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = advance_payment_requests.quote_id 
    AND quotes.user_id = auth.uid()
  )
);

-- Audit trigger to track status changes
CREATE OR REPLACE FUNCTION track_advance_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_value,
      new_value,
      changed_by,
      created_at
    ) VALUES (
      'advance_payment_requests',
      NEW.id,
      'status_update',
      OLD.status,
      NEW.status,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER advance_payment_status_change_trigger
AFTER UPDATE ON public.advance_payment_requests
FOR EACH ROW
EXECUTE FUNCTION track_advance_payment_status_change();
