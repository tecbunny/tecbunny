import { NextResponse } from 'next/server';

import { createServiceClient } from '../../../lib/supabase/server';

export async function GET() {
  try {
    // Use service client to bypass RLS
    const supabase = createServiceClient();
    
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
      logoUrl: settingsMap.get('logoUrl') || '/logo.svg',
      faviconUrl: settingsMap.get('faviconUrl') || '/favicon.ico',
    };
    
    return NextResponse.json(metadata);
    
  } catch (error) {
    console.error('Error in metadata API:', error);
    
    // Return default metadata
    return NextResponse.json({
      siteName: 'TecBunny - Your Tech Store',
      description: 'Discover the latest technology with beautiful design and exceptional user experience.',
      logoUrl: '/logo.svg',
      faviconUrl: '/favicon.ico',
    });
  }
}
