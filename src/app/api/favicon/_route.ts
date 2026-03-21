import { NextResponse } from 'next/server';

import { createClient } from '../../../lib/supabase/client';

// export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // For static export, just return a simple response directing to the static favicon
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.redirect('/favicon.ico');
    }

    const supabase = createClient();
    
    // Get favicon URL from settings
    const { data: faviconSetting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'faviconUrl')
      .single();
    
    if (error || !faviconSetting?.value) {
      // Fallback to default favicon - redirect instead of fetch for static export
      return NextResponse.redirect('/favicon.ico');
    }
    
    // Fetch the favicon from storage
    const faviconResponse = await fetch(faviconSetting.value);
    
    if (!faviconResponse.ok) {
      throw new Error('Failed to fetch favicon from storage');
    }
    
    return new NextResponse(faviconResponse.body, {
      headers: {
        'Content-Type': faviconResponse.headers.get('Content-Type') || 'image/x-icon',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error serving dynamic favicon:', error);
    
    // Fallback to default favicon - redirect for static export compatibility
    return NextResponse.redirect('/favicon.ico');
  }
}
