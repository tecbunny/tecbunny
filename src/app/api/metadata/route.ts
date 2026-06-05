import { NextResponse } from 'next/server';

import { createServiceClient , isSupabaseServiceConfigured , createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Use service client to bypass RLS
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    // Get site settings
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['siteName', 'siteDescription', 'logoUrl', 'faviconUrl']);
    
    if (error) {
      console.error('Error fetching settings:', error);
    }
    
    // Convert to object
    const settingsMap = new Map();
    settings?.forEach(setting => {
      settingsMap.set(setting.key, setting.value);
    });
    
    const metadata = {
      siteName: settingsMap.get('siteName') || 'TecBunny - Your Tech Store',
      description: settingsMap.get('siteDescription') || 'Discover the latest technology with beautiful design and exceptional user experience.',
      logoUrl: settingsMap.get('logoUrl') || '/logo.png',
      faviconUrl: settingsMap.get('faviconUrl') || '/favicon.ico',
    };
    
    return NextResponse.json(metadata);
    
  } catch (error) {
    console.error('Error in metadata API:', error);
    
    // Return default metadata
    return NextResponse.json({
      siteName: 'TecBunny - Your Tech Store',
      description: 'Discover the latest technology with beautiful design and exceptional user experience.',
      logoUrl: '/logo.png',
      faviconUrl: '/favicon.ico',
    });
  }
}
