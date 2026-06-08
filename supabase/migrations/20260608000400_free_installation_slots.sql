-- Free Installation Slots Tracking Table
CREATE TABLE IF NOT EXISTS public.free_installation_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 10,
  remaining_slots INTEGER NOT NULL DEFAULT 10,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month)
);

-- Add column to orders table to track if free installation was used
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS used_free_installation BOOLEAN DEFAULT FALSE;

-- Create an index for efficient monthly lookups
CREATE INDEX IF NOT EXISTS idx_free_installation_slots_month 
ON public.free_installation_slots(month);

-- Add RLS policies
ALTER TABLE public.free_installation_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to free installation slots" 
ON public.free_installation_slots 
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Allow authenticated update of free installation slots" 
ON public.free_installation_slots 
FOR UPDATE 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Function to get or create monthly slot record
CREATE OR REPLACE FUNCTION get_or_create_monthly_slot()
RETURNS TABLE (id UUID, remaining_slots INTEGER) AS $$
DECLARE
  v_month DATE;
  v_slot_record RECORD;
BEGIN
  v_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Try to get existing record
  SELECT * INTO v_slot_record FROM free_installation_slots WHERE month = v_month;
  
  IF v_slot_record IS NULL THEN
    -- Create new record for this month
    INSERT INTO free_installation_slots (month, total_slots, remaining_slots, confirmed_count)
    VALUES (v_month, 10, 10, 0)
    RETURNING free_installation_slots.id, free_installation_slots.remaining_slots INTO id, remaining_slots;
  ELSE
    id := v_slot_record.id;
    remaining_slots := v_slot_record.remaining_slots;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement slots (called when order is confirmed)
CREATE OR REPLACE FUNCTION decrement_free_installation_slot()
RETURNS BOOLEAN AS $$
DECLARE
  v_month DATE;
  v_remaining INTEGER;
BEGIN
  v_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  UPDATE free_installation_slots 
  SET remaining_slots = GREATEST(0, remaining_slots - 1),
      confirmed_count = confirmed_count + 1,
      updated_at = NOW()
  WHERE month = v_month;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
