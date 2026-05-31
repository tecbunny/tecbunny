import { NextRequest } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { handleEmailPost } from '../../../../lib/api-email-route';
import { logger } from '../../../../lib/logger';
import { resolveSiteUrl } from '../../../../lib/site-url';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.local';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface ResendPayload { email: string; type: 'signup' | 'email_change'; redirectUrl?: string }
interface ResendResult { success: true; method: 'admin' | 'resend' | 'otp' }

export async function POST(request: NextRequest) {
  return handleEmailPost<ResendPayload, ResendResult>(request, {
    validate: (body) => {
      if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };
      const { email, type, redirectUrl } = body;
      if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Invalid email' };
      if (type !== 'signup' && type !== 'email_change') return { ok: false, error: 'Invalid type' };
      if (redirectUrl && typeof redirectUrl !== 'string') return { ok: false, error: 'Invalid redirectUrl' };
      return { ok: true, data: { email, type, redirectUrl } };
    },
    rate: { bucket: 'emails_resend_verification', limit: 5, windowMs: 30 * 60 * 1000 },
    action: async ({ email, type, redirectUrl }) => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        logger.error('resend_verification_configuration_missing');
        return false;
      }
      logger.info('resend_verification_start', { email, type });
      // Attempt order: admin link -> resend -> OTP
      try {
        const linkResult = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: redirectUrl || `${resolveSiteUrl(request.headers.get('host') || undefined)}/auth/verify-otp` },
        });
        if (!linkResult.error) {
          logger.info('resend_verification_method', { method: 'admin' });
          return { success: true, method: 'admin' };
        }
        logger.warn('admin_generate_link_failed', { error: linkResult.error.message });
      } catch (e) {
        logger.error('admin_generate_link_exception', { error: (e as Error).message });
      }

      try {
        const { error: resendError } = await supabaseAdmin.auth.resend({
          type: type === 'signup' ? 'signup' : 'email_change',
          email,
          options: { emailRedirectTo: redirectUrl || `${resolveSiteUrl(request.headers.get('host') || undefined)}/auth/verify-otp` },
        });
        if (!resendError) {
          logger.info('resend_verification_method', { method: 'resend' });
          return { success: true, method: 'resend' };
        }
        logger.warn('standard_resend_failed', { error: resendError.message });
      } catch (e) {
        logger.error('standard_resend_exception', { error: (e as Error).message });
      }

      try {
        const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (!otpError) {
          logger.info('resend_verification_method', { method: 'otp' });
          return { success: true, method: 'otp' };
        }
        logger.warn('otp_signin_failed', { error: otpError.message });
      } catch (e) {
        logger.error('otp_signin_exception', { error: (e as Error).message });
      }

      logger.error('resend_verification_all_methods_failed', { email });
      return false;
    }
  });
}
