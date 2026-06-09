import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { OTPManager } from '@/lib/otp-manager';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const CLAIM_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

const claimSchema = z.object({
  mobile: z.string().min(10).max(15),
  otp: z.string().regex(/^\d{6}$/),
  otpId: z.string().min(1),
});

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      'anonymous';

    if (!rateLimit(ip, 'free_installation_claim', CLAIM_RATE_LIMIT)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid mobile number and 6-digit OTP are required.' }, { status: 400 });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    const otpManager = new OTPManager();
    const verification = await otpManager.verifyOTP({
      otpId: parsed.data.otpId,
      code: parsed.data.otp,
    });

    if (!verification.success) {
      return NextResponse.json({ error: verification.message || 'Invalid or expired OTP.' }, { status: 400 });
    }

    if (!isSupabaseServiceConfigured) {
      return NextResponse.json({ error: 'Service unavailable. Please try again later.' }, { status: 503 });
    }

    const supabase = createServiceClient();

    const { error: messageError } = await supabase.from('contact_messages').insert({
      name: 'Free Installation Claim',
      email: `claim+${mobile}@tecbunny.com`,
      phone: mobile,
      subject: 'Free Installation Offer Claim',
      message: `Customer verified via OTP and claimed a monthly free installation slot. Mobile: +91 ${mobile}`,
      status: 'New',
      ip_address: ip === 'anonymous' ? null : ip,
    });

    if (messageError) {
      logger.error('free_installation_claim_message_failed', { error: messageError.message });
      return NextResponse.json({ error: 'Could not record your claim. Please contact support.' }, { status: 500 });
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStart = currentMonth.toISOString().split('T')[0];

    const { data: existingSlot } = await supabase
      .from('free_installation_slots')
      .select('id, remaining_slots, confirmed_count')
      .eq('month', monthStart)
      .maybeSingle();

    if (existingSlot && existingSlot.remaining_slots > 0) {
      await supabase
        .from('free_installation_slots')
        .update({
          remaining_slots: existingSlot.remaining_slots - 1,
          confirmed_count: (existingSlot.confirmed_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSlot.id);
    }

    return NextResponse.json({ success: true, message: 'Offer claimed successfully.' });
  } catch (error) {
    logger.error('free_installation_claim_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to process claim.' }, { status: 500 });
  }
}
