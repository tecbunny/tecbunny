import { timingSafeEqual } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../../../lib/logger';
import { createServiceClient, isSupabaseServiceConfigured } from '../../../../lib/supabase/server';
import { sendSms } from '../../../../lib/sms/twofactor';

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function isAuthorized(token: string, secret: string): boolean {
  const tokenBuffer = Buffer.from(token, 'utf8');
  const secretBuffer = Buffer.from(secret, 'utf8');

  if (tokenBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, secretBuffer);
}

function maskPhoneNumber(phone: string): string {
  return phone.replace(/.(?=.{4})/g, '*');
}

/**
 * Supabase SMS Webhook
 * Handles SMS sending requests from Supabase Auth
 * Expected payload: { to: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.SUPABASE_AUTH_SMS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.info('Supabase SMS webhook disabled: SUPABASE_AUTH_SMS_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { error: 'Supabase SMS integration is disabled' },
        { status: 410 }
      );
    }

    const bearerToken = extractBearerToken(request.headers.get('authorization'));
    if (!bearerToken || !isAuthorized(bearerToken, webhookSecret)) {
      logger.warn('SMS webhook unauthorized attempt', {
        hasAuthorization: !!bearerToken,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, content } = body;

    const destination = typeof to === 'string' ? to.trim() : '';
    const message = typeof content === 'string' ? content.trim() : '';

    logger.info('SMS webhook received', {
      toMasked: destination ? maskPhoneNumber(destination) : null,
      contentLength: message.length,
    });

    // Validate required fields
    if (!destination || !message) {
      logger.warn('SMS webhook: missing required fields', { hasTo: !!destination, hasContent: !!message });
      return NextResponse.json(
        { error: 'Missing required fields: to and content' },
        { status: 400 }
      );
    }

    if (!/^\+?[1-9]\d{7,14}$/.test(destination)) {
      logger.warn('SMS webhook: invalid phone number format', {
        toMasked: maskPhoneNumber(destination),
      });
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Send SMS using 2Factor
    const result = await sendSms({
      to: destination,
      message,
    });

    const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : null;
    const maskedTo = maskPhoneNumber(destination);

    if (result.success) {
      logger.info('SMS sent successfully via webhook', { to: maskedTo, messageId: result.id });

      if (serviceSupabase) {
        const { error: auditError } = await serviceSupabase
          .from('security_audit_log')
          .insert({
            event_type: 'sms_webhook_delivered',
            user_id: null,
            event_data: {
              to: maskedTo,
              message_length: message.length,
              provider_message_id: result.id,
            },
            severity: 'low',
          });

        if (auditError) {
          logger.warn('Failed to record SMS webhook delivery audit event', {
            error: auditError.message,
          });
        }
      } else {
        logger.warn('Skipping SMS delivery audit logging due to missing Supabase configuration');
      }

      return NextResponse.json({
        success: true,
        message_id: result.id
      });
    } else {
      logger.error('SMS sending failed via webhook', { to: maskedTo, error: result.error });

      if (serviceSupabase) {
        const { error: auditError } = await serviceSupabase
          .from('security_audit_log')
          .insert({
            event_type: 'sms_webhook_failed',
            user_id: null,
            event_data: {
              to: maskedTo,
              message_length: message.length,
              error: result.error,
            },
            severity: 'high',
          });

        if (auditError) {
          logger.warn('Failed to record SMS webhook failure audit event', {
            error: auditError.message,
          });
        }
      } else {
        logger.warn('Skipping SMS failure audit logging due to missing Supabase configuration');
      }

      return NextResponse.json(
        { error: result.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('SMS webhook error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  const webhookSecret = process.env.SUPABASE_AUTH_SMS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { status: 'Supabase SMS integration is disabled' },
      { status: 410 }
    );
  }

  const bearerToken = extractBearerToken(request.headers.get('authorization'));

  if (!bearerToken || !isAuthorized(bearerToken, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ status: 'SMS webhook is active' });
}
