import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { verifyCaptcha } from '../../../../lib/captcha/captcha-service';
import { logger } from '../../../../lib/logger';
import MultiChannelOTPManager, { type OTPChannel } from '../../../../lib/multi-channel-otp-manager';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
const otpService = new MultiChannelOTPManager();

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      logger.error('signup.supabase_config_missing');
      return NextResponse.json(
        {
          error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    // Test Supabase admin connection
    try {
      const { data: _testData, error: testError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (testError) {
        logger.error('signup.supabase_admin_connection_test_failed', { error: testError });
        return NextResponse.json(
          { error: 'Database connection error. Please check your configuration.' },
          { status: 503 }
        );
      }
    } catch (connError) {
      logger.error('signup.supabase_admin_connection_error', { error: connError });
      return NextResponse.json(
        { error: 'Database connection error. Please try again.' },
        { status: 503 }
      );
    }
    
  const { email, password, name, mobile: _mobile, captchaToken, channel: requestedChannel } = await request.json();

    // CAPTCHA verification (conditional if configured). Allow runtime bypass via header in non-production
    const bypassHeader = request.headers.get('x-bypass-captcha');
    const isBypassed = process.env.NODE_ENV !== 'production' && bypassHeader === '1';
    if (!isBypassed) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const captcha = await verifyCaptcha(captchaToken, ip);
      if (!captcha.success) {
        logger.warn('signup.captcha_failed', { email, ip });
        return NextResponse.json(
          { error: 'Captcha verification failed. Please retry.' },
          { status: 400 }
        );
      }
    } else {
      logger.debug('signup.captcha_bypassed', { email });
    }

    // Validate required fields
    if (!password || !name) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character' },
        { status: 400 }
      );
    }

    // Validate mobile if provided
    let mobile = _mobile;
    if (!mobile) {
      return NextResponse.json(
        { error: 'Mobile number is required' },
        { status: 400 }
      );
    }
    mobile = mobile.replace(/\D/g, ''); // Remove non-digits
    if (mobile.length < 10 || mobile.length > 15) {
      return NextResponse.json(
        { error: 'Mobile number must be between 10-15 digits' },
        { status: 400 }
      );
    }

    // Check if user already exists
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users.find((u: any) =>
        (email && u.email === email) ||
        (mobile && (u.phone === mobile || u.user_metadata?.mobile === mobile))
      );
      
      if (existingUser) {
        return NextResponse.json(
          { 
            error: 'An account with this email or mobile already exists', 
            code: 'USER_ALREADY_EXISTS'
          },
          { status: 409 }
        );
      }
    } catch (checkError) {
      logger.error('signup.check_existing_users_failed', { email, error: checkError });
      // Continue with signup attempt
    }

    // DO NOT CREATE USER YET - Only send OTP for verification
    // The user will be created AFTER OTP verification
    logger.info('signup.sending_otp', { email, mobile: !!mobile });

    const normalizedMobile = mobile || undefined;
    const preferredChannel: OTPChannel = (requestedChannel && ['email', 'sms', 'whatsapp'].includes(requestedChannel)) 
      ? requestedChannel as OTPChannel 
      : 'whatsapp';
    const enforcePreferredChannel = true;

    const otpResult = await otpService.generateOTP({
      email: email || undefined,
      phone: normalizedMobile,
      purpose: 'registration',
      preferredChannel,
      enforcePreferredChannel,
    });

    if (!otpResult.success || !otpResult.otpId) {
      logger.error('signup.otp_generation_failed', { email, mobile: normalizedMobile, message: otpResult.message });
      return NextResponse.json(
        { error: otpResult.message || 'Failed to send verification code' },
        { status: 500 }
      );
    }

    logger.info('signup.otp_dispatch_complete', {
      email,
      mobile: !!normalizedMobile,
      otpId: otpResult.otpId,
      channel: otpResult.channel,
      fallbackAvailable: otpResult.fallbackAvailable,
    });

    return NextResponse.json({
      message: otpResult.message ?? `Verification code sent via ${otpResult.channel}.`,
      otpSent: true,
      verificationRequired: true,
      otpId: otpResult.otpId,
      channel: otpResult.channel,
      fallbackAvailable: otpResult.fallbackAvailable,
      fallbackProvider: otpResult.provider,
      preferredChannel,
    });
  } catch (error) {
    logger.error('signup.internal_error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
