import { NextRequest, NextResponse } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { requireApiRole } from '@/lib/server-role-guard';

// Marketing emails: stricter (2 per 30m) due to bulk nature
const LIMIT = 2;
const WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiRole({ allowedRoles: ['manager'], minimumRole: 'admin' });
    if ('error' in access) {
      return access.error;
    }

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = access.session?.user.id ? `user:${access.session.user.id}` : `ip:${ip}`;
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
