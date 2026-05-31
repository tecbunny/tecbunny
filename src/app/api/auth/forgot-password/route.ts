import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import type { User } from '@supabase/supabase-js';

import { verifyCaptcha } from '../../../../lib/captcha/captcha-service';
import { logger } from '../../../../lib/logger';
import MultiChannelOTPManager, { type OTPChannel } from '../../../../lib/multi-channel-otp-manager';

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(email);
  
  if (!limit) {
    rateLimitMap.set(email, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minutes
    return false;
  }
  
  if (now > limit.resetTime) {
    rateLimitMap.set(email, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return false;
  }
  
  if (limit.count >= 3) { // Max 3 attempts per 15 minutes
    return true;
  }
  
  limit.count++;
  return false;
}

const otpService = new MultiChannelOTPManager();

export async function POST(request: NextRequest) {
  try {
    const { email, mobile, captchaToken, channel: requestedChannel } = await request.json();

    if (!email && !mobile) {
      return NextResponse.json(
        { error: 'Email or mobile number is required' },
        { status: 400 }
      );
    }

    const identifier = email || mobile;

    // Check rate limiting
    if (isRateLimited(identifier)) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
    }

    // CAPTCHA verification (only in production)
    if (process.env.NODE_ENV === 'production') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const captcha = await verifyCaptcha(captchaToken, ip);
      if (!captcha.success) {
        return NextResponse.json({ error: 'Captcha verification failed. Please retry.' }, { status: 400 });
      }
    } else {
      logger.debug('forgot_password.captcha_bypass', { identifier });
    }

    // Create admin client for user lookup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user exists via email or mobile
    if (email) {
      const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();
      logger.info('forgot_password.lookup_start', { identifier, totalUsers: users?.length || 0 });
      if (getUserError) {
        logger.error('forgot_password.user_lookup_failed', { error: getUserError, identifier });
        return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 500 });
      }
      const authUser = users.find((u: User) => u.email === email);
      if (!authUser) {
        logger.warn('forgot_password.user_missing', { identifier });
        return NextResponse.json({ success: true, message: 'If an account with this email or mobile exists, you will receive an OTP code.' });
      }
    } else if (mobile) {
      // Lookup by mobile in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email')
        .eq('mobile', mobile)
        .maybeSingle();
      if (profileError) {
        logger.error('forgot_password.profile_lookup_failed', { error: profileError, identifier });
        return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 500 });
      }
      if (!profile) {
        logger.warn('forgot_password.user_missing', { identifier });
        return NextResponse.json({ success: true, message: 'If an account with this email or mobile exists, you will receive an OTP code.' });
      }
      logger.info('forgot_password.profile_found', { identifier, userId: profile.id });
    }
    const normalizedChannel: OTPChannel = requestedChannel && ['sms', 'email', 'whatsapp'].includes(requestedChannel)
      ? requestedChannel
      : (email ? 'email' : (mobile ? 'sms' : 'email'));

    logger.info('forgot_password.sending_otp', { identifier, preferredChannel: normalizedChannel });

    const otpResult = await otpService.generateOTP({
      email,
      phone: mobile,
      preferredChannel: normalizedChannel,
      purpose: 'password_reset',
    });

    if (!otpResult.success || !otpResult.otpId) {
      logger.error('forgot_password.otp_generation_failed', { identifier, message: otpResult.message });
      return NextResponse.json({ error: otpResult.message || 'Failed to send OTP' }, { status: 500 });
    }

    logger.info('forgot_password.otp_sent', {
      identifier,
      otpId: otpResult.otpId,
      channel: otpResult.channel,
      fallbackAvailable: otpResult.fallbackAvailable,
    });

    const res = NextResponse.json({
      success: true,
      message: otpResult.message || `OTP sent via ${otpResult.channel}`,
      otpId: otpResult.otpId,
      channel: otpResult.channel,
      fallbackAvailable: otpResult.fallbackAvailable,
    });
    try {
      const payload = Buffer.from(JSON.stringify({ identifier, type: 'recovery', exp: Date.now() + 15 * 60 * 1000 }), 'utf8').toString('base64');
      res.cookies.set('recovery_otp', payload, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });
    } catch {}
    return res;

  } catch (error) {
    logger.error('forgot_password.unhandled_error', { error });
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
