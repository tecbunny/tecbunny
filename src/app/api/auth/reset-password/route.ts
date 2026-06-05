import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';
import { OTPManager } from '@/lib/otp-manager';

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(identifier);
  
  if (!limit) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + 5 * 60 * 1000 }); // 5 minutes
    return false;
  }
  
  if (now > limit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + 5 * 60 * 1000 });
    return false;
  }
  
  if (limit.count >= 5) { // Max 5 attempts per 5 minutes
    return true;
  }
  
  limit.count++;
  return false;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
  if (!/(?=.*[@$!%*?&])/.test(password)) return 'Password must contain at least one special character';
  return null;
}

const otpService = new OTPManager();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const otp = (body?.otp || body?.code || '').toString().trim();
    const email = (body?.email || body?.userEmail || '').toString().trim();
    const mobile = (body?.mobile || '').toString().trim();
    const otpId = (body?.otpId || body?.otp_id || '').toString().trim();
    const password: string = (body?.password || body?.newPassword || body?.new_password || '').toString();

    if (!otp || !otpId || (!email && !mobile) || !password) {
      return NextResponse.json(
        { error: 'OTP, otpId, email or mobile, and password are required' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const identifier = email || mobile;
    if (isRateLimited(identifier)) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please wait 5 minutes before trying again.' },
        { status: 429 }
      );
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400 }
      );
    }

    // Verify OTP via multi-channel manager
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('id', otpId)
      .maybeSingle();

    if (otpError || !otpRecord) {
      logger.warn('auth.reset_password.otp_record_missing', { otpId, identifier });
      return NextResponse.json(
        { error: 'Invalid or expired OTP reference' },
        { status: 400 }
      );
    }

    if (otpRecord.purpose !== 'password_reset') {
      return NextResponse.json(
        { error: 'OTP type mismatch. Please request a new reset code.' },
        { status: 400 }
      );
    }

    // Confirm the OTP record binds directly to the requested identity to prevent Account Takeover
    const normalizedRequestEmail = email ? email.trim().toLowerCase() : null;
    const normalizedRequestMobile = mobile ? mobile.trim().replace(/\D/g, '') : null;

    const normalizedOtpEmail = otpRecord.email ? otpRecord.email.trim().toLowerCase() : null;
    const normalizedOtpPhone = otpRecord.phone ? otpRecord.phone.trim().replace(/\D/g, '') : null;

    const isEmailValidMatch = normalizedRequestEmail && normalizedOtpEmail && normalizedRequestEmail === normalizedOtpEmail;
    const isMobileValidMatch = normalizedRequestMobile && normalizedOtpPhone && normalizedRequestMobile === normalizedOtpPhone;

    if (!isEmailValidMatch && !isMobileValidMatch) {
      logger.warn('auth.reset_password.identity_spoofing_attempt', {
        otpId,
        requestEmail: normalizedRequestEmail,
        otpEmail: normalizedOtpEmail,
        requestMobile: normalizedRequestMobile,
        otpPhone: normalizedOtpPhone
      });
      return NextResponse.json(
        { error: 'Security verification failed: OTP reference mismatch.' },
        { status: 400 }
      );
    }

    const verify = await otpService.verifyOTP({ otpId, code: otp, channel: otpRecord.channel || undefined });

    if (!verify.success) {
      return NextResponse.json(
        { error: verify.message || 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Get user by email or mobile
    let user: User | null = null;
    try {
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();
        if (profile) {
          const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
          user = userData?.user;
        }
      } else if (mobile) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mobile', mobile.trim())
          .maybeSingle();
        if (profile) {
          const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
          user = userData?.user;
        }
      }
    } catch (err) {
      logger.error('auth.reset_password.lookup_failed', { error: err, identifier });
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      logger.error('auth.reset_password.update_failed', { error: updateError, userId: user.id });
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('auth.reset_password.success', { identifier });
    }

    const res = NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    });
    try {
      res.cookies.set('recovery_otp', '', { maxAge: 0, path: '/' });
    } catch {}
    return res;

  } catch (error) {
    logger.error('auth.reset_password.unhandled_error', { error });
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
