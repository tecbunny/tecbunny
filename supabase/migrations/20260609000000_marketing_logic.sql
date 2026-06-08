-- Migration to support programmatic marketing logic

-- 1. Create wishlist_items table if not exists
CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, product_id)
);

-- 2. Add bulk_pricing_tiers to products if not exists
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS bulk_pricing_tiers JSONB DEFAULT '[]'::jsonb;

-- 2. Add behavioral matching metadata to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS marketing_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Function to match wishlist items with available coupons for inactive users
CREATE OR REPLACE FUNCTION public.match_wishlist_coupons()
RETURNS TRIGGER AS $$
DECLARE
    user_wishlist_count INT;
    available_coupon_code TEXT;
    marketing_meta JSONB;
BEGIN
    -- Check if user has high wishlist items but zero orders
    SELECT COUNT(*) INTO user_wishlist_count 
    FROM public.wishlist_items 
    WHERE profile_id = NEW.profile_id;

    IF user_wishlist_count >= 3 AND NOT EXISTS (SELECT 1 FROM public.orders WHERE customer_email = (SELECT email FROM auth.users WHERE id = NEW.profile_id)) THEN
        -- Find an active seasonal coupon
        SELECT code INTO available_coupon_code 
        FROM public.coupons 
        WHERE status = 'active' 
        AND type = 'percentage'
        AND expiry_date > NOW()
        ORDER BY value DESC
        LIMIT 1;

        IF available_coupon_code IS NOT NULL THEN
            -- Update profile metadata to surface this coupon on next visit
            SELECT marketing_metadata INTO marketing_meta FROM public.profiles WHERE id = NEW.profile_id;
            marketing_meta = jsonb_set(
                COALESCE(marketing_meta, '{}'::jsonb), 
                '{suggested_coupon}', 
                jsonb_build_object(
                    'code', available_coupon_code,
                    'reason', 'wishlist_loyalty',
                    'matched_at', NOW()
                )
            );
            
            UPDATE public.profiles 
            SET marketing_metadata = marketing_meta 
            WHERE id = NEW.profile_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for wishlist matching
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlist_items') THEN
        DROP TRIGGER IF EXISTS trigger_match_wishlist_coupons ON public.wishlist_items;
        CREATE TRIGGER trigger_match_wishlist_coupons
        AFTER INSERT ON public.wishlist_items
        FOR EACH ROW EXECUTE FUNCTION public.match_wishlist_coupons();
    END IF;
END $$;

-- 5. Recovery Queue for Payment Failures
CREATE TABLE IF NOT EXISTS public.payment_recovery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    failure_reason TEXT,
    recovery_status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_recovery_order ON public.payment_recovery_queue(order_id);
