import { NextRequest, NextResponse } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Limit: 3 payment-failed emails per 5 minutes per user/IP
const LIMIT = 3;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, orderData, paymentData } = body || {};

    if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }
    if (!orderData || typeof orderData !== 'object') {
      return NextResponse.json({ error: 'Invalid orderData' }, { status: 400 });
    }

    // Rate limit by authenticated user or IP
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch(_ignoreErr) {}
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    if (!rateLimit(rateKey, 'email_payment_failed', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const success = await emailHelpers.sendPaymentFailed(to, orderData, paymentData || {});
    const res = success
      ? NextResponse.json({ success: true, message: 'Payment failed email sent' })
      : NextResponse.json({ error: 'Failed to send payment failed email' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  } catch (error) {
    console.error('Payment failed email API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
