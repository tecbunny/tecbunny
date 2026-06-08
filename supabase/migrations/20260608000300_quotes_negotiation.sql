-- Migration: 20260608000300_quotes_negotiation.sql

-- Add columns for negotiation
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS bidded_price NUMERIC,
ADD COLUMN IF NOT EXISTS counter_price NUMERIC,
ADD COLUMN IF NOT EXISTS negotiation_clauses TEXT;

-- We don't have a strict check constraint on status in the original table probably, 
-- but if we do, we might need to drop it. Assuming it's just TEXT for now.
