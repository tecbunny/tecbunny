import { NextRequest, NextResponse } from 'next/server';

import MultiChannelOTPManager, { type OTPVerification } from '../../../../lib/multi-channel-otp-manager';
import { logger } from '../../../../lib/logger';
import { createServiceClient, isSupabaseServiceConfigured } from '../../../../lib/supabase/server';

const otpManager = new MultiChannelOTPManager();

/**
 * Verify OTP with multi-channel support and automatic fallback handling
 * POST /api/otp/verify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { otpId, code, channel, orderId, otp, customerPhone } = body;

    // Support legacy format for agent orders
    let finalOtpId = otpId;
    let finalCode = code;

    // Legacy compatibility
    if (!otpId && orderId && customerPhone && otp) {
      if (!isSupabaseServiceConfigured) {
        logger.warn('otp.verify.legacy_lookup.skipped_missing_supabase', {
          orderId,
          customerPhone
        });
      } else {
        const supabase = createServiceClient();
        const { data: otpRecord } = await supabase
          .from('otp_verifications')
          .select('id')
          .eq('order_id', orderId)
          .eq('phone', customerPhone)
          .eq('verified', false)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (otpRecord) {
          finalOtpId = otpRecord.id;
          finalCode = otp;
        }
      }
    }

    // Validation
    if (!finalOtpId || !finalCode) {
      return NextResponse.json(
        { error: 'OTP ID and code are required' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(finalCode)) {
      return NextResponse.json(
        { error: 'OTP code must be 4 digits' },
        { status: 400 }
      );
    }

    // Create verification request
    const verification: OTPVerification = {
      otpId: finalOtpId,
      code: finalCode,
      channel
    };

    // Verify OTP
    const result = await otpManager.verifyOTP(verification);

    if (!result.success) {
      // Handle different failure scenarios
      const response: any = {
        success: false,
        message: result.message,
        verified: false
      };

      if (result.canRetry !== undefined) {
        response.canRetry = result.canRetry;
      }

      if (result.suggestFallback) {
        response.suggestFallback = true;
        response.nextFallbackChannel = result.nextFallbackChannel;
        response.fallbackMessage = `Try receiving OTP via ${result.nextFallbackChannel}`;
      }

      return NextResponse.json(response, { status: 400 });
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: result.message || 'OTP verified successfully',
      verified: true
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get OTP status for an order or OTP ID
 * GET /api/otp/verify?orderId=123 or GET /api/otp/verify?otpId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const otpId = searchParams.get('otpId');

    if (!orderId && !otpId) {
      return NextResponse.json(
        { error: 'Order ID or OTP ID is required' },
        { status: 400 }
      );
    }

    if (otpId) {
      // Get status by OTP ID
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
        status: {
          verified: otpRecord.verified,
          attempts: otpRecord.attempts,
          maxAttempts: otpRecord.max_attempts,
          channel: otpRecord.channel,
          expiresAt: otpRecord.expires_at,
          canResend,
          availableFallbacks
        }
      });
    }

    if (orderId) {
      // Find OTP by order ID (legacy support)
      if (!isSupabaseServiceConfigured) {
        logger.warn('otp.verify.status.legacy_lookup.skipped_missing_supabase', { orderId });
        return NextResponse.json(
          { error: 'Supabase configuration missing for legacy OTP lookup' },
          { status: 503 }
        );
      }

      const supabase = createServiceClient();

      const { data: otpRecord } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return NextResponse.json(
          { error: 'No OTP found for this order' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        status: {
          verified: otpRecord.verified,
          attempts: otpRecord.attempts,
          maxAttempts: otpRecord.max_attempts,
          channel: otpRecord.channel,
          expiresAt: otpRecord.expires_at,
          otpId: otpRecord.id
        }
      });
    }

    // This should never be reached due to validation above, but TypeScript requires it
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in OTP status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
