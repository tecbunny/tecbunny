import { NextRequest, NextResponse } from 'next/server';

import { dualChannelOTPManager, OTPChannel, OTPPurpose } from '../../../../lib/dual-channel-otp-manager';
import { logger } from '../../../../lib/logger';
import { rateLimit } from '../../../../lib/rate-limit';

interface OTPRequest {
  channel: OTPChannel;
  email?: string;
  phone?: string;
  purpose: OTPPurpose;
  userPreferences?: {
    preferredChannel: OTPChannel;
    smsEnabled: boolean;
    emailEnabled: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: OTPRequest = await request.json();
    const { channel, email, phone, purpose, userPreferences } = body;

    // Validate required fields
    if (!channel || !purpose) {
      return NextResponse.json(
        { error: 'Channel and purpose are required' },
        { status: 400 }
      );
    }

    if (channel === 'email' && !email) {
      return NextResponse.json(
        { error: 'Email is required for email OTP' },
        { status: 400 }
      );
    }

    if (channel === 'sms' && !phone) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS OTP' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Apply rate limiting
    const identifier = email || phone || clientIp;
    const rateLimitResult = await rateLimit(
      `otp_${identifier}`,
      5, // 5 OTP requests
      15 * 60 * 1000 // per 15 minutes
    );

    if (!rateLimitResult.allowed) {
      logger.warn('OTP rate limit exceeded', { 
        identifier,
        channel,
        purpose,
        clientIp
      });
      
      return NextResponse.json(
        { 
          error: 'Too many OTP requests. Please try again later.',
          retryAfter: rateLimitResult.reset ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000) : 900
        },
        { status: 429 }
      );
    }

    // Send OTP using dual-channel manager
    const result = await dualChannelOTPManager.sendOTP({
      channel,
      email,
      phone,
      purpose,
      userPreferences
    });

    logger.info('OTP send attempt', {
      channel,
      purpose,
      success: result.success,
      fallbackUsed: result.fallbackUsed,
      identifier: email || phone,
      clientIp
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        channel: result.channel,
        deliveryId: result.deliveryId,
        fallbackUsed: result.fallbackUsed,
        message: `OTP sent successfully via ${result.channel === 'sms' ? 'SMS' : 'Email'}`
      });
    } else {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to send OTP',
          retryAvailable: result.retryAvailable 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('OTP send API error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check available channels for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const userId = searchParams.get('userId');

    if (!email && !phone && !userId) {
      return NextResponse.json(
        { error: 'Email, phone, or userId is required' },
        { status: 400 }
      );
    }

    // Get user preferences if userId provided
    let userPreferences = null;
    if (userId) {
      userPreferences = await dualChannelOTPManager.getUserPreferences(userId);
    }

    // Determine available channels
    const availableChannels = [];
    
    if (email && (!userPreferences || userPreferences.emailNotifications !== false)) {
      availableChannels.push({
        channel: 'email',
        contact: email,
        enabled: true
      });
    }

    if (phone && (!userPreferences || userPreferences.smsNotifications !== false)) {
      availableChannels.push({
        channel: 'sms',
        contact: phone,
        enabled: true
      });
    }

    return NextResponse.json({
      availableChannels,
      userPreferences: userPreferences ? {
        preferredChannel: userPreferences.preferredOTPChannel,
        smsEnabled: userPreferences.smsNotifications,
        emailEnabled: userPreferences.emailNotifications
      } : null
    });

  } catch (error) {
    logger.error('OTP channels check API error', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
