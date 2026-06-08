-- Architectural Stabilization Migration
-- 1. Fix Foreign Key constraint for stock_movements
-- 2. Prevent unauthorized role updates on profiles
-- 3. Add missing performance indexes

BEGIN;

-- 1. Add Foreign Key for stock_movements (ledger integrity)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_stock_movements_product'
    ) THEN
        ALTER TABLE public.stock_movements 
        ADD CONSTRAINT fk_stock_movements_product 
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;
END;
$$;

-- 2. Role Change Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_profile_role_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allows role changes if the executor is an admin or superadmin
    -- We use the existing public.is_admin_user() or public.is_manager_or_admin() helpers
    IF OLD.role IS DISTINCT FROM NEW.role AND NOT (
        public.is_manager_or_admin() OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    ) THEN
        -- If not an admin, silently preserve the original role
        NEW.role := OLD.role;
        -- Optionally log this attempt
        -- INSERT INTO public.security_audit_log (action, user_id, notes) 
        -- VALUES ('unauthorized_role_change_attempt', auth.uid(), 'User ' || auth.uid() || ' tried to change role from ' || OLD.role || ' to ' || NEW.role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_role_column ON public.profiles;
CREATE TRIGGER tr_protect_profile_role_column
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_column();

-- 3. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON public.orders(status, payment_status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 4. Create missing payment_transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    transaction_id TEXT UNIQUE NOT NULL,
    payment_method TEXT,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL,
    gateway_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);

COMMIT;
