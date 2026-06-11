-- Migration: Add Composite Indexes for high-frequency filters
-- Target: orders, products

-- Create composite index on orders (status, payment_status)
CREATE INDEX IF NOT EXISTS idx_orders_status_payment 
ON public.orders (status, payment_status);

-- Create composite index on products (is_deleted, status, category)
CREATE INDEX IF NOT EXISTS idx_products_active_status
ON public.products (is_deleted, status, category);

-- Composite index on auth profiles for staff filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role_active
ON public.profiles (role, is_active);
