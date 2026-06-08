import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { OTPManager } from '@/lib/otp-manager';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const otpService = new OTPManager();
const VERIFY_OTP_IP_LIMIT = { limit: 15, windowMs: 15 * 60 * 1000 };
const VERIFY_OTP_IDENTIFIER_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

function getClientIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

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
    const clientIp = getClientIp(request);
    if (!rateLimit(clientIp, 'auth_verify_otp_ip', VERIFY_OTP_IP_LIMIT)) {
      return apiError('RATE_LIMITED', { overrideMessage: 'Too many OTP verification attempts. Please try again later.', correlationId });
    }

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

  const identifierRateKey = normalizedEmail ? `email:${normalizedEmail}` : normalizedMobile ? `mobile:${normalizedMobile}` : undefined;
  if (identifierRateKey && !rateLimit(identifierRateKey, 'auth_verify_otp_identifier', VERIFY_OTP_IDENTIFIER_LIMIT)) {
    return apiError('RATE_LIMITED', { overrideMessage: 'Too many OTP verification attempts for this account. Please try again later.', correlationId });
  }

  // Debug: log non-sensitive request shape in development for easier tracing.
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('verify_otp_incoming', {
      correlationId,
      normalizedEmail,
      normalizedMobile,
      type,
      hasOtp: typeof otp === 'string',
      hasOtpId: typeof rawOtpId === 'string',
    });
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'Valid 6-digit OTP is required', correlationId });
  }
  if (!['signup', 'recovery'].includes(type)) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'Invalid OTP type. Must be either "signup" or "recovery"', correlationId });
  }
  const purpose = type === 'signup' ? 'registration' : 'password_reset';

  const otpId = typeof rawOtpId === 'string' ? rawOtpId.trim() : undefined;

  if (!otpId) {
    return apiError('VALIDATION_ERROR', { overrideMessage: 'otpId is required', correlationId });
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
        let user: any = null;
        let profileRole: string | null = null;
        if (otpRecord.email) {
          const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', otpRecord.email.trim().toLowerCase())
            .maybeSingle();
          
          if (profileErr) {
            logger.error('verify_otp_profile_email_lookup_failed', { correlationId, error: profileErr.message });
          } else if (profile?.id) {
            profileRole = profile.role;
            const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            if (!userErr && userData?.user) {
              user = userData.user;
            } else if (userErr) {
              logger.error('verify_otp_get_user_failed', { correlationId, userId: profile.id, error: userErr.message });
            }
          }
        } else if (otpRecord.phone) {
          const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('mobile', otpRecord.phone.trim())
            .maybeSingle();
          
          if (profileErr) {
            logger.error('verify_otp_profile_phone_lookup_failed', { correlationId, error: profileErr.message });
          } else if (profile?.id) {
            profileRole = profile.role;
            const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            if (!userErr && userData?.user) {
              user = userData.user;
            } else if (userErr) {
              logger.error('verify_otp_get_user_failed', { correlationId, userId: profile.id, error: userErr.message });
            }
          }
        }
        
        if (profileRole) {
          const role = profileRole.trim().toLowerCase();
          const isStaff = ['superadmin', 'admin', 'manager', 'sales', 'service_engineer', 'accounts'].includes(role);
          if (isStaff) {
            logger.warn('verify_otp.staff_blocked_on_public_portal', { correlationId, email: otpRecord.email, phone: otpRecord.phone, role });
            return apiError('FORBIDDEN', { 
              overrideMessage: 'High-privilege account detected. Please use the Staff Portal to authenticate.', 
              correlationId,
              details: { redirectTo: '/staff/login' }
            });
          }
        }
        
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
