import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { requireApiRole } from '@/lib/server-role-guard';
import { OTPManager, type OTPRequest } from '@/lib/otp-manager';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin environment variables are not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const otpManager = new OTPManager();

/**
 * Generate OTP with WhatsApp or email support
 * POST /api/otp/generate
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const isAllowed = await rateLimit(`otp_gen_ip:${ip}`, 5, 60000);
    if (!isAllowed) {
      logger.warn('otp_generate_ip_rate_limited', { ip });
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const access = await requireApiRole();
    if ('error' in access) {
      return access.error;
    }

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

    if (finalPurpose === 'agent_order') {
      const permittedAgentRoles = new Set(['sales', 'sales-staff', 'sales-external', 'manager', 'admin']);
      if (!permittedAgentRoles.has(access.role)) {
        return NextResponse.json(
          { error: 'Agent order OTPs require an approved sales or management account' },
          { status: 403 }
        );
      }

      const admin = getSupabaseAdmin();
      const { data: agent, error: agentError } = await admin
        .from('sales_agents')
        .select('id,status')
        .eq('user_id', access.session.user.id)
        .maybeSingle();

      if (agentError || !agent || agent.status !== 'approved') {
        return NextResponse.json(
          { error: 'Only approved sales agents can request agent order OTPs' },
          { status: 403 }
        );
      }

      if (agentId && agentId !== agent.id) {
        return NextResponse.json(
          { error: 'Agent ID does not match the authenticated account' },
          { status: 403 }
        );
      }

      finalUserId = access.session.user.id;
    } else {
      finalUserId = access.session.user.id;
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

      const admin = getSupabaseAdmin();
      const { data: rateLimitCheck } = await admin.rpc('check_otp_rate_limit', {
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
      preferredChannel: preferredChannel || (finalPhone ? 'whatsapp' : 'email'),
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
