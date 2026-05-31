import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import MultiChannelOTPManager, { type OTPRequest } from '../../../../lib/multi-channel-otp-manager';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const otpManager = new MultiChannelOTPManager();

/**
 * Generate OTP with multi-channel support (SMS, Email, WhatsApp)
 * POST /api/otp/generate
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service configuration error. Please contact support.' },
        { status: 503 }
      );
    }
    const body = await request.json();
    const { phone, email, purpose, preferredChannel, userId, orderId, agentId, customerPhone } = body;

    // Support legacy agent order format
    let finalPhone = phone;
    let finalPurpose = purpose || 'agent_order';
    let finalOrderId = orderId;
    let finalUserId = userId;

    // Legacy compatibility for agent orders
    if (customerPhone && agentId && orderId && !phone) {
      finalPhone = customerPhone;
      finalPurpose = 'agent_order';
      finalOrderId = orderId;
      finalUserId = agentId;
    }

    // Validation
    if (!finalPhone && !email) {
      return NextResponse.json(
        { error: 'Either phone or email is required' },
        { status: 400 }
      );
    }

    if (!finalPurpose || !['login', 'registration', 'password_reset', 'transaction', 'agent_order'].includes(finalPurpose)) {
      return NextResponse.json(
        { error: 'Valid purpose is required' },
        { status: 400 }
      );
    }

    const bypassRateLimit = process.env.OTP_RATE_LIMIT_BYPASS === 'true';

    if (!bypassRateLimit) {
      // Rate limiting check
      const clientIp = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';

      // Check rate limits for phone/email/IP
      const rateLimitKey = finalPhone || email || clientIp;
      const rateLimitType = finalPhone ? 'phone' : email ? 'email' : 'ip';
      const maxRequests = parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || '5', 10);

      const { data: rateLimitCheck } = await supabase.rpc('check_otp_rate_limit', {
        p_limit_key: rateLimitKey,
        p_limit_type: rateLimitType,
        p_max_requests: maxRequests
      });

      if (!rateLimitCheck) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait before requesting another OTP.',
            retryAfter: 3600 // 1 hour in seconds
          },
          { status: 429 }
        );
      }
    }

    // Create OTP request
    const otpRequest: OTPRequest = {
      phone: finalPhone,
      email,
      purpose: finalPurpose,
      preferredChannel: preferredChannel || 'sms', // Default to SMS
      userId: finalUserId,
      orderId: finalOrderId
    };

    // Generate and send OTP
    const result = await otpManager.generateOTP(otpRequest);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to generate OTP' },
        { status: 500 }
      );
    }

    // Return success response (without exposing the actual OTP code)
    return NextResponse.json({
      success: true,
      otpId: result.otpId,
      channel: result.channel,
      message: result.message,
      fallbackAvailable: result.fallbackAvailable,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      providerResponse: result.providerResponse,
      expiresIn: 300, // 5 minutes in seconds
      canResend: true,
      // Legacy compatibility
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('OTP generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get OTP status and available fallback options
 * GET /api/otp/generate?otpId=xxx
 */
export async function GET(request: NextRequest) {
  try {
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

  } catch (error) {
    console.error('OTP status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
