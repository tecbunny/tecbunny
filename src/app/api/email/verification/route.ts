import { NextRequest, NextResponse } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Email verification OTP: 5 per 30 minutes
const LIMIT = 5;
const WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { to, userName, otp } = await request.json();
    if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }
    if (!userName || typeof userName !== 'string' || !otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'Invalid userName or otp' }, { status: 400 });
    }
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
      const userEmail = user?.email?.trim().toLowerCase();
      if (!userId || !userEmail || userEmail !== to.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch(_ignoreErr) {}
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    if (!rateLimit(rateKey, 'email_verification', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    const success = await emailHelpers.sendEmailVerification(to, userName, otp);
    const res = success
      ? NextResponse.json({ success: true, message: 'Email verification sent successfully' })
      : NextResponse.json({ error: 'Failed to send email verification' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  } catch (error) {
    console.error('Email verification API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
