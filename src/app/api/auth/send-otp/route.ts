import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { OTPManager } from '@/lib/otp-manager';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { verifyCaptcha } from '@/lib/captcha/captcha-service';
import { rateLimit } from '@/lib/rate-limit';

const SEND_OTP_IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const SEND_OTP_IDENTIFIER_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function getClientIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id');
  const otpManager = new OTPManager();
  try {
    let body: any;
    try { body = await request.json(); } catch { return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid JSON body', correlationId }); }
    const { email, mobile, type = 'signup', captchaToken } = body || {};

    logger.info('send_otp_start', { correlationId });

    // Validate that either email or mobile is provided
    if ((!email || !email.includes('@')) && (!mobile || mobile.length < 10)) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Valid email address or mobile number is required', correlationId });
    }
    if (!['signup', 'recovery'].includes(type)) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid OTP type. Must be either "signup" or "recovery"', correlationId });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const normalizedMobile = mobile ? String(mobile).replace(/\D/g, '') : undefined;

    // Guard against staff accounts using the public client portal
    const searchVal = normalizedEmail || normalizedMobile;
    if (searchVal) {
      let query = supabaseAdmin.from('profiles').select('role');
      if (normalizedEmail) {
        query = query.eq('email', normalizedEmail);
      } else {
        query = query.eq('mobile', normalizedMobile);
      }
      
      const { data: profile } = await query.maybeSingle();
      if (profile?.role) {
        const role = profile.role.trim().toLowerCase();
        const isStaff = ['superadmin', 'admin', 'manager', 'sales', 'service_engineer', 'accounts'].includes(role);
        if (isStaff) {
          logger.warn('send_otp.staff_blocked_on_public_portal', { correlationId, email: normalizedEmail, mobile: normalizedMobile, role });
          return apiError('FORBIDDEN', {
            overrideMessage: 'High-privilege account detected. Please log in through the Staff Portal.',
            correlationId,
            details: { redirectTo: '/staff/login' }
          });
        }
      }
    }

    const ip = getClientIp(request);

    if (!rateLimit(ip, 'auth_send_otp_ip', SEND_OTP_IP_LIMIT)) {
      return apiError('RATE_LIMITED', { overrideMessage: 'Too many OTP requests. Please try again later.', correlationId });
    }
    if (normalizedEmail && !rateLimit(`email:${normalizedEmail}`, 'auth_send_otp_identifier', SEND_OTP_IDENTIFIER_LIMIT)) {
      return apiError('RATE_LIMITED', { overrideMessage: 'Too many OTP requests for this email. Please try again later.', correlationId });
    }
    if (normalizedMobile && !rateLimit(`mobile:${normalizedMobile}`, 'auth_send_otp_identifier', SEND_OTP_IDENTIFIER_LIMIT)) {
      return apiError('RATE_LIMITED', { overrideMessage: 'Too many OTP requests for this mobile number. Please try again later.', correlationId });
    }

    // CAPTCHA verification (conditional if configured)
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey) {
      const captcha = await verifyCaptcha(captchaToken, ip);
      if (!captcha.success) {
        logger.warn('send_otp_captcha_failed', { correlationId, identifier: email || mobile, ip, error: captcha.error || captcha.errorCodes });
        return apiError('VALIDATION_ERROR', { overrideMessage: `Captcha verification failed: ${captcha.error || captcha.errorCodes?.join(', ') || 'Please retry.'}`, correlationId });
      }
    }

    const purpose = type === 'recovery' ? 'password_reset' : 'registration';

    // Prefer WhatsApp when mobile is provided, otherwise email
    const preferredChannel = normalizedMobile ? 'whatsapp' : 'email';

    const result = await otpManager.generateOTP({
      phone: normalizedMobile,
      email: normalizedEmail,
      purpose,
      preferredChannel,
      ipAddress: ip
    });

    if (!result.success) {
      logger.warn('send_otp_failed', { correlationId, reason: result.message });
      return apiError('SERVICE_UNAVAILABLE', { overrideMessage: result.message || 'Failed to send OTP', correlationId });
    }

    logger.info('send_otp_success', { correlationId, channel: result.channel, provider: result.provider });
    return apiSuccess({
      message: result.message || 'OTP sent successfully',
      otpId: result.otpId,
      channel: result.channel,
      provider: result.provider
    }, correlationId);
  } catch (error) {
    logger.error('send_otp_unhandled', { correlationId, error: (error as Error).message });
    return apiError('INTERNAL_ERROR', { overrideMessage: 'Failed to send OTP', correlationId });
  }
}

// Ensure Node.js runtime for nodemailer and Supabase admin
export const runtime = 'nodejs';
export const maxDuration = 30;
