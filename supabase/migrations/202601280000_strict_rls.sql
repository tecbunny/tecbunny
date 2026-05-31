-- Enable RLS on core tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- PRODUCTS
-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

-- Public can read products
CREATE POLICY "Public can read products" 
ON public.products 
FOR SELECT 
TO public 
USING (true);

-- Admins can do everything on products
CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- PROFILES (Users)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

-- Admins can do everything on profiles
CREATE POLICY "Admins can manage profiles" 
ON public.profiles 
FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ORDERS
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;

-- Users can read their own orders
CREATE POLICY "Users can read own orders" 
ON public.orders 
FOR SELECT 
TO authenticated 
USING (customer_id = auth.uid());

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders" 
ON public.orders 
FOR INSERT 
TO authenticated 
WITH CHECK (customer_id = auth.uid());

-- Admins can do everything on orders
CREATE POLICY "Admins can manage orders" 
ON public.orders 
FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- QUOTES
DROP POLICY IF EXISTS "Users can read own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quotes;

-- Users can read their own quotes
CREATE POLICY "Users can read own quotes" 
ON public.quotes 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Users can insert their own quotes
CREATE POLICY "Users can insert own quotes" 
ON public.quotes 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Admins can do everything on quotes
CREATE POLICY "Admins can manage quotes" 
ON public.quotes 
FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
