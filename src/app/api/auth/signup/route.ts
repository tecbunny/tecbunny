import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { verifyCaptcha } from '@/lib/captcha/captcha-service';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { OTPManager, type OTPChannel } from '@/lib/otp-manager';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SIGNUP_IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const SIGNUP_IDENTIFIER_LIMIT = { limit: 3, windowMs: 30 * 60 * 1000 };

function getClientIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin environment variables are not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
const otpService = new OTPManager();

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

    const { email, password, name, mobile: _mobile, captchaToken, channel: requestedChannel } = await request.json();
    const clientIp = getClientIp(request);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedMobile = typeof _mobile === 'string' ? _mobile.replace(/\D/g, '') : '';

    if (!rateLimit(clientIp, 'auth_signup_ip', SIGNUP_IP_LIMIT)) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }
    if (normalizedEmail && !rateLimit(`email:${normalizedEmail}`, 'auth_signup_identifier', SIGNUP_IDENTIFIER_LIMIT)) {
      return NextResponse.json({ error: 'Too many signup attempts for this email. Please try again later.' }, { status: 429 });
    }
    if (normalizedMobile && !rateLimit(`mobile:${normalizedMobile}`, 'auth_signup_identifier', SIGNUP_IDENTIFIER_LIMIT)) {
      return NextResponse.json({ error: 'Too many signup attempts for this mobile number. Please try again later.' }, { status: 429 });
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

    // CAPTCHA verification (conditional if configured)
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey) {
      const captcha = await verifyCaptcha(captchaToken, clientIp);
      if (!captcha.success) {
        logger.warn('signup.captcha_failed', { email: normalizedEmail || email, ip: clientIp, error: captcha.error || captcha.errorCodes });
        return NextResponse.json(
          { error: `Captcha verification failed: ${captcha.error || captcha.errorCodes?.join(', ') || 'Invalid captcha token'}` },
          { status: 400 }
        );
      }
    }

    // Validate required fields
    if (!password || !name) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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
    let mobile = normalizedMobile;
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
      const orConditions: string[] = [];
      if (normalizedEmail) {
        orConditions.push(`email.eq.${normalizedEmail}`);
      }
      if (mobile) {
        orConditions.push(`mobile.eq.${mobile}`);
      }

      if (orConditions.length > 0) {
        const { data: existingProfiles, error: checkError } = await supabaseAdmin
          .from('profiles')
          .select('id, email, mobile')
          .or(orConditions.join(','));

        if (checkError) {
          logger.error('signup.check_existing_users_failed', { email: normalizedEmail || email, error: checkError.message });
        } else if (existingProfiles && existingProfiles.length > 0) {
          return NextResponse.json(
            { 
              error: 'An account with this email or mobile already exists', 
              code: 'USER_ALREADY_EXISTS'
            },
            { status: 409 }
          );
        }
      }
    } catch (checkError) {
      logger.error('signup.check_existing_users_failed', { email: normalizedEmail || email, error: checkError });
      // Continue with signup attempt
    }

    // DO NOT CREATE USER YET - Only send OTP for verification
    // The user will be created AFTER OTP verification
    logger.info('signup.sending_otp', { email: normalizedEmail || email, mobile: !!mobile, clientIp });

    const otpMobile = mobile || undefined;
    const preferredChannel: OTPChannel = (requestedChannel && ['email', 'whatsapp'].includes(requestedChannel)) 
      ? requestedChannel as OTPChannel 
      : 'whatsapp';
    const enforcePreferredChannel = true;

    const otpResult = await otpService.generateOTP({
      email: normalizedEmail || undefined,
      phone: otpMobile,
      purpose: 'registration',
      preferredChannel,
      enforcePreferredChannel,
    });

    if (!otpResult.success || !otpResult.otpId) {
      logger.error('signup.otp_generation_failed', { email: normalizedEmail || email, mobile: otpMobile, message: otpResult.message });
      return NextResponse.json(
        { error: otpResult.message || 'Failed to send verification code' },
        { status: 500 }
      );
    }

    logger.info('signup.otp_dispatch_complete', {
      email: normalizedEmail || email,
      mobile: !!otpMobile,
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
