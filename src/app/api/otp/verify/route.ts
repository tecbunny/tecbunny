import { NextRequest, NextResponse } from 'next/server';

import { OTPManager, type OTPVerification } from '@/lib/otp-manager';
import { logger } from '@/lib/logger';
import { createServiceClient, isSupabaseServiceConfigured , createClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/server-role-guard';
import { rateLimit } from '@/lib/rate-limit';

const otpManager = new OTPManager();
const VERIFY_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

/**
 * Verify OTP with multi-channel support and automatic fallback handling
 * POST /api/otp/verify
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('cf-connecting-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     'unknown';

    const access = await requireApiRole();
    if ('error' in access) {
      return access.error;
    }

    const body = await request.json();
    const { otpId, code, channel, orderId, otp, customerPhone } = body;

    const reqCode = code || otp;
    const reqPhone = customerPhone;

    // Rate limit OTP verification attempts to prevent brute-force
    const rateLimitKey = `otp_verify_${clientIp}_${otpId || orderId || reqPhone}`;
    const rl = await rateLimit(rateLimitKey, VERIFY_RATE_LIMIT.limit, VERIFY_RATE_LIMIT.windowMs);
    if (!rl.allowed) {
      logger.warn('otp_verify_rate_limited', { clientIp, otpId, orderId });
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Prefer service client for RLS bypass when looking up OTP/Order data
    const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    // Check if this is an agent order verification (using order_otp_verifications table)
    if (orderId && reqPhone && reqCode) {
      const { data: agentOtpRecord } = await serviceSupabase
        .from('order_otp_verifications')
        .select('*')
        .eq('order_id', orderId)
        .eq('customer_phone', reqPhone)
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agentOtpRecord) {
        // Run verify via otpService
        const { otpService } = await import('@/lib/otp-service');
        const verifyResult = await otpService.verifyOtp({
          order_id: orderId,
          customer_phone: reqPhone,
          otp_code: reqCode,
        });

        if (!verifyResult.success) {
          return NextResponse.json({
            success: false,
            message: verifyResult.error || 'Invalid OTP code',
            verified: false
          }, { status: 400 });
        }

        // Process commission award immediately on success
        if (agentOtpRecord.agent_id) {
          try {
            const { enhancedCommissionService } = await import('@/lib/enhanced-commission-service');
            const commissionResult = await enhancedCommissionService.calculateOrderCommission(
              orderId,
              agentOtpRecord.agent_id
            );

            if (commissionResult.success && commissionResult.calculation) {
              const saveResult = await enhancedCommissionService.saveCommissionRecord(
                commissionResult.calculation
              );
              if (saveResult.success) {
                logger.info('order_commission_processed_after_otp', { 
                  orderId, 
                  agentId: agentOtpRecord.agent_id,
                  commissionAmount: commissionResult.calculation.commission_amount
                });
              }
            }
          } catch (commErr: any) {
            logger.error('failed_to_process_commission_after_otp', {
              orderId,
              agentId: agentOtpRecord.agent_id,
              error: commErr.message
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: 'OTP verified successfully',
          verified: true
        });
      }
    }

    // Support legacy format for standard customer verification (using otp_verifications table)
    let finalOtpId = otpId;
    const finalCode = reqCode;

    // Legacy compatibility
    if (!otpId && orderId && reqPhone) {
      if (!isSupabaseServiceConfigured) {
        logger.warn('otp.verify.legacy_lookup.skipped_missing_supabase', {
          orderId,
          customerPhone: reqPhone
        });
      } else {
        const { data: otpRecord } = await serviceSupabase
          .from('otp_verifications')
          .select('id')
          .eq('order_id', orderId)
          .eq('phone', reqPhone)
          .eq('verified', false)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (otpRecord) {
          finalOtpId = otpRecord.id;
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

    if (!/^\d{6}$/.test(finalCode)) {
      return NextResponse.json(
        { error: 'OTP code must be 6 digits' },
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
    const access = await requireApiRole();
    if ('error' in access) {
      return access.error;
    }

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

      const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

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
