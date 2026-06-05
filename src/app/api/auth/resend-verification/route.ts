import { NextRequest } from 'next/server';

import { rateLimit } from '@/lib/rate-limit';
import { apiError, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { OTPManager, type OTPChannel } from '@/lib/otp-manager';

const LIMIT = 3; // 3 per 5 minutes
const WINDOW_MS = 5 * 60 * 1000;

const otpService = new OTPManager();

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id');
  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Content-Type must be application/json', correlationId });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid JSON body', correlationId });
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // CAPTCHA completely disabled for resend verification to ensure smooth user experience
    logger.debug('auth_resend_captcha_bypassed', { ip, correlationId, reason: 'CAPTCHA disabled for resend verification' });

    const otpId = typeof body?.otpId === 'string' ? body.otpId.trim() : undefined;

    if (!otpId) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Missing OTP reference. Please request a new code.', correlationId });
    }

    const key = `auth_resend:${otpId}|ip:${ip}`;
    if (!rateLimit(key, 'auth_resend_verification', { limit: LIMIT, windowMs: WINDOW_MS })) {
      logger.warn('auth_resend_rate_limited', { otpId, ip, correlationId });
      return apiError('RATE_LIMITED', { overrideMessage: 'Too many resend attempts. Please wait 5 minutes before trying again.', correlationId, details: { retryAfterMs: WINDOW_MS } });
    }
    const fallbackChannel = typeof body?.channel === 'string' ? body.channel.trim() : undefined;

    if (!otpId) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Missing OTP reference. Please request a new code.', correlationId });
    }

    const validChannels: OTPChannel[] = ['whatsapp', 'email'];
    if (!fallbackChannel || !validChannels.includes(fallbackChannel as OTPChannel)) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid verification channel selected.', correlationId });
    }

    const resendResult = await otpService.resendOTPWithFallback(otpId, fallbackChannel as OTPChannel);

    if (!resendResult.success) {
      logger.warn('auth_resend_otp_failed', { correlationId, otpId, channel: fallbackChannel, message: resendResult.message });
      return apiError('SERVICE_UNAVAILABLE', { overrideMessage: resendResult.message || 'Failed to resend verification code', correlationId });
    }

    const status = await otpService.getOTPStatus(otpId);

    logger.info('auth_resend_success', { otpId, channel: resendResult.channel, correlationId });
    return apiSuccess({
      message: resendResult.message || `Verification code resent via ${resendResult.channel}`,
      channel: resendResult.channel,
      otpId,
      canResend: status.canResend,
      availableFallbacks: status.availableFallbacks,
    }, correlationId);
  } catch (error) {
    logger.error('auth_resend_unhandled_error', { error: (error as Error).message, correlationId });
    return apiError('INTERNAL_ERROR', { overrideMessage: 'Failed to resend verification email', correlationId });
  }
}
