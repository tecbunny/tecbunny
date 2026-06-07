import { NextRequest, NextResponse } from 'next/server';

import { OTPManager } from '@/lib/otp-manager';
import { requireApiRole } from '@/lib/server-role-guard';

const otpManager = new OTPManager();

/**
 * Resend OTP using WhatsApp or email
 * POST /api/otp/resend
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiRole();
    if ('error' in access) {
      return access.error;
    }

    const body = await request.json();
    const { otpId, fallbackChannel } = body;

    // Validation
    if (!otpId) {
      return NextResponse.json(
        { error: 'OTP ID is required' },
        { status: 400 }
      );
    }

    if (!fallbackChannel || !['email', 'whatsapp'].includes(fallbackChannel)) {
      return NextResponse.json(
        { error: 'Valid fallback channel is required' },
        { status: 400 }
      );
    }

    // Check rate limiting for resend
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get OTP record to check contact info for rate limiting
    const { data: otpRecord } = await supabase
      .from('otp_verifications')
      .select('phone, email, user_id, created_at')
      .eq('id', otpId)
      .single();

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'OTP not found' },
        { status: 404 }
      );
    }

    // Check if enough time has passed since last OTP (prevent spam)
    const lastOtpTime = new Date(otpRecord.created_at);
    const now = new Date();
    const timeDiff = (now.getTime() - lastOtpTime.getTime()) / 1000; // seconds

    if (timeDiff < 60) { // Minimum 1 minute between resends
      return NextResponse.json(
        { 
          error: 'Please wait before requesting another OTP',
          retryAfter: Math.ceil(60 - timeDiff)
        },
        { status: 429 }
      );
    }

    const bypassRateLimit = process.env.OTP_RATE_LIMIT_BYPASS === 'true';

    if (!bypassRateLimit) {
      // Rate limiting check
      const rateLimitKey = otpRecord.phone || otpRecord.email || otpRecord.user_id;
      const rateLimitType = otpRecord.phone ? 'phone' : otpRecord.email ? 'email' : 'user';
      const maxRequests = parseInt(process.env.OTP_RESEND_RATE_LIMIT_MAX_REQUESTS || '10', 10);

      const { data: rateLimitCheck } = await supabase.rpc('check_otp_rate_limit', {
        p_limit_key: rateLimitKey,
        p_limit_type: rateLimitType,
        p_max_requests: maxRequests
      });

      if (!rateLimitCheck) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait before requesting another OTP.',
            retryAfter: 3600
          },
          { status: 429 }
        );
      }
    }

    // Resend with fallback channel
    const result = await otpManager.resendOTPWithFallback(otpId, fallbackChannel);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to resend OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      channel: result.channel,
      expiresIn: 300 // 5 minutes
    });

  } catch (error) {
    console.error('OTP resend error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get available fallback channels for an OTP
 * GET /api/otp/resend?otpId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiRole();
    if ('error' in access) {
      return access.error;
    }

    const { searchParams } = new URL(request.url);
    const otpId = searchParams.get('otpId');

    if (!otpId) {
      return NextResponse.json(
        { error: 'OTP ID is required' },
        { status: 400 }
      );
    }

    const statusResult = await otpManager.getOTPStatus(otpId);

    if (!statusResult.success) {
      return NextResponse.json(
        { error: 'OTP not found' },
        { status: 404 }
      );
    }

    const { otpRecord, availableFallbacks, canResend } = statusResult;

    return NextResponse.json({
      success: true,
      canResend,
      currentChannel: otpRecord.channel,
      availableFallbacks,
      expiresAt: otpRecord.expires_at,
      attempts: otpRecord.attempts,
      maxAttempts: otpRecord.max_attempts
    });

  } catch (error) {
    console.error('Get fallback options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
