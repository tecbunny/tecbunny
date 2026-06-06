import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { getPageContentServer } from './page-content';
import { logger } from './logger';

const DEFAULT_SUPPORT_PHONE = '+91 96041 36010';
const DEFAULT_SUPPORT_EMAIL = 'support@tecbunny.com';
const DEFAULT_WHATSAPP_LINK = 'https://wa.me/919604136010';
const DEFAULT_FACEBOOK_PIXEL_ID = '1234567890';
const DEFAULT_GST_RATE = 18;

async function getSupabaseClient() {
  return isSupabaseServiceConfigured ? createServiceClient() : await createClient();
}

/**
 * Fetch a setting value by its key from the settings table
 */
export async function getSettingValue(key: string, fallback: string): Promise<string> {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
      
    if (error) {
      logger.warn('Failed to fetch setting key from database', { key, error: error.message });
      return fallback;
    }
    
    if (data?.value !== undefined && data?.value !== null) {
      return String(data.value).trim();
    }
  } catch (err) {
    logger.error('Error in getSettingValue helper', { key, error: err });
  }
  return fallback;
}

/**
 * Get dynamic support phone number
 */
export async function getSupportPhone(): Promise<string> {
  // Use environment variable if present, else database, else hardcoded fallback
  const envVal = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  if (envVal) return envVal;
  return getSettingValue('phone', DEFAULT_SUPPORT_PHONE);
}

/**
 * Get dynamic support email address
 */
export async function getSupportEmail(): Promise<string> {
  const envVal = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (envVal) return envVal;
  return getSettingValue('support_email', DEFAULT_SUPPORT_EMAIL);
}

/**
 * Get dynamic WhatsApp template contact link
 */
export async function getWhatsAppLink(): Promise<string> {
  const envVal = process.env.NEXT_PUBLIC_WHATSAPP_LINK;
  if (envVal) return envVal;
  
  // If a custom phone number was configured in settings, we should format wa.me link with it
  const phone = await getSettingValue('phone', '');
  if (phone) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone) {
      const prefix = cleanPhone.length === 10 ? '91' : '';
      return `https://wa.me/${prefix}${cleanPhone}`;
    }
  }
  
  return getSettingValue('whatsapp_template_string', DEFAULT_WHATSAPP_LINK);
}

/**
 * Get dynamic Facebook tracking pixel ID
 */
export async function getFacebookPixelId(): Promise<string> {
  const envVal = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
  if (envVal) return envVal;
  return getSettingValue('facebook_pixel_id', DEFAULT_FACEBOOK_PIXEL_ID);
}

/**
 * Get default GST rate percentage (e.g. 18)
 */
export async function getDefaultGstPercentage(): Promise<number> {
  const envVal = process.env.NEXT_PUBLIC_GST_RATE;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed)) return parsed * 100; // e.g. 0.18 -> 18
  }
  const dbVal = await getSettingValue('default_gst_rate', String(DEFAULT_GST_RATE));
  const parsed = parseFloat(dbVal);
  return isNaN(parsed) ? DEFAULT_GST_RATE : parsed;
}

/**
 * Resolve product GST rate dynamically based on product settings and HSN codes
 */
export async function resolveProductGstRate(
  productId: string,
  dbGstRate?: number | null,
  dbHsnCode?: string | null
): Promise<number> {
  try {
    // 1. If explicit product-level rate exists, prioritize it
    if (dbGstRate !== undefined && dbGstRate !== null) {
      return typeof dbGstRate === 'number' ? dbGstRate : parseFloat(dbGstRate) || DEFAULT_GST_RATE;
    }

    // 2. If HSN code is present, lookup standard tax rate
    if (dbHsnCode) {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('hsn_codes')
        .select('gst_rate')
        .eq('code', dbHsnCode.trim())
        .maybeSingle();

      if (!error && data?.gst_rate !== undefined && data?.gst_rate !== null) {
        return parseFloat(String(data.gst_rate)) || DEFAULT_GST_RATE;
      }
    }
  } catch (err) {
    logger.warn('Failed to resolve custom product GST rate, falling back to default', { productId, error: err });
  }

  // 3. Fallback to default setting
  return getDefaultGstPercentage();
}

/**
 * Get policy page content from policies table or page_content fallback
 */
export async function getPolicyContent(pageKey: string, defaultTitle: string): Promise<any> {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('policies')
      .select('title, content')
      .eq('key', pageKey)
      .eq('is_published', true)
      .maybeSingle();

    if (!error && data) {
      return {
        title: data.title,
        content: typeof data.content === 'string' ? JSON.parse(data.content) : data.content
      };
    }
  } catch (err) {
    logger.warn('Failed to query policies table, falling back to page_content', { pageKey, error: err });
  }

  // Fallback to legacy page_content table
  const fallbackPage = await getPageContentServer(pageKey);
  if (fallbackPage) {
    return {
      title: fallbackPage.title,
      content: fallbackPage.content
    };
  }

  // Final static fallback
  return {
    title: defaultTitle,
    content: {
      title: defaultTitle,
      description: `Please contact us at ${DEFAULT_SUPPORT_EMAIL} for more details regarding our ${defaultTitle.toLowerCase()}.`,
      sections: []
    }
  };
}
