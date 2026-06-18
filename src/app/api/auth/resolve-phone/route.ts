import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

export async function POST(request: NextRequest) {
  try {
    const { mobile } = await request.json();
    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const normalizedMobile = String(mobile).replace(/\D/g, '');
    const phone = normalizedMobile.length === 10 ? `91${normalizedMobile}` : normalizedMobile;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('mobile', phone)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ email: `${phone}@tecbunny.phone` });
    }

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    return NextResponse.json({ email: `${phone}@tecbunny.phone` });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
