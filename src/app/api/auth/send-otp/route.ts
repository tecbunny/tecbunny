import { NextRequest } from 'next/server';

import MultiChannelOTPManager from '@/lib/multi-channel-otp-manager';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { verifyCaptcha } from '@/lib/captcha/captcha-service';
import { rateLimit } from '@/lib/rate-limit';

const SEND_OTP_IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const SEND_OTP_IDENTIFIER_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };

function getClientIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id');
  const otpManager = new MultiChannelOTPManager();
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

    // CAPTCHA verification (if configured). Allow runtime bypass via header in non-production
    const bypassHeader = request.headers.get('x-bypass-captcha');
    const isBypassed = process.env.NODE_ENV !== 'production' && bypassHeader === '1';
    if (!isBypassed) {
      const captcha = await verifyCaptcha(captchaToken, ip);
      if (!captcha.success) {
        logger.warn('send_otp_captcha_failed', { correlationId, identifier: email || mobile, ip, error: captcha.error || captcha.errorCodes });
        return apiError('VALIDATION_ERROR', { overrideMessage: `Captcha verification failed: ${captcha.error || captcha.errorCodes?.join(', ') || 'Please retry.'}`, correlationId });
      }
    } else {
      logger.debug('send_otp_captcha_bypassed', { correlationId, identifier: email || mobile, ip });
    }

    const purpose = type === 'recovery' ? 'password_reset' : 'registration';

    // Prefer SMS when mobile is provided, otherwise email
    const preferredChannel = normalizedMobile ? 'sms' : 'email';

    const result = await otpManager.generateOTP({
      phone: normalizedMobile,
      email: normalizedEmail,
      purpose,
      preferredChannel
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
