-- Fix function search_path mutable
ALTER FUNCTION public.decrement_stock_with_serials SET search_path = '';
ALTER FUNCTION public.decrement_product_stock SET search_path = '';

-- Fix public bucket allows listing
DROP POLICY IF EXISTS "Hero banners are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Images are publicly accessible" ON storage.objects;

-- Fix anon and authenticated security definer function executable
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_contact_messages_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_contact_messages_updated_at() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_product_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_product_name() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_page_content_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_page_content_updated_at() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
