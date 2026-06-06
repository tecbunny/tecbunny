import { NextResponse } from 'next/server';

import { createServiceClient, isSupabaseServiceConfigured, createClient } from '@/lib/supabase/server';

const BRAND_LOGO_URL = '/logo.png';

export async function GET() {
  try {
    // Use service client to bypass RLS
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    // Get site settings
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['siteName', 'siteDescription', 'logoUrl', 'faviconUrl', 'partnerBrands']);
    
    if (error) {
      console.error('Error fetching settings:', error);
    }
    
    // Convert to object
    const settingsMap = new Map();
    settings?.forEach(setting => {
      settingsMap.set(setting.key, setting.value);
    });
    
    const rawLogoUrl = settingsMap.get('logoUrl');
    let logoUrl = BRAND_LOGO_URL;
    if (rawLogoUrl && typeof rawLogoUrl === 'string') {
      const trimmed = rawLogoUrl.trim();
      if (trimmed && trimmed !== 'logo.png' && trimmed !== '/logo.png') {
        logoUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')
          ? trimmed
          : '/' + trimmed;
      }
    }

    const metadata = {
      siteName: settingsMap.get('siteName') || 'TecBunny - Your Tech Store',
      description: settingsMap.get('siteDescription') || 'Discover the latest technology with beautiful design and exceptional user experience.',
      logoUrl,
      faviconUrl: settingsMap.get('faviconUrl') || '/favicon.ico',
      partnerBrands: settingsMap.get('partnerBrands') || 'CP PLUS, HIKVISION, DAHUA, UBIQUITI, CISCO, TP-LINK',
    };
    
    return NextResponse.json(metadata);
    
  } catch (error) {
    console.error('Error in metadata API:', error);
    
    // Return default metadata
    return NextResponse.json({
      siteName: 'TecBunny - Your Tech Store',
      description: 'Discover the latest technology with beautiful design and exceptional user experience.',
      logoUrl: BRAND_LOGO_URL,
      faviconUrl: '/favicon.ico',
      partnerBrands: 'CP PLUS, HIKVISION, DAHUA, UBIQUITI, CISCO, TP-LINK',
    });
  }
}
