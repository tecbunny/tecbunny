-- Migration to add terms_and_conditions to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
