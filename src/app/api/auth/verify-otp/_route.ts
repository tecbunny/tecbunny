import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import MultiChannelOTPManager from '../../../../lib/multi-channel-otp-manager';
import { logger } from '../../../../lib/logger';
import { apiError, apiSuccess } from '../../../../lib/errors';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const otpService = new MultiChannelOTPManager();

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id');
  try {
    if (!isSupabaseConfigured) {
      logger.error('verify_otp.supabase_config_missing', { correlationId });
      return apiError('SERVER_ERROR', {
        overrideMessage: 'Supabase configuration missing. Please contact support.',
        correlationId
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid JSON body', correlationId });
    }
  const { email, mobile, otp, type = 'signup', otpId: rawOtpId } = body || {};
  // Normalize identifiers
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  const normalizedMobile = mobile ? String(mobile).replace(/\D/g, '') : undefined;

  // Debug: log incoming body in development for easier tracing
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('verify_otp_incoming', { correlationId, body, normalizedEmail, normalizedMobile });
  }
  if (typeof otp !== 'string' || otp.length !== 4 || !/^\d{4}$/.test(otp)) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'Valid 4-digit OTP is required', correlationId });
  }
  if (!['signup', 'recovery'].includes(type)) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid OTP type. Must be either "signup" or "recovery"', correlationId });
  }
  const purpose = type === 'signup' ? 'registration' : 'password_reset';

  let otpId: string | undefined = typeof rawOtpId === 'string' ? rawOtpId.trim() : undefined;

  if (!otpId) {
    const lookupColumn = normalizedEmail ? 'email' : normalizedMobile ? 'phone' : null;
    const lookupValue = normalizedEmail ?? normalizedMobile;

    if (!lookupColumn || !lookupValue) {
      return apiError('VALIDATION_ERROR', { overrideMessage: 'OTP reference not found. Please request a new code.', correlationId });
    }

    const { data: latestOtp, error: lookupError } = await supabaseAdmin
      .from('otp_verifications')
      .select('id')
      .eq(lookupColumn, lookupValue)
      .eq('purpose', purpose)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      logger.warn('verify_otp.lookup_failed', { correlationId, error: lookupError.message, column: lookupColumn, value: lookupValue });
    }

    otpId = latestOtp?.id;
  }

  if (!otpId) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'OTP reference is missing or expired. Please request a new code.', correlationId });
  }

  const { data: otpRecord, error: otpRecordError } = await supabaseAdmin
    .from('otp_verifications')
    .select('*')
    .eq('id', otpId)
    .maybeSingle();

  if (otpRecordError || !otpRecord) {
    logger.warn('verify_otp.record_not_found', { correlationId, otpId, error: otpRecordError?.message });
    return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid or expired OTP reference. Please request a new code.', correlationId });
  }

  if (otpRecord.purpose !== purpose) {
    logger.warn('verify_otp.purpose_mismatch', { correlationId, otpId, expected: purpose, actual: otpRecord.purpose });
    return apiError('VALIDATION_ERROR', { overrideMessage: 'OTP type mismatch. Please request a new code.', correlationId });
  }

  logger.debug('verify_otp_attempt', {
    correlationId,
    otpId,
    channel: otpRecord.channel,
    purpose,
    email: otpRecord.email,
    phone: otpRecord.phone,
  });

  const verificationResult = await otpService.verifyOTP({
    otpId,
    code: otp,
    channel: otpRecord.channel || undefined,
  });

  if (!verificationResult.success) {
    logger.warn('verify_otp_failed', { correlationId, otpId, message: verificationResult.message });
    return apiError('VALIDATION_ERROR', { overrideMessage: verificationResult.message || 'Invalid or expired OTP', correlationId });
  }

  const identifier = otpRecord.email || otpRecord.phone;
  logger.info('verify_otp_success', { correlationId, otpId, type, identifier });

    if (type === 'signup') {
      // For signup, just return success - account creation will be handled by complete-signup endpoint
      return apiSuccess({
        message: 'OTP verified successfully! Creating your account...',
        type: 'signup',
        identifier,
        otpId,
        requiresAccountCreation: true
      }, correlationId);
    }
    
    // For recovery type, find and confirm existing user
    if (type === 'recovery') {
      try {
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        const user = allUsers.users.find(u => 
          (otpRecord.email && u.email === otpRecord.email) || 
          (otpRecord.phone && u.user_metadata?.mobile === otpRecord.phone)
        );
        
        if (user) {
          const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
          if (confirmError) {
            logger.error('verify_otp_confirm_failed', { correlationId, error: confirmError.message });
            return apiError('SERVER_ERROR', { overrideMessage: 'Failed to confirm account. Please try again.', correlationId });
          } else {
            logger.info('verify_otp_recovery_success', { correlationId, identifier });
            return apiSuccess({
              message: 'Account verified successfully!',
              type,
              identifier,
              otpId,
              requiresSignIn: false
            }, correlationId);
          }
        } else {
          logger.error('verify_otp_user_not_found', { correlationId, identifier });
          return apiError('VALIDATION_ERROR', { overrideMessage: 'User not found. Please sign up first.', correlationId });
        }
      } catch (e) {
        logger.error('verify_otp_recovery_exception', { correlationId, error: (e as Error).message });
        return apiError('SERVER_ERROR', { overrideMessage: 'Failed to verify account. Please try again.', correlationId });
      }
    }

    // Default success response
    return apiSuccess({
      message: verificationResult.message || 'Verification successful',
      type,
      identifier,
      otpId,
      requiresSignIn: type === 'signup'
    }, correlationId);

  } catch (error) {
    logger.error('verify_otp_exception', { correlationId, error: (error as Error).message });
    return apiError('SERVER_ERROR', { overrideMessage: 'Internal server error during verification', correlationId });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
