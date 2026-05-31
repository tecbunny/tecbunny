import { NextRequest, NextResponse } from 'next/server';

import { emailHelpers } from '../../../../lib/email';
import { rateLimit } from '../../../../lib/rate-limit';
import { createClient as createServerClient } from '../../../../lib/supabase/server';

// Marketing emails: stricter (2 per 30m) due to bulk nature
const LIMIT = 2;
const WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { to, campaignTitle, campaignBody, ctaText, ctaUrl, bannerImageUrl, discountCode } = payload || {};
    if (!to) {
      return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 });
    }
    // Validate 'to': allow single email or array
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.some(e => typeof e !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
      return NextResponse.json({ error: 'Invalid recipient email(s)' }, { status: 400 });
    }
    // Auth (optional) to tighten rate key
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch(_) {}
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = userId ? `user:${userId}` : `ip:${ip}`;
    if (!rateLimit(rateKey, 'email_marketing', { limit: LIMIT, windowMs: WINDOW_MS })) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    const success = await emailHelpers.sendMarketingCampaign(recipients, {
      campaignTitle,
      campaignBody,
      ctaText,
      ctaUrl,
      bannerImageUrl,
      discountCode
    });
    const res = success
      ? NextResponse.json({ success: true, message: 'Marketing email(s) sent' })
      : NextResponse.json({ error: 'Failed to send marketing email(s)' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  } catch (error) {
    console.error('Marketing email API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
