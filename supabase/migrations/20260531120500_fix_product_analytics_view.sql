-- Fix security definer view lint error
ALTER VIEW public.product_analytics_view SET (security_invoker = on);
